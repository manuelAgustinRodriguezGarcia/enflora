-- ENFLORA · Control de importaciones de cultivo (opcional).
-- NO se ejecuta automáticamente. Aplicar a mano en el SQL Editor si se desea
-- persistencia remota además del archivo local private/importaciones/*.json

create table if not exists public.importaciones_cultivo (
  import_id text primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  espacio_id uuid references public.espacios (id) on delete set null,
  unidad_id uuid references public.unidades_cultivo (id) on delete set null,
  estado text not null,
  payload jsonb not null default '{}'::jsonb,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint importaciones_cultivo_estado_valido check (
    estado in ('in_progress', 'complete', 'rolled_back')
  )
);

create index if not exists importaciones_cultivo_usuario_idx
on public.importaciones_cultivo (usuario_id);

alter table public.importaciones_cultivo enable row level security;

drop policy if exists usuario_gestiona_sus_importaciones on public.importaciones_cultivo;
create policy usuario_gestiona_sus_importaciones
on public.importaciones_cultivo
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

grant select, insert, update, delete on public.importaciones_cultivo to authenticated;
