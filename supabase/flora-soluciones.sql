-- ENFLORA · Soluciones de Flora (biblioteca privada por usuario).
-- Aplicar manualmente en el SQL Editor. No ejecutar desde la app.
--
-- Independiente del RAG editorial (flora_fuentes / flora_documentos / flora_fragmentos).

create table if not exists public.flora_soluciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  pregunta text not null,
  respuesta text not null,
  referencias jsonb,
  unidad_cultivo_id uuid references public.unidades_cultivo (id) on delete set null,
  planta_id uuid references public.plantas (id) on delete set null,
  fecha_respuesta timestamptz not null,
  clave_unica_turno text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flora_soluciones_titulo_longitud check (
    char_length(trim(titulo)) >= 1
    and char_length(titulo) <= 120
  ),
  constraint flora_soluciones_pregunta_longitud check (
    char_length(trim(pregunta)) >= 1
    and char_length(pregunta) <= 2000
  ),
  constraint flora_soluciones_respuesta_longitud check (
    char_length(trim(respuesta)) >= 1
    and char_length(respuesta) <= 50000
  )
);

create unique index if not exists flora_soluciones_usuario_turno_uidx
  on public.flora_soluciones (usuario_id, clave_unica_turno)
  where clave_unica_turno is not null;

create index if not exists flora_soluciones_usuario_fecha_idx
  on public.flora_soluciones (usuario_id, fecha_respuesta desc);

create index if not exists flora_soluciones_usuario_updated_idx
  on public.flora_soluciones (usuario_id, updated_at desc);

alter table public.flora_soluciones
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A')
    || setweight(to_tsvector('spanish', coalesce(pregunta, '')), 'B')
    || setweight(to_tsvector('spanish', coalesce(respuesta, '')), 'C')
  ) stored;

create index if not exists flora_soluciones_search_idx
  on public.flora_soluciones using gin (search_vector);

alter table public.flora_soluciones enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flora_soluciones' and policyname = 'flora_soluciones_select_propias'
  ) then
    create policy flora_soluciones_select_propias on public.flora_soluciones
      for select to authenticated
      using (usuario_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flora_soluciones' and policyname = 'flora_soluciones_insert_propias'
  ) then
    create policy flora_soluciones_insert_propias on public.flora_soluciones
      for insert to authenticated
      with check (usuario_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flora_soluciones' and policyname = 'flora_soluciones_update_propias'
  ) then
    create policy flora_soluciones_update_propias on public.flora_soluciones
      for update to authenticated
      using (usuario_id = auth.uid())
      with check (usuario_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flora_soluciones' and policyname = 'flora_soluciones_delete_propias'
  ) then
    create policy flora_soluciones_delete_propias on public.flora_soluciones
      for delete to authenticated
      using (usuario_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.flora_soluciones to authenticated;

-- Búsqueda para Flora (function calling). Solo filas del usuario autenticado (RLS + auth.uid()).
create or replace function public.flora_buscar_soluciones_guardadas(
  p_consulta text,
  p_limite integer default 5
)
returns table (
  id uuid,
  titulo text,
  pregunta text,
  extracto text,
  fecha_respuesta timestamptz,
  unidad_cultivo_id uuid,
  planta_id uuid
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_consulta text := trim(coalesce(p_consulta, ''));
  v_limite integer := greatest(1, least(coalesce(p_limite, 5), 8));
  v_tsquery tsquery;
begin
  if char_length(v_consulta) < 2 then
    return;
  end if;

  v_tsquery := plainto_tsquery('spanish', v_consulta);

  return query
  select
    s.id,
    s.titulo,
    s.pregunta,
    left(s.respuesta, 320) as extracto,
    s.fecha_respuesta,
    s.unidad_cultivo_id,
    s.planta_id
  from public.flora_soluciones s
  where s.usuario_id = auth.uid()
    and (
      s.search_vector @@ v_tsquery
      or s.titulo ilike '%' || v_consulta || '%'
      or s.pregunta ilike '%' || v_consulta || '%'
    )
  order by
    ts_rank_cd(s.search_vector, v_tsquery) desc nulls last,
    s.fecha_respuesta desc
  limit v_limite;
end;
$$;

revoke all on function public.flora_buscar_soluciones_guardadas(text, integer) from public;
grant execute on function public.flora_buscar_soluciones_guardadas(text, integer) to authenticated;

-- Propuesta futura (no implementada): contribución editorial al RAG compartido
-- 1) opt-in explícito del usuario · 2) propuesta editorial · 3) anonimización
-- 4) redacción general · 5) bibliografía · 6) revisión humana · 7) ingesta admin flora_fuentes.
