-- El parámetro nombre_usuario tapaba la columna y el cambio de nombre fallaba.
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

  if nullif(trim(coalesce(actual.telefono, '')), '') is not null and telefono_limpio is null then
    raise exception 'El teléfono no se puede dejar vacío.';
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
    from public.perfiles as otro
    where otro.nombre_usuario = usuario_limpio
      and otro.id <> usuario
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
