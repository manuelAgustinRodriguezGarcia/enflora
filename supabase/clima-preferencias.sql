-- ENFLORA · Localidad y preferencia de clima del usuario.
-- Aplicar manualmente en el SQL Editor de Supabase, después de clima-ubicaciones.sql.
-- No ejecutar desde la app.
--
-- La localidad es de la cuenta: no hace falta un espacio para guardarla.
-- ver_clima en false oculta el clima en el inicio. La caché sigue en clima_cache.

create table if not exists public.preferencias_clima (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  ver_clima boolean not null default true,
  nombre text,
  region text,
  pais text,
  latitud double precision,
  longitud double precision,
  zona_horaria text,
  proveedor text,
  proveedor_lugar_id bigint,
  actualizado_en timestamptz not null default now(),
  constraint preferencias_clima_localidad check (
    (
      nombre is null
      and latitud is null
      and longitud is null
      and proveedor is null
      and proveedor_lugar_id is null
    )
    or (
      nombre is not null
      and char_length(trim(nombre)) > 0
      and latitud is not null
      and longitud is not null
      and proveedor = 'weatherapi'
      and proveedor_lugar_id is not null
      and proveedor_lugar_id > 0
    )
  ),
  constraint preferencias_clima_latitud check (latitud is null or (latitud >= -90 and latitud <= 90)),
  constraint preferencias_clima_longitud check (longitud is null or (longitud >= -180 and longitud <= 180)),
  constraint preferencias_clima_zona check (
    zona_horaria is null or char_length(trim(zona_horaria)) > 0
  )
);

create or replace function public.preferencias_clima_actualizado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists preferencias_clima_marca on public.preferencias_clima;
create trigger preferencias_clima_marca
before insert or update on public.preferencias_clima
for each row execute function public.preferencias_clima_actualizado();

alter table public.preferencias_clima enable row level security;

drop policy if exists usuario_gestiona_su_preferencia_clima on public.preferencias_clima;
create policy usuario_gestiona_su_preferencia_clima
on public.preferencias_clima
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

revoke all on public.preferencias_clima from public, anon;
grant select, insert, update, delete on public.preferencias_clima to authenticated;

revoke all on function public.preferencias_clima_actualizado() from public, anon, authenticated;
