-- ENFLORA · Genéticas (StrainAPI y biblioteca personal).
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase, DESPUÉS de supabase/esquema.sql
-- (la tabla public.plantas tiene que existir). Es idempotente.
--
-- Qué agrega:
--   1. Tabla public.geneticas, privada por usuario.
--   2. plantas.genetica_id, opcional. plantas.genetica (texto) no se modifica ni se borra.
--   3. Bucket privado geneticas-imagenes y políticas de Storage por carpeta del usuario.
--
-- Qué no hace:
--   No copia el catálogo de StrainAPI.
--   No reescribe plantas, registros, registro_plantas ni funciones RPC.
--   No cambia políticas RLS de otras tablas.
--   Una ficha de StrainAPI se guarda solo cuando ese usuario la elige, como copia propia.
--   Las imágenes externas no se almacenan: imagen_ruta queda null si el origen es strainapi.

-- ---------------------------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------------------------

create table if not exists public.geneticas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  origen text not null,
  id_externo text,
  slug text,
  nombre text not null,
  imagen_ruta text,
  thc_valor numeric(5, 2),
  thc_min numeric(5, 2),
  thc_max numeric(5, 2),
  cbd_valor numeric(5, 2),
  cbd_min numeric(5, 2),
  cbd_max numeric(5, 2),
  sabor text,
  aroma text,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint geneticas_origen_valido check (origen in ('strainapi', 'personalizada')),
  constraint geneticas_nombre_valido check (char_length(btrim(nombre)) between 1 and 80),
  constraint geneticas_slug_valido check (
    slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint geneticas_strainapi_completa check (
    origen <> 'strainapi'
    or (
      slug is not null
      and id_externo is not null
      and char_length(id_externo) between 1 and 40
      and imagen_ruta is null
    )
  ),
  constraint geneticas_personalizada_sin_externo check (
    origen <> 'personalizada'
    or (slug is null and id_externo is null)
  ),
  constraint geneticas_sabor_largo check (sabor is null or char_length(sabor) <= 400),
  constraint geneticas_aroma_largo check (aroma is null or char_length(aroma) <= 400),
  constraint geneticas_imagen_ruta_valida check (
    imagen_ruta is null
    or imagen_ruta ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png)$'
  ),
  constraint geneticas_thc_valido check (
    (thc_valor is null or (thc_valor >= 0 and thc_valor <= 100))
    and (thc_min is null or (thc_min >= 0 and thc_min <= 100))
    and (thc_max is null or (thc_max >= 0 and thc_max <= 100))
    and (thc_min is null or thc_max is null or thc_min <= thc_max)
  ),
  constraint geneticas_cbd_valido check (
    (cbd_valor is null or (cbd_valor >= 0 and cbd_valor <= 100))
    and (cbd_min is null or (cbd_min >= 0 and cbd_min <= 100))
    and (cbd_max is null or (cbd_max >= 0 and cbd_max <= 100))
    and (cbd_min is null or cbd_max is null or cbd_min <= cbd_max)
  )
);

create unique index if not exists geneticas_personalizada_nombre_idx
on public.geneticas (usuario_id, lower(btrim(nombre)))
where origen = 'personalizada';

create unique index if not exists geneticas_strainapi_slug_idx
on public.geneticas (usuario_id, slug)
where origen = 'strainapi';

create index if not exists geneticas_usuario_nombre_idx
on public.geneticas (usuario_id, lower(nombre));

alter table public.geneticas enable row level security;

drop policy if exists geneticas_lee_propias on public.geneticas;
create policy geneticas_lee_propias
on public.geneticas
for select
to authenticated
using (auth.uid() = usuario_id);

drop policy if exists geneticas_inserta_propias on public.geneticas;
create policy geneticas_inserta_propias
on public.geneticas
for insert
to authenticated
with check (auth.uid() = usuario_id);

drop policy if exists geneticas_actualiza_propias on public.geneticas;
create policy geneticas_actualiza_propias
on public.geneticas
for update
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

drop policy if exists geneticas_borra_propias on public.geneticas;
create policy geneticas_borra_propias
on public.geneticas
for delete
to authenticated
using (auth.uid() = usuario_id);

revoke all on public.geneticas from anon;
grant select, insert, update, delete on public.geneticas to authenticated;

create or replace function public.geneticas_marcar_actualizacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists geneticas_actualizacion on public.geneticas;
create trigger geneticas_actualizacion
before update on public.geneticas
for each row execute function public.geneticas_marcar_actualizacion();

-- ---------------------------------------------------------------------------
-- 2. Vínculo opcional en plantas. El texto plantas.genetica sigue siendo la
--    etiqueta que usan historial, filtros, agrupaciones y registros.
-- ---------------------------------------------------------------------------

alter table public.plantas
  add column if not exists genetica_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plantas_genetica_id_fkey'
      and conrelid = 'public.plantas'::regclass
  ) then
    alter table public.plantas
      add constraint plantas_genetica_id_fkey
      foreign key (genetica_id) references public.geneticas (id) on delete set null;
  end if;
end;
$$;

create index if not exists plantas_genetica_id_idx
on public.plantas (genetica_id);

-- ---------------------------------------------------------------------------
-- 3. Bucket privado de imágenes propias. Sin política de UPDATE.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'geneticas-imagenes',
  'geneticas-imagenes',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists geneticas_imagenes_lee_propias on storage.objects;
create policy geneticas_imagenes_lee_propias
on storage.objects
for select
to authenticated
using (
  bucket_id = 'geneticas-imagenes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists geneticas_imagenes_sube_propias on storage.objects;
create policy geneticas_imagenes_sube_propias
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'geneticas-imagenes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists geneticas_imagenes_borra_propias on storage.objects;
create policy geneticas_imagenes_borra_propias
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'geneticas-imagenes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- La foto de StrainAPI no se copia al bucket. Solo se guarda el enlace https de strainapi.com.
alter table public.geneticas add column if not exists imagen_url text;

alter table public.geneticas drop constraint if exists geneticas_imagen_url_valida;
alter table public.geneticas add constraint geneticas_imagen_url_valida check (
  imagen_url is null
  or (
    origen = 'strainapi'
    and char_length(imagen_url) <= 500
    and imagen_url ~ '^https://(www\.)?strainapi\.com/.+'
  )
);
