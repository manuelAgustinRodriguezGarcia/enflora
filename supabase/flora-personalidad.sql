-- ENFLORA · Preferencias de personalidad de Flora (Sprint 3.7).
-- Aplicar manualmente en el SQL Editor. No ejecutar desde la app.

create table if not exists public.preferencias_flora (
  usuario_id uuid primary key references public.perfiles (id) on delete cascade,
  personalidad text not null default 'cercana_natural',
  fecha_actualizacion timestamptz not null default now(),
  constraint preferencias_flora_personalidad_valida check (
    personalidad in ('cercana_natural', 'cercana_divertida', 'tecnica_profesional')
  )
);

alter table public.preferencias_flora enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'preferencias_flora' and policyname = 'preferencias_flora_select_propias'
  ) then
    create policy preferencias_flora_select_propias on public.preferencias_flora
      for select to authenticated
      using (usuario_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'preferencias_flora' and policyname = 'preferencias_flora_insert_propias'
  ) then
    create policy preferencias_flora_insert_propias on public.preferencias_flora
      for insert to authenticated
      with check (usuario_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'preferencias_flora' and policyname = 'preferencias_flora_update_propias'
  ) then
    create policy preferencias_flora_update_propias on public.preferencias_flora
      for update to authenticated
      using (usuario_id = auth.uid())
      with check (usuario_id = auth.uid());
  end if;
end $$;

revoke all on table public.preferencias_flora from anon;
grant select, insert, update on table public.preferencias_flora to authenticated;
