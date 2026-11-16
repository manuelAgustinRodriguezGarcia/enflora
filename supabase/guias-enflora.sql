-- Guías interactivas de Enflora.
-- NO se ejecuta sola. Corré este archivo en el SQL editor de Supabase
-- antes de esperar persistencia entre dispositivos.
-- No guarda datos del cultivo: solo el progreso de cada guía por usuario.

create table if not exists public.progreso_guias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  guia_id text not null,
  version integer not null default 1,
  estado text not null default 'no_iniciado',
  paso_id text,
  actualizado_en timestamptz not null default now(),
  constraint progreso_guias_usuario_guia unique (usuario_id, guia_id),
  constraint progreso_guias_estado_valido check (
    estado in ('no_iniciado', 'en_progreso', 'pausado', 'completado', 'omitido')
  ),
  constraint progreso_guias_guia_valida check (
    guia_id in ('bienvenida', 'crear-espacio', 'unidades-plantas', 'conocer-flora')
  ),
  constraint progreso_guias_paso_corto check (paso_id is null or char_length(paso_id) <= 80)
);

create index if not exists progreso_guias_usuario_idx
on public.progreso_guias (usuario_id);

alter table public.progreso_guias enable row level security;

drop policy if exists usuario_lee_su_progreso_guias on public.progreso_guias;
drop policy if exists usuario_inserta_su_progreso_guias on public.progreso_guias;
drop policy if exists usuario_actualiza_su_progreso_guias on public.progreso_guias;
drop policy if exists usuario_borra_su_progreso_guias on public.progreso_guias;

create policy usuario_lee_su_progreso_guias
on public.progreso_guias
for select
to authenticated
using (auth.uid() = usuario_id);

create policy usuario_inserta_su_progreso_guias
on public.progreso_guias
for insert
to authenticated
with check (auth.uid() = usuario_id);

create policy usuario_actualiza_su_progreso_guias
on public.progreso_guias
for update
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create policy usuario_borra_su_progreso_guias
on public.progreso_guias
for delete
to authenticated
using (auth.uid() = usuario_id);

revoke all on table public.progreso_guias from anon, authenticated;
grant select, insert, update, delete on table public.progreso_guias to authenticated;
