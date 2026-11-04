-- ENFLORA · Ubicación meteorológica de espacios exteriores.
-- Aplicar manualmente en el SQL Editor de Supabase. No ejecutar desde la app.
--
-- La caché y el contador de consultas solo los usa el servidor (service_role).
-- Condiciones actuales: la app guarda la respuesta como máximo 30 minutos
-- (el proveedor admite hasta 60). El pronóstico viaja en la misma respuesta.
-- Los avisos push de clima no forman parte de esta migración.

create table if not exists public.ubicaciones_clima (
  espacio_id uuid primary key references public.espacios (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  region text,
  pais text,
  latitud double precision not null,
  longitud double precision not null,
  zona_horaria text,
  proveedor text not null default 'weatherapi',
  proveedor_lugar_id bigint not null,
  actualizado_en timestamptz not null default now(),
  constraint ubicaciones_clima_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint ubicaciones_clima_latitud check (latitud >= -90 and latitud <= 90),
  constraint ubicaciones_clima_longitud check (longitud >= -180 and longitud <= 180),
  constraint ubicaciones_clima_proveedor check (proveedor = 'weatherapi'),
  constraint ubicaciones_clima_lugar check (proveedor_lugar_id > 0),
  constraint ubicaciones_clima_zona check (
    zona_horaria is null or char_length(trim(zona_horaria)) > 0
  )
);

create index if not exists ubicaciones_clima_usuario_id_idx
on public.ubicaciones_clima (usuario_id);

create table if not exists public.clima_cache (
  clave text primary key,
  obtenido_en timestamptz not null,
  vence_en timestamptz not null,
  cuerpo jsonb not null,
  constraint clima_cache_clave_no_vacia check (char_length(trim(clave)) > 0),
  constraint clima_cache_vigencia check (vence_en > obtenido_en),
  constraint clima_cache_cuerpo_objeto check (jsonb_typeof(cuerpo) = 'object' or jsonb_typeof(cuerpo) = 'array')
);

create table if not exists public.clima_consumo (
  alcance text not null,
  ventana timestamptz not null,
  consultas integer not null default 0,
  primary key (alcance, ventana),
  constraint clima_consumo_alcance_no_vacio check (char_length(trim(alcance)) > 0),
  constraint clima_consumo_consultas check (consultas >= 0)
);

create or replace function public.ubicacion_clima_coherente()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  dueno uuid;
  tipo_espacio text;
begin
  select usuario_id, tipo into dueno, tipo_espacio
  from public.espacios
  where id = new.espacio_id;

  if dueno is null then
    raise exception 'No se encontró el espacio.';
  end if;

  if tipo_espacio is distinct from 'exterior' then
    raise exception 'La ubicación meteorológica solo aplica a un espacio exterior.';
  end if;

  if new.usuario_id is distinct from dueno then
    raise exception 'La ubicación no corresponde al dueño del espacio.';
  end if;

  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists ubicaciones_clima_coherente on public.ubicaciones_clima;
create trigger ubicaciones_clima_coherente
before insert or update on public.ubicaciones_clima
for each row execute function public.ubicacion_clima_coherente();

create or replace function public.quitar_clima_si_interior()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tipo is distinct from 'exterior' and old.tipo = 'exterior' then
    delete from public.ubicaciones_clima where espacio_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists espacios_quita_clima_interior on public.espacios;
create trigger espacios_quita_clima_interior
after update of tipo on public.espacios
for each row execute function public.quitar_clima_si_interior();

create or replace function public.consumir_clima(
  p_alcance text,
  p_ventana timestamptz,
  p_limite integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actual integer;
begin
  if p_alcance is null or char_length(trim(p_alcance)) = 0 or p_ventana is null or p_limite is null or p_limite < 1 then
    return false;
  end if;

  insert into public.clima_consumo as consumo (alcance, ventana, consultas)
  values (p_alcance, p_ventana, 1)
  on conflict (alcance, ventana)
  do update set consultas = consumo.consultas + 1
  where consumo.consultas < p_limite
  returning consultas into actual;

  return actual is not null;
end;
$$;

create or replace function public.devolver_clima(p_alcance text, p_ventana timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clima_consumo
  set consultas = greatest(consultas - 1, 0)
  where alcance = p_alcance
    and ventana = p_ventana;
end;
$$;

alter table public.ubicaciones_clima enable row level security;
alter table public.clima_cache enable row level security;
alter table public.clima_consumo enable row level security;

drop policy if exists usuario_gestiona_su_ubicacion_clima on public.ubicaciones_clima;
create policy usuario_gestiona_su_ubicacion_clima
on public.ubicaciones_clima
for all
to authenticated
using (auth.uid() = usuario_id)
with check (
  auth.uid() = usuario_id
  and exists (
    select 1
    from public.espacios
    where espacios.id = ubicaciones_clima.espacio_id
      and espacios.usuario_id = auth.uid()
      and espacios.tipo = 'exterior'
  )
);

revoke all on public.ubicaciones_clima from public, anon;
grant select, insert, update, delete on public.ubicaciones_clima to authenticated;

revoke all on public.clima_cache from public, anon, authenticated;
revoke all on public.clima_consumo from public, anon, authenticated;
grant select, insert, update, delete on public.clima_cache to service_role;
grant select, insert, update, delete on public.clima_consumo to service_role;

revoke all on function public.ubicacion_clima_coherente() from public, anon, authenticated;
revoke all on function public.quitar_clima_si_interior() from public, anon, authenticated;
revoke all on function public.consumir_clima(text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.devolver_clima(text, timestamptz) from public, anon, authenticated;
grant execute on function public.consumir_clima(text, timestamptz, integer) to service_role;
grant execute on function public.devolver_clima(text, timestamptz) to service_role;
