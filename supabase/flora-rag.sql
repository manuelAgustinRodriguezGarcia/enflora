-- Flora IA — conocimiento editorial (RAG)
-- Aplicar manualmente en el SQL Editor de Supabase después de revisión.
-- Idempotente donde sea posible. No mezcla datos de cultivo privados.

-- ---------------------------------------------------------------------------
-- Extensión pgvector (Supabase: schema extensions)
-- Si ya habilitaste "vector" en Dashboard → Database → Extensions, esto es idempotente.
-- Si falla "permission denied", habilitá vector solo desde el Dashboard y comentá la línea create extension.
-- ---------------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.flora_fuentes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  titulo text not null,
  autor text,
  url text,
  procedencia text,
  condiciones_uso text,
  notas_editoriales text,
  estado text not null default 'activa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flora_fuentes_codigo_unico unique (codigo),
  constraint flora_fuentes_titulo_no_vacio check (char_length(btrim(titulo)) > 0),
  constraint flora_fuentes_estado_valido check (estado in ('activa', 'inactiva'))
);

create table if not exists public.flora_documentos (
  id uuid primary key default gen_random_uuid(),
  fuente_id uuid not null references public.flora_fuentes (id) on delete restrict,
  slug text not null,
  titulo text not null,
  tema text,
  subtema text,
  palabras_clave text[] not null default '{}',
  referencias jsonb not null default '[]'::jsonb,
  estado text not null default 'borrador',
  version text,
  contenido_hash text,
  publicado_en timestamptz,
  incorporado_en date,
  embedding_modelo text,
  embedding_dimension integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flora_documentos_slug_unico unique (slug),
  constraint flora_documentos_titulo_no_vacio check (char_length(btrim(titulo)) > 0),
  constraint flora_documentos_estado_valido check (
    estado in ('borrador', 'revision', 'publicado', 'archivado')
  )
);

create table if not exists public.flora_fragmentos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.flora_documentos (id) on delete cascade,
  seccion_id text not null,
  seccion_titulo text,
  orden integer not null default 0,
  contenido text not null,
  palabras_clave text[] not null default '{}',
  contenido_hash text not null,
  embedding extensions.vector(768),
  embedding_modelo text not null,
  embedding_version text,
  -- to_tsvector no es IMMUTABLE → no puede ser GENERATED; se mantiene con trigger.
  tsv tsvector,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flora_fragmentos_contenido_no_vacio check (char_length(btrim(contenido)) > 0),
  constraint flora_fragmentos_hash_unico unique (documento_id, contenido_hash)
);

create index if not exists flora_documentos_fuente_id_idx on public.flora_documentos (fuente_id);
create index if not exists flora_documentos_estado_idx on public.flora_documentos (estado);
create index if not exists flora_fragmentos_documento_id_idx on public.flora_fragmentos (documento_id);
create index if not exists flora_fragmentos_activo_idx on public.flora_fragmentos (documento_id, activo)
  where activo = true;

create index if not exists flora_fragmentos_tsv_idx on public.flora_fragmentos using gin (tsv);

-- Búsqueda vectorial: con corpus pequeño (<~5k fragmentos) un sequential scan suele bastar.
-- Cuando el corpus crezca, considerar HNSW (mejor recall/latencia en lectura) o IVFFlat (menor RAM):
--   create index flora_fragmentos_embedding_hnsw_idx
--     on public.flora_fragmentos using hnsw (embedding vector_cosine_ops)
--     where activo = true and embedding is not null;

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------

create or replace function public.flora_rag_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.flora_rag_fragmento_tsv()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.tsv :=
    setweight(to_tsvector('spanish', coalesce(new.seccion_titulo, '')), 'A')
    || setweight(to_tsvector('spanish', coalesce(new.contenido, '')), 'B')
    || setweight(
      to_tsvector('simple', coalesce(array_to_string(new.palabras_clave, ' '), '')),
      'A'
    );
  return new;
end;
$$;

drop trigger if exists flora_fuentes_touch on public.flora_fuentes;
create trigger flora_fuentes_touch
  before update on public.flora_fuentes
  for each row execute function public.flora_rag_touch_updated_at();

drop trigger if exists flora_documentos_touch on public.flora_documentos;
create trigger flora_documentos_touch
  before update on public.flora_documentos
  for each row execute function public.flora_rag_touch_updated_at();

drop trigger if exists flora_fragmentos_touch on public.flora_fragmentos;
create trigger flora_fragmentos_touch
  before update on public.flora_fragmentos
  for each row execute function public.flora_rag_touch_updated_at();

drop trigger if exists flora_fragmentos_tsv_trg on public.flora_fragmentos;
create trigger flora_fragmentos_tsv_trg
  before insert or update of seccion_titulo, contenido, palabras_clave
  on public.flora_fragmentos
  for each row execute function public.flora_rag_fragmento_tsv();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.flora_fuentes enable row level security;
alter table public.flora_documentos enable row level security;
alter table public.flora_fragmentos enable row level security;

revoke all on table public.flora_fuentes from public, anon;
revoke all on table public.flora_documentos from public, anon;
revoke all on table public.flora_fragmentos from public, anon;

grant select on table public.flora_fuentes to authenticated;
grant select on table public.flora_documentos to authenticated;
grant select on table public.flora_fragmentos to authenticated;

grant select, insert, update, delete on table public.flora_fuentes to service_role;
grant select, insert, update, delete on table public.flora_documentos to service_role;
grant select, insert, update, delete on table public.flora_fragmentos to service_role;

drop policy if exists flora_fuentes_lectura_publicada on public.flora_fuentes;
create policy flora_fuentes_lectura_publicada
on public.flora_fuentes
for select
to authenticated
using (
  estado = 'activa'
  and exists (
    select 1
    from public.flora_documentos d
    where d.fuente_id = flora_fuentes.id
      and d.estado = 'publicado'
  )
);

drop policy if exists flora_documentos_lectura_publicado on public.flora_documentos;
create policy flora_documentos_lectura_publicado
on public.flora_documentos
for select
to authenticated
using (estado = 'publicado');

drop policy if exists flora_fragmentos_lectura_publicado on public.flora_fragmentos;
create policy flora_fragmentos_lectura_publicado
on public.flora_fragmentos
for select
to authenticated
using (
  activo = true
  and exists (
    select 1
    from public.flora_documentos d
    where d.id = flora_fragmentos.documento_id
      and d.estado = 'publicado'
  )
);

-- Sin políticas INSERT/UPDATE/DELETE para authenticated: solo service_role (ingesta admin).

-- ---------------------------------------------------------------------------
-- Búsqueda híbrida (RRF — Reciprocal Rank Fusion)
-- p_consulta: texto para FTS (websearch_to_tsquery, sin SQL dinámico).
-- p_embedding: vector de la consulta (768); puede ser null → solo FTS + keywords.
-- p_temas: filtro opcional (tema/subtema/palabras clave del documento).
-- ---------------------------------------------------------------------------

create or replace function public.flora_rag_buscar_hibrido(
  p_consulta text,
  p_embedding extensions.vector(768),
  p_temas text[] default null,
  p_limite integer default 5,
  p_umbral double precision default 0
)
returns table (
  fragmento_id uuid,
  documento_slug text,
  seccion_id text,
  seccion_titulo text,
  contenido text,
  palabras_clave text[],
  puntaje double precision,
  titulo_documento text,
  tema text,
  subtema text,
  referencias jsonb,
  version_documento text,
  publicado_en timestamptz,
  incorporado_en date,
  fuente_codigo text,
  fuente_titulo text,
  fuente_autor text,
  fuente_url text,
  fuente_procedencia text,
  condiciones_uso text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with params as (
    select
      least(greatest(coalesce(p_limite, 5), 1), 8) as limite,
      greatest(coalesce(p_umbral, 0), 0.0) as umbral,
      nullif(btrim(coalesce(p_consulta, '')), '') as consulta,
      coalesce(
        (
          select array_agg(lower(btrim(t)))
          from unnest(coalesce(p_temas, '{}'::text[])) as t
          where btrim(coalesce(t, '')) <> ''
        ),
        '{}'::text[]
      ) as temas_norm
  ),
  base as (
    select
      f.id as fragmento_id,
      d.slug as documento_slug,
      f.seccion_id,
      f.seccion_titulo,
      f.contenido,
      f.palabras_clave,
      d.titulo as titulo_documento,
      d.tema,
      d.subtema,
      d.referencias,
      d.version as version_documento,
      d.publicado_en,
      d.incorporado_en,
      fu.codigo as fuente_codigo,
      fu.titulo as fuente_titulo,
      fu.autor as fuente_autor,
      fu.url as fuente_url,
      fu.procedencia as fuente_procedencia,
      fu.condiciones_uso,
      f.embedding,
      f.tsv
    from public.flora_fragmentos f
    join public.flora_documentos d on d.id = f.documento_id
    join public.flora_fuentes fu on fu.id = d.fuente_id
    cross join params p
    where f.activo = true
      and d.estado = 'publicado'
      and fu.estado = 'activa'
      and (
        cardinality(p.temas_norm) = 0
        or exists (
          select 1
          from unnest(p.temas_norm) as tema_filtro(t)
          where lower(coalesce(d.tema, '')) like '%' || t || '%'
            or lower(coalesce(d.subtema, '')) like '%' || t || '%'
            or exists (
              select 1
              from unnest(d.palabras_clave) pk
              where lower(pk) like '%' || t || '%'
            )
        )
      )
  ),
  vec as (
    select
      b.fragmento_id,
      row_number() over (
        order by extensions.cosine_distance(b.embedding, p_embedding)
      ) as rango,
      greatest(0.0, 1.0 - extensions.cosine_distance(b.embedding, p_embedding)) as similitud
    from base b
    cross join params p
    where p_embedding is not null
      and b.embedding is not null
  ),
  fts as (
    select
      b.fragmento_id,
      row_number() over (
        order by ts_rank_cd(b.tsv, websearch_to_tsquery('spanish', p.consulta)) desc nulls last
      ) as rango,
      ts_rank_cd(b.tsv, websearch_to_tsquery('spanish', p.consulta)) as rank_fts
    from base b
    cross join params p
    where p.consulta is not null
      and b.tsv @@ websearch_to_tsquery('spanish', p.consulta)
  ),
  kw_scored as (
    select
      b.fragmento_id,
      (
        select count(*)::double precision
        from unnest(
          regexp_split_to_array(lower(p.consulta), '\s+')
        ) tok
        where char_length(tok) > 1
          and (
            lower(b.contenido) like '%' || tok || '%'
            or lower(coalesce(b.seccion_titulo, '')) like '%' || tok || '%'
            or exists (
              select 1 from unnest(b.palabras_clave) pk where lower(pk) like '%' || tok || '%'
            )
            or lower(coalesce(b.tema, '')) like '%' || tok || '%'
            or lower(coalesce(b.subtema, '')) like '%' || tok || '%'
          )
      ) as score_kw
    from base b
    cross join params p
  ),
  kw as (
    select
      ks.fragmento_id,
      row_number() over (order by ks.score_kw desc) as rango,
      ks.score_kw
    from kw_scored ks
    cross join params p
    where p.consulta is not null
      and ks.score_kw > 0
  ),
  fusion as (
    select
      b.fragmento_id,
      coalesce(1.0 / (60.0 + v.rango), 0.0)
      + coalesce(1.0 / (60.0 + f.rango), 0.0)
      + coalesce(1.0 / (60.0 + k.rango), 0.0) as puntaje_rrf,
      coalesce(v.similitud, 0.0) as similitud
    from base b
    left join vec v on v.fragmento_id = b.fragmento_id
    left join fts f on f.fragmento_id = b.fragmento_id
    left join kw k on k.fragmento_id = b.fragmento_id
    cross join params p
    where v.fragmento_id is not null
      or f.fragmento_id is not null
      or k.fragmento_id is not null
  )
  select
    b.fragmento_id,
    b.documento_slug,
    b.seccion_id,
    b.seccion_titulo,
    b.contenido,
    b.palabras_clave,
    round(fu.puntaje_rrf::numeric, 6)::double precision as puntaje,
    b.titulo_documento,
    b.tema,
    b.subtema,
    b.referencias,
    b.version_documento,
    b.publicado_en,
    b.incorporado_en,
    b.fuente_codigo,
    b.fuente_titulo,
    b.fuente_autor,
    b.fuente_url,
    b.fuente_procedencia,
    b.condiciones_uso
  from fusion fu
  join base b on b.fragmento_id = fu.fragmento_id
  cross join params p
  where p.umbral <= 0
    or fu.similitud >= p.umbral
    or fu.puntaje_rrf >= p.umbral
  order by fu.puntaje_rrf desc, fu.similitud desc
  limit (select limite from params);
$$;

revoke all on function public.flora_rag_buscar_hibrido(text, extensions.vector(768), text[], integer, double precision)
  from public, anon;
grant execute on function public.flora_rag_buscar_hibrido(text, extensions.vector(768), text[], integer, double precision)
  to authenticated, service_role;
