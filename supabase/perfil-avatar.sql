-- ENFLORA · Foto de perfil.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase, después de supabase/perfil.sql.
-- Es idempotente: se puede correr más de una vez.
--
-- Qué cambia:
--   1. Columna public.perfiles.avatar_ruta (ruta estable, nunca una URL firmada).
--   2. Bucket privado `avatars` (WEBP o JPEG ya recortado · máx. 1 MB).
--   3. Políticas RLS: cada usuario solo lee, sube y borra dentro de `<su uuid>/`.
--   4. RPC guardar_avatar_perfil / quitar_avatar_perfil. Usan auth.uid() y no aceptan
--      un id de usuario enviado por el cliente.
--
-- Qué NO cambia: nombre, teléfono, usuario, seguimiento ni las políticas de fotos de cultivo.
-- No se desactiva RLS. No hay política de UPDATE en storage: cada foto usa una ruta nueva.

-- ---------------------------------------------------------------------------
-- 1. Referencia estable en el perfil
-- ---------------------------------------------------------------------------

alter table public.perfiles
  add column if not exists avatar_ruta text;

alter table public.perfiles
  drop constraint if exists perfiles_avatar_ruta_valida;

alter table public.perfiles
  add constraint perfiles_avatar_ruta_valida
  check (
    avatar_ruta is null
    or (
      avatar_ruta ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
      and split_part(avatar_ruta, '/', 1) = id::text
    )
  );

comment on column public.perfiles.avatar_ruta is
  'Ruta estable en el bucket privado avatars. No guardar URLs firmadas.';

-- ---------------------------------------------------------------------------
-- 2. Bucket privado
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  1048576,
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 3. Políticas de Storage: solo la carpeta propia (`<auth.uid()>/...`)
-- ---------------------------------------------------------------------------

drop policy if exists avatars_lee_propias on storage.objects;
create policy avatars_lee_propias
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_sube_propias on storage.objects;
create policy avatars_sube_propias
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_borra_propias on storage.objects;
create policy avatars_borra_propias
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- 4. Guardar y quitar. Devuelven la ruta anterior para borrarla después.
-- ---------------------------------------------------------------------------

create or replace function public.guardar_avatar_perfil(ruta text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  anterior text;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if ruta is null
     or ruta !~ ('^' || usuario::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$')
  then
    raise exception 'La ruta del avatar no es válida.';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'avatars'
      and name = ruta
  ) then
    raise exception 'No se encontró la foto.';
  end if;

  select avatar_ruta
  into anterior
  from public.perfiles
  where id = usuario;

  if not found then
    raise exception 'No se encontró el perfil.';
  end if;

  update public.perfiles
  set avatar_ruta = ruta
  where id = usuario;

  return anterior;
end;
$$;

create or replace function public.quitar_avatar_perfil()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  anterior text;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  select avatar_ruta
  into anterior
  from public.perfiles
  where id = usuario;

  if not found then
    raise exception 'No se encontró el perfil.';
  end if;

  update public.perfiles
  set avatar_ruta = null
  where id = usuario;

  return anterior;
end;
$$;

revoke all on function public.guardar_avatar_perfil(text) from public, anon;
revoke all on function public.quitar_avatar_perfil() from public, anon;
grant execute on function public.guardar_avatar_perfil(text) to authenticated;
grant execute on function public.quitar_avatar_perfil() to authenticated;
