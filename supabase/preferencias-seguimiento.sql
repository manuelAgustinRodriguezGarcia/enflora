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
