create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  apellido text,
  telefono text,
  nombre_usuario text not null,
  cambios_nombre_usuario integer not null default 0,
  constraint perfiles_nombre_no_vacio check (char_length(trim(nombre)) > 0),
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

grant execute on function public.crear_perfil(text, text, text) to authenticated;
grant execute on function public.guardar_perfil(text, text, text, text) to authenticated;
grant execute on function public.nombre_usuario_disponible(text) to authenticated;
