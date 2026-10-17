create table if not exists public.comercios_asociados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  rubro text,
  sitio_web text,
  activo boolean not null default false,
  aprobado boolean not null default false,
  plan text not null,
  fecha_inicio date not null,
  fecha_fin date,
  banner_url text,
  banner_enlace text,
  fecha_creacion timestamptz not null default now(),
  constraint comercios_asociados_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint comercios_asociados_plan_valido check (plan in ('presencia', 'visibilidad', 'inteligente')),
  constraint comercios_asociados_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index if not exists comercios_asociados_publicos_idx
on public.comercios_asociados (activo, aprobado, fecha_inicio, fecha_fin);

alter table public.comercios_asociados enable row level security;

drop policy if exists comercios_asociados_lectura_publica on public.comercios_asociados;

create policy comercios_asociados_lectura_publica
on public.comercios_asociados
for select
to anon, authenticated
using (
  aprobado = true
  and activo = true
  and fecha_inicio <= current_date
  and (fecha_fin is null or fecha_fin >= current_date)
);
