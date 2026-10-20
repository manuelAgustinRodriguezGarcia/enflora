create table public.espacios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null,
  fecha_creacion timestamptz not null default now(),
  constraint espacios_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint espacios_tipo_valido check (tipo in ('interior', 'exterior'))
);

create table public.unidades_cultivo (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios (id) on delete cascade,
  nombre text not null,
  tipo text not null,
  tipo_personalizado text,
  numero integer not null,
  fecha_creacion timestamptz not null default now(),
  constraint unidades_cultivo_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint unidades_cultivo_tipo_valido check (tipo in ('carpa', 'sala', 'invernadero', 'aire_libre', 'otro')),
  constraint unidades_cultivo_tipo_personalizado check (
    (tipo = 'otro' and tipo_personalizado is not null and char_length(trim(tipo_personalizado)) > 0)
    or (tipo <> 'otro' and tipo_personalizado is null)
  ),
  constraint unidades_cultivo_numero_positivo check (numero > 0),
  constraint unidades_cultivo_espacio_numero_unico unique (espacio_id, numero)
);

create table public.plantas (
  id uuid primary key default gen_random_uuid(),
  unidad_cultivo_id uuid not null references public.unidades_cultivo (id) on delete cascade,
  numero integer,
  nombre text not null,
  genetica text,
  metodo text,
  sustrato text,
  etapa text,
  fecha_inicio date,
  estado text not null default 'activa',
  fecha_creacion timestamptz not null default now(),
  constraint plantas_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint plantas_estado_valido check (estado in ('activa', 'finalizada')),
  constraint plantas_numero_positivo check (numero is null or numero > 0),
  constraint plantas_etapa_valida check (
    etapa is null or etapa in ('germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado')
  )
);

create index espacios_usuario_id_idx on public.espacios (usuario_id);
create index unidades_cultivo_espacio_id_idx on public.unidades_cultivo (espacio_id);
create index plantas_unidad_cultivo_id_idx on public.plantas (unidad_cultivo_id);
create unique index plantas_unidad_numero_idx
on public.plantas (unidad_cultivo_id, numero)
where numero is not null;

alter table public.espacios enable row level security;
alter table public.unidades_cultivo enable row level security;
alter table public.plantas enable row level security;

create policy usuario_gestiona_sus_espacios
on public.espacios
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create policy usuario_gestiona_sus_unidades
on public.unidades_cultivo
for all
to authenticated
using (
  exists (
    select 1
    from public.espacios
    where espacios.id = unidades_cultivo.espacio_id
      and espacios.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.espacios
    where espacios.id = unidades_cultivo.espacio_id
      and espacios.usuario_id = auth.uid()
  )
);

create policy usuario_gestiona_plantas_de_sus_unidades
on public.plantas
for all
to authenticated
using (
  exists (
    select 1
    from public.unidades_cultivo
    join public.espacios on espacios.id = unidades_cultivo.espacio_id
    where unidades_cultivo.id = plantas.unidad_cultivo_id
      and espacios.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.unidades_cultivo
    join public.espacios on espacios.id = unidades_cultivo.espacio_id
    where unidades_cultivo.id = plantas.unidad_cultivo_id
      and espacios.usuario_id = auth.uid()
  )
);

create or replace function public.unidad_coherente_con_espacio()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  tipo_espacio text;
begin
  select tipo into tipo_espacio from public.espacios where id = new.espacio_id;

  if tipo_espacio = 'interior' and new.tipo not in ('carpa', 'sala', 'otro') then
    raise exception 'Tipo de unidad no válido para un espacio interior.';
  end if;

  if tipo_espacio = 'exterior' and new.tipo not in ('invernadero', 'aire_libre', 'otro') then
    raise exception 'Tipo de unidad no válido para un espacio exterior.';
  end if;

  return new;
end;
$$;

create trigger unidades_cultivo_tipo_espacio
before insert or update on public.unidades_cultivo
for each row execute function public.unidad_coherente_con_espacio();

create table public.metodos_personalizados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  fecha_creacion timestamptz not null default now(),
  constraint metodos_personalizados_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint metodos_personalizados_usuario_nombre_unico unique (usuario_id, nombre)
);

create index metodos_personalizados_usuario_id_idx
on public.metodos_personalizados (usuario_id);

alter table public.metodos_personalizados enable row level security;

create policy usuario_gestiona_sus_metodos
on public.metodos_personalizados
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create table public.historial_etapas (
  id uuid primary key default gen_random_uuid(),
  planta_id uuid not null references public.plantas (id) on delete cascade,
  etapa text not null,
  fecha_inicio date not null,
  fecha_fin date,
  fecha_creacion timestamptz not null default now(),
  constraint historial_etapas_etapa_valida check (
    etapa in ('germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado')
  ),
  constraint historial_etapas_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index historial_etapas_planta_id_idx on public.historial_etapas (planta_id);
create unique index historial_etapas_una_actual
on public.historial_etapas (planta_id)
where fecha_fin is null;

alter table public.historial_etapas enable row level security;

create policy usuario_gestiona_historial_de_sus_plantas
on public.historial_etapas
for all
to authenticated
using (
  exists (
    select 1
    from public.plantas
    join public.unidades_cultivo on unidades_cultivo.id = plantas.unidad_cultivo_id
    join public.espacios on espacios.id = unidades_cultivo.espacio_id
    where plantas.id = historial_etapas.planta_id
      and espacios.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.plantas
    join public.unidades_cultivo on unidades_cultivo.id = plantas.unidad_cultivo_id
    join public.espacios on espacios.id = unidades_cultivo.espacio_id
    where plantas.id = historial_etapas.planta_id
      and espacios.usuario_id = auth.uid()
  )
);

create or replace function public.cambiar_etapa_planta(
  p_planta_id uuid,
  p_etapa text,
  p_fecha date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  abierta_id uuid;
  abierta_inicio date;
  nuevo_estado text;
begin
  if p_etapa not in ('germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado') then
    raise exception 'Seleccioná una etapa.';
  end if;

  if p_fecha is null then
    raise exception 'La fecha de inicio no es válida.';
  end if;

  if not exists (select 1 from public.plantas where id = p_planta_id) then
    raise exception 'No se encontró la planta.';
  end if;

  select id, fecha_inicio
  into abierta_id, abierta_inicio
  from public.historial_etapas
  where planta_id = p_planta_id
    and fecha_fin is null
  order by fecha_creacion desc
  limit 1;

  if abierta_id is not null and abierta_inicio > p_fecha then
    raise exception 'La fecha no puede ser anterior al inicio de la etapa actual.';
  end if;

  if abierta_id is not null then
    update public.historial_etapas
    set fecha_fin = p_fecha
    where id = abierta_id;
  end if;

  insert into public.historial_etapas (planta_id, etapa, fecha_inicio)
  values (p_planta_id, p_etapa, p_fecha);

  if p_etapa = 'finalizado' then
    nuevo_estado := 'finalizada';
  else
    nuevo_estado := 'activa';
  end if;

  update public.plantas
  set etapa = p_etapa,
      estado = nuevo_estado
  where id = p_planta_id;
end;
$$;

grant select, insert, update, delete on public.espacios to authenticated;
grant select, insert, update, delete on public.unidades_cultivo to authenticated;
grant select, insert, update, delete on public.plantas to authenticated;
grant select, insert, update, delete on public.metodos_personalizados to authenticated;
grant select, insert, update, delete on public.historial_etapas to authenticated;
grant execute on function public.cambiar_etapa_planta(uuid, text, date) to authenticated;

create or replace function public.cambiar_etapa_plantas(
  p_planta_ids uuid[],
  p_etapa text,
  p_fecha date
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  ids uuid[];
  planta_rec record;
  abierta_id uuid;
  abierta_inicio date;
  nuevo_estado text;
  actualizadas int := 0;
  omitidas int := 0;
  total_encontradas int;
begin
  if p_etapa not in ('germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado') then
    raise exception 'Seleccioná una etapa.';
  end if;

  if p_fecha is null then
    raise exception 'La fecha de inicio no es válida.';
  end if;

  select array_agg(distinct x)
  into ids
  from unnest(coalesce(p_planta_ids, array[]::uuid[])) as t(x)
  where x is not null;

  if ids is null or cardinality(ids) = 0 then
    raise exception 'Seleccioná al menos una planta.';
  end if;

  select count(*)
  into total_encontradas
  from public.plantas
  join public.unidades_cultivo on unidades_cultivo.id = plantas.unidad_cultivo_id
  join public.espacios on espacios.id = unidades_cultivo.espacio_id
  where plantas.id = any (ids)
    and espacios.usuario_id = auth.uid();

  if total_encontradas <> cardinality(ids) then
    raise exception 'No se encontró la planta.';
  end if;

  for planta_rec in
    select plantas.id, plantas.etapa
    from public.plantas
    where plantas.id = any (ids)
    order by plantas.numero nulls last, plantas.id
  loop
    if planta_rec.etapa is not distinct from p_etapa then
      omitidas := omitidas + 1;
      continue;
    end if;

    select id, fecha_inicio
    into abierta_id, abierta_inicio
    from public.historial_etapas
    where planta_id = planta_rec.id
      and fecha_fin is null
    order by fecha_creacion desc
    limit 1;

    if abierta_id is not null and abierta_inicio > p_fecha then
      raise exception 'La fecha no puede ser anterior al inicio de la etapa actual.';
    end if;

    if abierta_id is not null then
      update public.historial_etapas
      set fecha_fin = p_fecha
      where id = abierta_id;
    end if;

    insert into public.historial_etapas (planta_id, etapa, fecha_inicio)
    values (planta_rec.id, p_etapa, p_fecha);

    if p_etapa = 'finalizado' then
      nuevo_estado := 'finalizada';
    else
      nuevo_estado := 'activa';
    end if;

    update public.plantas
    set etapa = p_etapa,
        estado = nuevo_estado
    where id = planta_rec.id;

    actualizadas := actualizadas + 1;
  end loop;

  if actualizadas = 0 then
    raise exception 'Ninguna planta necesita cambio.';
  end if;

  return jsonb_build_object(
    'actualizadas', actualizadas,
    'omitidas', omitidas
  );
end;
$$;

grant execute on function public.cambiar_etapa_plantas(uuid[], text, date) to authenticated;

-- Tipo de seguimiento. La tabla perfiles se crea en perfil.sql.
-- En una instalación nueva la columna ya viene en ese archivo.
-- Este bloque la agrega si el perfil ya existía y vuelve a correrse el esquema.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'perfiles'
  ) then
    alter table public.perfiles add column if not exists tipo_seguimiento text;

    alter table public.perfiles drop constraint if exists perfiles_tipo_seguimiento_valido;

    alter table public.perfiles
    add constraint perfiles_tipo_seguimiento_valido
    check (tipo_seguimiento is null or tipo_seguimiento in ('relajado', 'profesional', 'personalizado'));
  end if;
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

revoke all on function public.guardar_tipo_seguimiento(text) from public, anon;
grant execute on function public.guardar_tipo_seguimiento(text) to authenticated;

-- Preferencias de seguimiento.
-- Corre sobre una base que ya tiene public.perfiles.
-- No modifica nombre, usuario, teléfono ni tipo_seguimiento.
-- No crea un preset si el usuario todavía no eligió tipo.

create table if not exists public.preferencias_seguimiento (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.perfiles (id) on delete cascade,
  acciones text[] not null default '{}',
  parametros text[] not null default '{}',
  fecha_actualizacion timestamptz not null default now(),
  constraint preferencias_acciones_validas check (
    acciones <@ array['riego', 'foto', 'nota', 'tarea', 'poda', 'fertilizacion']::text[]
  ),
  constraint preferencias_parametros_validos check (
    parametros <@ array['ph', 'ec', 'ppm', 'temperatura', 'humedad', 'vpd']::text[]
  )
);

alter table public.preferencias_seguimiento enable row level security;

drop policy if exists usuario_lee_sus_preferencias on public.preferencias_seguimiento;

create policy usuario_lee_sus_preferencias
on public.preferencias_seguimiento
for select
to authenticated
using (auth.uid() = usuario_id);

revoke all on table public.preferencias_seguimiento from anon, authenticated;
grant select on table public.preferencias_seguimiento to authenticated;

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

create or replace function public.asegurar_preferencias_seguimiento()
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

  perform public.inicializar_preferencias_si_faltan(usuario);
end;
$$;

create or replace function public.guardar_preferencias_seguimiento(
  acciones text[],
  parametros text[]
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
end;
$$;

revoke all on function public.inicializar_preferencias_si_faltan(uuid) from public, anon, authenticated;
revoke all on function public.guardar_tipo_seguimiento(text) from public, anon;
revoke all on function public.asegurar_preferencias_seguimiento() from public, anon;
revoke all on function public.guardar_preferencias_seguimiento(text[], text[]) from public, anon;

grant execute on function public.guardar_tipo_seguimiento(text) to authenticated;
grant execute on function public.asegurar_preferencias_seguimiento() to authenticated;
grant execute on function public.guardar_preferencias_seguimiento(text[], text[]) to authenticated;

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
