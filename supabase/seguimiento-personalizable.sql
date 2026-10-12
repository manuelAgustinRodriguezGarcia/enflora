-- Seguimiento personalizable.
-- Corre sobre una base que ya tiene perfiles y preferencias_seguimiento.
-- No borra preferencias existentes.
-- No modifica nombre, usuario ni teléfono.

alter table public.perfiles drop constraint if exists perfiles_tipo_seguimiento_valido;

alter table public.perfiles
add constraint perfiles_tipo_seguimiento_valido
check (
  tipo_seguimiento is null
  or tipo_seguimiento in ('relajado', 'profesional', 'personalizado')
);

create or replace function public.inicializar_preferencias_si_faltan(usuario uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tipo text;
  acciones text[];
  parametros text[];
begin
  if usuario is null then
    return;
  end if;

  if exists (
    select 1
    from public.preferencias_seguimiento
    where usuario_id = usuario
  ) then
    return;
  end if;

  select perfiles.tipo_seguimiento
  into tipo
  from public.perfiles
  where id = usuario;

  if tipo = 'relajado' then
    acciones := array['riego', 'foto', 'nota', 'tarea'];
    parametros := array[]::text[];
  elsif tipo = 'profesional' then
    acciones := array['riego', 'foto', 'nota', 'fertilizacion'];
    parametros := array['ph', 'ec', 'temperatura', 'humedad'];
  elsif tipo = 'personalizado' then
    acciones := array[]::text[];
    parametros := array[]::text[];
  else
    return;
  end if;

  insert into public.preferencias_seguimiento (usuario_id, acciones, parametros)
  values (usuario, acciones, parametros)
  on conflict (usuario_id) do nothing;
end;
$$;

create or replace function public.guardar_tipo_seguimiento(tipo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if tipo is null or tipo not in ('relajado', 'profesional', 'personalizado') then
    raise exception 'Seleccioná un tipo de seguimiento.';
  end if;

  update public.perfiles
  set tipo_seguimiento = tipo
  where id = usuario;

  if not found then
    raise exception 'No se encontró el perfil.';
  end if;

  perform public.inicializar_preferencias_si_faltan(usuario);
end;
$$;

create table if not exists public.opciones_seguimiento_personalizadas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  categoria text not null,
  nombre text not null,
  tipo_valor text,
  unidad text,
  prioritaria boolean not null default true,
  activa boolean not null default true,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint opciones_categoria_valida check (categoria in ('accion', 'parametro')),
  constraint opciones_nombre_valido check (char_length(btrim(nombre)) between 1 and 60),
  constraint opciones_forma_valida check (
    (
      categoria = 'accion'
      and tipo_valor is null
      and unidad is null
    )
    or (
      categoria = 'parametro'
      and tipo_valor in ('numero', 'texto')
      and (unidad is null or char_length(btrim(unidad)) between 1 and 16)
    )
  )
);

create unique index if not exists opciones_nombre_activo
on public.opciones_seguimiento_personalizadas (usuario_id, categoria, lower(btrim(nombre)))
where activa;

create index if not exists opciones_usuario_idx
on public.opciones_seguimiento_personalizadas (usuario_id);

alter table public.opciones_seguimiento_personalizadas enable row level security;

drop policy if exists usuario_lee_sus_opciones on public.opciones_seguimiento_personalizadas;

create policy usuario_lee_sus_opciones
on public.opciones_seguimiento_personalizadas
for select
to authenticated
using (auth.uid() = usuario_id);

revoke all on table public.opciones_seguimiento_personalizadas from anon, authenticated;
grant select on table public.opciones_seguimiento_personalizadas to authenticated;

create or replace function public.normalizar_opcion_seguimiento(
  categoria text,
  nombre text,
  tipo_valor text,
  unidad text
)
returns table (
  categoria_ok text,
  nombre_ok text,
  tipo_ok text,
  unidad_ok text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if categoria is null or categoria not in ('accion', 'parametro') then
    raise exception 'Hay una preferencia que no es válida.';
  end if;

  nombre_ok := btrim(coalesce(nombre, ''));

  if char_length(nombre_ok) < 1 then
    raise exception 'El nombre es obligatorio.';
  end if;

  if char_length(nombre_ok) > 60 then
    raise exception 'El nombre es demasiado largo.';
  end if;

  if categoria = 'accion' then
    categoria_ok := 'accion';
    tipo_ok := null;
    unidad_ok := null;
  else
    if tipo_valor is null or tipo_valor not in ('numero', 'texto') then
      raise exception 'Elegí un tipo de valor.';
    end if;

    unidad_ok := nullif(btrim(coalesce(unidad, '')), '');

    if unidad_ok is not null and char_length(unidad_ok) > 16 then
      raise exception 'La unidad es demasiado larga.';
    end if;

    categoria_ok := 'parametro';
    tipo_ok := tipo_valor;
  end if;

  return next;
end;
$$;

create or replace function public.crear_opcion_seguimiento(
  categoria text,
  nombre text,
  tipo_valor text,
  unidad text
)
returns public.opciones_seguimiento_personalizadas
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  limpia record;
  creada public.opciones_seguimiento_personalizadas;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if not exists (select 1 from public.perfiles where id = usuario) then
    raise exception 'No se encontró el perfil.';
  end if;

  select *
  into limpia
  from public.normalizar_opcion_seguimiento(categoria, nombre, tipo_valor, unidad);

  insert into public.opciones_seguimiento_personalizadas (
    usuario_id,
    categoria,
    nombre,
    tipo_valor,
    unidad,
    prioritaria,
    activa
  ) values (
    usuario,
    limpia.categoria_ok,
    limpia.nombre_ok,
    limpia.tipo_ok,
    limpia.unidad_ok,
    true,
    true
  )
  returning * into creada;

  return creada;
exception
  when unique_violation then
    raise exception 'Ya existe una opción con ese nombre.';
end;
$$;

create or replace function public.editar_opcion_seguimiento(
  opcion_id uuid,
  nombre text,
  tipo_valor text,
  unidad text
)
returns public.opciones_seguimiento_personalizadas
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  actual public.opciones_seguimiento_personalizadas;
  limpia record;
  editada public.opciones_seguimiento_personalizadas;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  select *
  into actual
  from public.opciones_seguimiento_personalizadas
  where id = opcion_id
    and usuario_id = usuario
    and activa;

  if not found then
    raise exception 'No se encontró la opción.';
  end if;

  select *
  into limpia
  from public.normalizar_opcion_seguimiento(actual.categoria, nombre, tipo_valor, unidad);

  update public.opciones_seguimiento_personalizadas
  set
    nombre = limpia.nombre_ok,
    tipo_valor = limpia.tipo_ok,
    unidad = limpia.unidad_ok,
    fecha_actualizacion = now()
  where id = actual.id
  returning * into editada;

  return editada;
exception
  when unique_violation then
    raise exception 'Ya existe una opción con ese nombre.';
end;
$$;

create or replace function public.desactivar_opcion_seguimiento(opcion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  update public.opciones_seguimiento_personalizadas
  set
    activa = false,
    prioritaria = false,
    fecha_actualizacion = now()
  where id = opcion_id
    and usuario_id = usuario
    and activa;

  if not found then
    raise exception 'No se encontró la opción.';
  end if;
end;
$$;

create or replace function public.guardar_configuracion_seguimiento(
  tipo text,
  acciones text[],
  parametros text[],
  opciones_prioritarias uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  acciones_limpias text[] := '{}';
  parametros_limpios text[] := '{}';
  acciones_ordenadas text[] := '{}';
  parametros_ordenados text[] := '{}';
  item text;
  catalogo_acciones text[] := array['riego', 'foto', 'nota', 'tarea', 'poda', 'fertilizacion'];
  catalogo_parametros text[] := array['ph', 'ec', 'ppm', 'temperatura', 'humedad', 'vpd'];
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if not exists (select 1 from public.perfiles where id = usuario) then
    raise exception 'No se encontró el perfil.';
  end if;

  if tipo is null or tipo not in ('relajado', 'profesional', 'personalizado') then
    raise exception 'Seleccioná un tipo de seguimiento.';
  end if;

  if acciones is not null then
    foreach item in array acciones loop
      if item is null or not (item = any (catalogo_acciones)) then
        raise exception 'Hay una preferencia que no es válida.';
      end if;
      if not (item = any (acciones_limpias)) then
        acciones_limpias := acciones_limpias || item;
      end if;
    end loop;
  end if;

  if parametros is not null then
    foreach item in array parametros loop
      if item is null or not (item = any (catalogo_parametros)) then
        raise exception 'Hay una preferencia que no es válida.';
      end if;
      if not (item = any (parametros_limpios)) then
        parametros_limpios := parametros_limpios || item;
      end if;
    end loop;
  end if;

  select coalesce(array_agg(catalogo order by orden), '{}')
  into acciones_ordenadas
  from unnest(catalogo_acciones) with ordinality as lista(catalogo, orden)
  where catalogo = any (acciones_limpias);

  select coalesce(array_agg(catalogo order by orden), '{}')
  into parametros_ordenados
  from unnest(catalogo_parametros) with ordinality as lista(catalogo, orden)
  where catalogo = any (parametros_limpios);

  update public.perfiles
  set tipo_seguimiento = tipo
  where id = usuario;

  insert into public.preferencias_seguimiento (
    usuario_id,
    acciones,
    parametros,
    fecha_actualizacion
  ) values (
    usuario,
    acciones_ordenadas,
    parametros_ordenados,
    now()
  )
  on conflict (usuario_id) do update
  set
    acciones = excluded.acciones,
    parametros = excluded.parametros,
    fecha_actualizacion = now();

  update public.opciones_seguimiento_personalizadas
  set
    prioritaria = id = any (coalesce(opciones_prioritarias, '{}'::uuid[])),
    fecha_actualizacion = now()
  where usuario_id = usuario
    and activa;
end;
$$;

revoke all on function public.normalizar_opcion_seguimiento(text, text, text, text) from public, anon, authenticated;
revoke all on function public.inicializar_preferencias_si_faltan(uuid) from public, anon, authenticated;
revoke all on function public.guardar_tipo_seguimiento(text) from public, anon;
revoke all on function public.crear_opcion_seguimiento(text, text, text, text) from public, anon;
revoke all on function public.editar_opcion_seguimiento(uuid, text, text, text) from public, anon;
revoke all on function public.desactivar_opcion_seguimiento(uuid) from public, anon;
revoke all on function public.guardar_configuracion_seguimiento(text, text[], text[], uuid[]) from public, anon;

grant execute on function public.guardar_tipo_seguimiento(text) to authenticated;
grant execute on function public.crear_opcion_seguimiento(text, text, text, text) to authenticated;
grant execute on function public.editar_opcion_seguimiento(uuid, text, text, text) to authenticated;
grant execute on function public.desactivar_opcion_seguimiento(uuid) to authenticated;
grant execute on function public.guardar_configuracion_seguimiento(text, text[], text[], uuid[]) to authenticated;
