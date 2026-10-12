create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  apellido text,
  telefono text,
  nombre_usuario text not null,
  cambios_nombre_usuario integer not null default 0,
  tipo_seguimiento text,
  constraint perfiles_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint perfiles_tipo_seguimiento_valido check (
    tipo_seguimiento is null or tipo_seguimiento in ('relajado', 'profesional', 'personalizado')
  ),
  constraint perfiles_nombre_usuario_no_vacio check (char_length(trim(nombre_usuario)) > 0),
  constraint perfiles_nombre_usuario_unico unique (nombre_usuario),
  constraint perfiles_cambios_nombre_usuario_rango check (cambios_nombre_usuario between 0 and 2)
);

create table public.historial_nombres_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  nombre_anterior text not null,
  nombre_nuevo text not null,
  fecha_cambio timestamptz not null default now()
);

create index historial_nombres_usuario_usuario_id_idx
on public.historial_nombres_usuario (usuario_id);

create or replace function public.normalizar_base_usuario(valor text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      lower(trim(coalesce(valor, ''))),
      'áéíóúüñàèìòùâêîôûäëïöÿ',
      'aeiouunaeiouaeiouaeioy'
    ),
    '[^a-z0-9]',
    '',
    'g'
  );
$$;

create or replace function public.normalizar_nombre_usuario(valor text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      lower(trim(coalesce(valor, ''))),
      'áéíóúüñàèìòùâêîôûäëïöÿ',
      'aeiouunaeiouaeiouaeioy'
    ),
    '[^a-z0-9_]',
    '',
    'g'
  );
$$;

create or replace function public.insertar_perfil(
  usuario uuid,
  nombre_ingresado text,
  apellido_ingresado text,
  telefono_ingresado text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nombre_limpio text := trim(coalesce(nombre_ingresado, ''));
  apellido_limpio text := nullif(trim(coalesce(apellido_ingresado, '')), '');
  telefono_limpio text := nullif(trim(coalesce(telefono_ingresado, '')), '');
  base text;
  candidato text;
  numero integer := 1;
begin
  if nombre_limpio = '' then
    raise exception 'El nombre es obligatorio.';
  end if;

  base := public.normalizar_base_usuario(nombre_limpio);

  if base = '' then
    raise exception 'El nombre es obligatorio.';
  end if;

  loop
    candidato := base || '_ar' || numero;

    begin
      insert into public.perfiles (
        id,
        nombre,
        apellido,
        telefono,
        nombre_usuario,
        cambios_nombre_usuario
      ) values (
        usuario,
        nombre_limpio,
        apellido_limpio,
        telefono_limpio,
        candidato,
        0
      );
      return;
    exception
      when unique_violation then
        if exists (select 1 from public.perfiles where id = usuario) then
          raise exception 'El perfil ya existe.';
        end if;

        numero := numero + 1;

        if numero > 1000 then
          raise exception 'No se pudo crear el nombre de usuario.';
        end if;
    end;
  end loop;
end;
$$;

create or replace function public.crear_perfil_al_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  perform public.insertar_perfil(
    new.id,
    meta->>'nombre',
    meta->>'apellido',
    meta->>'telefono'
  );
  return new;
end;
$$;

drop trigger if exists crear_perfil_al_registrar on auth.users;

create trigger crear_perfil_al_registrar
after insert on auth.users
for each row
execute function public.crear_perfil_al_registrar();

create or replace function public.crear_perfil(
  nombre text,
  apellido text,
  telefono text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No hay sesión.';
  end if;

  if exists (select 1 from public.perfiles where id = auth.uid()) then
    raise exception 'El perfil ya existe.';
  end if;

  perform public.insertar_perfil(auth.uid(), nombre, apellido, telefono);
end;
$$;

create or replace function public.nombre_usuario_disponible(candidato text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  limpio text := public.normalizar_nombre_usuario(candidato);
begin
  if usuario is null or limpio = '' then
    return false;
  end if;

  return not exists (
    select 1
    from public.perfiles
    where nombre_usuario = limpio
      and id <> usuario
  );
end;
$$;

create or replace function public.guardar_perfil(
  nombre text,
  apellido text,
  telefono text,
  nombre_usuario text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  actual public.perfiles%rowtype;
  nombre_limpio text := trim(coalesce(nombre, ''));
  apellido_limpio text := nullif(trim(coalesce(apellido, '')), '');
  telefono_limpio text := nullif(trim(coalesce(telefono, '')), '');
  usuario_limpio text := public.normalizar_nombre_usuario(nombre_usuario);
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if nombre_limpio = '' then
    raise exception 'El nombre es obligatorio.';
  end if;

  select * into actual
  from public.perfiles
  where id = usuario;

  if not found then
    raise exception 'No se encontró el perfil.';
  end if;

  if usuario_limpio = '' then
    raise exception 'El nombre de usuario es obligatorio.';
  end if;

  if usuario_limpio = actual.nombre_usuario then
    update public.perfiles
    set
      nombre = nombre_limpio,
      apellido = apellido_limpio,
      telefono = telefono_limpio
    where id = usuario;
    return;
  end if;

  if actual.cambios_nombre_usuario >= 2 then
    raise exception 'Alcanzaste el límite de cambios de nombre de usuario.';
  end if;

  if exists (
    select 1
    from public.perfiles
    where nombre_usuario = usuario_limpio
      and id <> usuario
  ) then
    raise exception 'Ese nombre de usuario no está disponible.';
  end if;

  update public.perfiles
  set
    nombre = nombre_limpio,
    apellido = apellido_limpio,
    telefono = telefono_limpio,
    nombre_usuario = usuario_limpio,
    cambios_nombre_usuario = actual.cambios_nombre_usuario + 1
  where id = usuario
    and cambios_nombre_usuario = actual.cambios_nombre_usuario;

  if not found then
    raise exception 'No se pudo guardar el perfil.';
  end if;

  insert into public.historial_nombres_usuario (
    usuario_id,
    nombre_anterior,
    nombre_nuevo
  ) values (
    usuario,
    actual.nombre_usuario,
    usuario_limpio
  );
exception
  when unique_violation then
    raise exception 'Ese nombre de usuario no está disponible.';
end;
$$;

alter table public.perfiles enable row level security;
alter table public.historial_nombres_usuario enable row level security;

create policy usuario_lee_su_perfil
on public.perfiles
for select
to authenticated
using (auth.uid() = id);

revoke all on table public.perfiles from anon, authenticated;
revoke all on table public.historial_nombres_usuario from anon, authenticated;
grant select on table public.perfiles to authenticated;

revoke all on function public.insertar_perfil(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.crear_perfil_al_registrar() from public, anon, authenticated;
grant execute on function public.crear_perfil_al_registrar() to supabase_auth_admin;

revoke all on function public.crear_perfil(text, text, text) from public, anon;
revoke all on function public.guardar_perfil(text, text, text, text) from public, anon;
revoke all on function public.nombre_usuario_disponible(text) from public, anon;

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

grant execute on function public.crear_perfil(text, text, text) to authenticated;
grant execute on function public.guardar_perfil(text, text, text, text) to authenticated;
grant execute on function public.nombre_usuario_disponible(text) to authenticated;

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
