-- ENFLORA · Chats guardados (conversación completa privada por usuario).
-- Aplicar manualmente en el SQL Editor. No ejecutar desde la app.
--
-- Complementa flora_soluciones (respuestas sueltas legacy). No toca RAG editorial.

create table if not exists public.flora_chats_guardados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  primera_pregunta text not null,
  mensajes jsonb not null,
  referencias jsonb,
  clave_sesion text not null,
  cantidad_mensajes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flora_chats_titulo_longitud check (
    char_length(trim(titulo)) >= 1
    and char_length(titulo) <= 120
  ),
  constraint flora_chats_primera_pregunta_longitud check (
    char_length(trim(primera_pregunta)) >= 1
    and char_length(primera_pregunta) <= 2000
  ),
  constraint flora_chats_mensajes_es_array check (jsonb_typeof(mensajes) = 'array'),
  constraint flora_chats_cantidad_mensajes_rango check (
    cantidad_mensajes >= 1
    and cantidad_mensajes <= 200
  )
);

create unique index if not exists flora_chats_usuario_sesion_uidx
  on public.flora_chats_guardados (usuario_id, clave_sesion);

create index if not exists flora_chats_usuario_updated_idx
  on public.flora_chats_guardados (usuario_id, updated_at desc);

create index if not exists flora_chats_usuario_created_idx
  on public.flora_chats_guardados (usuario_id, created_at desc);

alter table public.flora_chats_guardados
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A')
    || setweight(to_tsvector('spanish', coalesce(primera_pregunta, '')), 'B')
    || setweight(to_tsvector('spanish', coalesce(mensajes::text, '')), 'C')
  ) stored;

create index if not exists flora_chats_search_idx
  on public.flora_chats_guardados using gin (search_vector);

alter table public.flora_chats_guardados enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flora_chats_guardados' and policyname = 'flora_chats_select_propias'
  ) then
    create policy flora_chats_select_propias on public.flora_chats_guardados
      for select to authenticated
      using (usuario_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flora_chats_guardados' and policyname = 'flora_chats_insert_propias'
  ) then
    create policy flora_chats_insert_propias on public.flora_chats_guardados
      for insert to authenticated
      with check (usuario_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flora_chats_guardados' and policyname = 'flora_chats_update_propias'
  ) then
    create policy flora_chats_update_propias on public.flora_chats_guardados
      for update to authenticated
      using (usuario_id = auth.uid())
      with check (usuario_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flora_chats_guardados' and policyname = 'flora_chats_delete_propias'
  ) then
    create policy flora_chats_delete_propias on public.flora_chats_guardados
      for delete to authenticated
      using (usuario_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.flora_chats_guardados to authenticated;

-- Reemplaza flora_buscar_soluciones_guardadas: soluciones legacy + chats completos.
drop function if exists public.flora_buscar_soluciones_guardadas(text, integer);

create or replace function public.flora_buscar_soluciones_guardadas(
  p_consulta text,
  p_limite integer default 5,
  p_id uuid default null
)
returns table (
  id uuid,
  titulo text,
  pregunta text,
  extracto text,
  fecha_respuesta timestamptz,
  unidad_cultivo_id uuid,
  planta_id uuid,
  tipo_registro text,
  cantidad_mensajes integer
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
  if p_id is not null then
    return query
    select
      s.id,
      s.titulo,
      s.pregunta,
      left(s.respuesta, 320) as extracto,
      s.fecha_respuesta,
      s.unidad_cultivo_id,
      s.planta_id,
      'solucion'::text as tipo_registro,
      2::integer as cantidad_mensajes
    from public.flora_soluciones s
    where s.usuario_id = auth.uid() and s.id = p_id
    union all
    select
      c.id,
      c.titulo,
      c.primera_pregunta as pregunta,
      left(c.primera_pregunta, 320) as extracto,
      c.updated_at as fecha_respuesta,
      null::uuid as unidad_cultivo_id,
      null::uuid as planta_id,
      'chat'::text as tipo_registro,
      c.cantidad_mensajes
    from public.flora_chats_guardados c
    where c.usuario_id = auth.uid() and c.id = p_id
    limit 1;
    return;
  end if;

  if char_length(v_consulta) < 2 then
    return;
  end if;

  v_tsquery := plainto_tsquery('spanish', v_consulta);

  return query
  select * from (
    select
      s.id,
      s.titulo,
      s.pregunta,
      left(s.respuesta, 320) as extracto,
      s.fecha_respuesta,
      s.unidad_cultivo_id,
      s.planta_id,
      'solucion'::text as tipo_registro,
      2::integer as cantidad_mensajes
    from public.flora_soluciones s
    where s.usuario_id = auth.uid()
      and (
        s.search_vector @@ v_tsquery
        or s.titulo ilike '%' || v_consulta || '%'
        or s.pregunta ilike '%' || v_consulta || '%'
      )
    union all
    select
      c.id,
      c.titulo,
      c.primera_pregunta as pregunta,
      left(c.primera_pregunta, 320) as extracto,
      c.updated_at as fecha_respuesta,
      null::uuid as unidad_cultivo_id,
      null::uuid as planta_id,
      'chat'::text as tipo_registro,
      c.cantidad_mensajes
    from public.flora_chats_guardados c
    where c.usuario_id = auth.uid()
      and (
        c.search_vector @@ v_tsquery
        or c.titulo ilike '%' || v_consulta || '%'
        or c.primera_pregunta ilike '%' || v_consulta || '%'
      )
  ) coincidencias
  order by coincidencias.fecha_respuesta desc
  limit v_limite;
end;
$$;

revoke all on function public.flora_buscar_soluciones_guardadas(text, integer, uuid) from public;
grant execute on function public.flora_buscar_soluciones_guardadas(text, integer, uuid) to authenticated;

-- Fragmento de conversación para function calling (sin enviar todo el JSON al modelo).
create or replace function public.flora_obtener_chat_guardado(
  p_id uuid,
  p_max_caracteres integer default 12000
)
returns table (
  id uuid,
  titulo text,
  primera_pregunta text,
  conversacion_texto text,
  cantidad_mensajes integer,
  updated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_max integer := greatest(500, least(coalesce(p_max_caracteres, 12000), 25000));
  v_chat public.flora_chats_guardados%rowtype;
  v_partes text[] := array[]::text[];
  v_elem jsonb;
  v_rol text;
  v_texto text;
  v_out text;
begin
  select * into v_chat
  from public.flora_chats_guardados c
  where c.usuario_id = auth.uid() and c.id = p_id;

  if not found then
    return;
  end if;

  for v_elem in select value from jsonb_array_elements(v_chat.mensajes) as t(value)
  loop
    v_rol := coalesce(v_elem->>'rol', '');
    v_texto := trim(coalesce(v_elem->>'texto', ''));
    if v_texto = '' then
      continue;
    end if;
    if v_rol = 'flora' then
      v_partes := array_append(v_partes, 'Flora: ' || v_texto);
    else
      v_partes := array_append(v_partes, 'Usuario: ' || v_texto);
    end if;
  end loop;

  v_out := array_to_string(v_partes, E'\n\n');
  if char_length(v_out) > v_max then
    v_out := left(v_out, v_max) || E'\n\n[… conversación truncada …]';
  end if;

  return query
  select
    v_chat.id,
    v_chat.titulo,
    v_chat.primera_pregunta,
    v_out,
    v_chat.cantidad_mensajes,
    v_chat.updated_at;
end;
$$;

revoke all on function public.flora_obtener_chat_guardado(uuid, integer) from public;
grant execute on function public.flora_obtener_chat_guardado(uuid, integer) to authenticated;
