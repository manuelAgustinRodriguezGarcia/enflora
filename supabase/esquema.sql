create table public.espacios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null,
  fecha_creacion timestamptz not null default now(),
  constraint espacios_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint espacios_tipo_valido check (tipo in ('interior', 'exterior'))
);

create table public.plantas (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios (id) on delete cascade,
  nombre text not null,
  genetica text,
  fecha_inicio date,
  estado text not null default 'activa',
  fecha_creacion timestamptz not null default now(),
  constraint plantas_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint plantas_estado_valido check (estado in ('activa', 'finalizada'))
);

create index espacios_usuario_id_idx on public.espacios (usuario_id);
create index plantas_espacio_id_idx on public.plantas (espacio_id);

alter table public.espacios enable row level security;
alter table public.plantas enable row level security;

create policy usuario_gestiona_sus_espacios
on public.espacios
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create policy usuario_gestiona_plantas_de_sus_espacios
on public.plantas
for all
to authenticated
using (
  exists (
    select 1
    from public.espacios
    where espacios.id = plantas.espacio_id
      and espacios.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.espacios
    where espacios.id = plantas.espacio_id
      and espacios.usuario_id = auth.uid()
  )
);

grant select, insert, update, delete on public.espacios to authenticated;
grant select, insert, update, delete on public.plantas to authenticated;
