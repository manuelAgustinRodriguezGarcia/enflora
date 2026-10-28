-- Flora RAG — verificación post-migración
-- Ejecutar en Supabase → SQL Editor (todo el archivo).
-- No deja datos: la prueba funcional termina en ROLLBACK.
-- Nota: en el Editor corrés como rol con privilegios (bypass RLS). La sección 2 simula lectura publicada.

-- =============================================================================
-- 1) Chequeos estructurales (solo lectura)
-- =============================================================================

select
  prueba,
  resultado,
  detalle
from (
  select
    1 as ord,
    'Extensión pgvector' as prueba,
    case when exists (select 1 from pg_extension where extname = 'vector')
      then 'OK' else 'FALLO' end as resultado,
    coalesce(
      (select 'v' || extversion from pg_extension where extname = 'vector'),
      'Habilitar vector en Database → Extensions'
    ) as detalle

  union all
  select
    2,
    'Función cosine_distance',
    case when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'extensions' and p.proname = 'cosine_distance'
    ) then 'OK' else 'FALLO' end,
    'Requerida para flora_rag_buscar_hibrido'

  union all
  select
    3,
    'Tabla flora_fuentes',
    case when to_regclass('public.flora_fuentes') is not null then 'OK' else 'FALLO' end,
    coalesce(to_regclass('public.flora_fuentes')::text, '—')

  union all
  select
    4,
    'Tabla flora_documentos',
    case when to_regclass('public.flora_documentos') is not null then 'OK' else 'FALLO' end,
    coalesce(to_regclass('public.flora_documentos')::text, '—')

  union all
  select
    5,
    'Tabla flora_fragmentos',
    case when to_regclass('public.flora_fragmentos') is not null then 'OK' else 'FALLO' end,
    coalesce(to_regclass('public.flora_fragmentos')::text, '—')

  union all
  select
    6,
    'Columna embedding vector(768)',
    case when exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'flora_fragmentos'
        and c.column_name = 'embedding'
        and c.udt_schema = 'extensions'
        and c.udt_name = 'vector'
    ) then 'OK' else 'FALLO' end,
    'Tipo extensions.vector'

  union all
  select
    7,
    'Índice GIN tsv',
    case when exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'flora_fragmentos'
        and indexname = 'flora_fragmentos_tsv_idx'
    ) then 'OK' else 'FALLO' end,
    'flora_fragmentos_tsv_idx'

  union all
  select
    8,
    'Trigger tsv fragmentos',
    case when exists (
      select 1 from pg_trigger
      where tgname = 'flora_fragmentos_tsv_trg'
        and tgrelid = 'public.flora_fragmentos'::regclass
    ) then 'OK' else 'FALLO' end,
    'flora_fragmentos_tsv_trg'

  union all
  select
    9,
    'RLS habilitado (3 tablas)',
    case when (
      select count(*) = 3
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('flora_fuentes', 'flora_documentos', 'flora_fragmentos')
        and c.relrowsecurity
    ) then 'OK' else 'FALLO' end,
    'relrowsecurity = true'

  union all
  select
    10,
    'RPC flora_rag_buscar_hibrido',
    case when exists (
      select 1 from pg_proc
      where proname = 'flora_rag_buscar_hibrido'
        and pronamespace = 'public'::regnamespace
    ) then 'OK' else 'FALLO' end,
    'Función de búsqueda híbrida'

  union all
  select
    11,
    'Grant EXECUTE a authenticated',
    case when has_function_privilege(
      'authenticated',
      'public.flora_rag_buscar_hibrido(text, extensions.vector(768), text[], integer, double precision)',
      'EXECUTE'
    ) then 'OK' else 'FALLO' end,
    'Necesario para Edge / cliente con JWT'
) q
order by ord;

-- =============================================================================
-- 2) Prueba funcional (INSERT → borrador invisible → publicado visible → ROLLBACK)
-- =============================================================================

begin;

-- Vector de prueba 768d (mismo para documento y consulta → similitud alta)
create temp table if not exists _flora_vec_prueba (v extensions.vector(768)) on commit drop;
truncate _flora_vec_prueba;
insert into _flora_vec_prueba (v)
select ('[' || string_agg('0.01', ',') || ']')::extensions.vector
from generate_series(1, 768);

do $$
declare
  v_fuente_id uuid;
  v_doc_id uuid;
  v_frag_id uuid;
  v_tsv tsvector;
  v_cnt_borrador int;
  v_cnt_publicado int;
  v_vec extensions.vector(768);
begin
  select v into v_vec from _flora_vec_prueba limit 1;

  insert into public.flora_fuentes (codigo, titulo, estado, notas_editoriales)
  values (
    '__verificacion_enflora__',
    'Solo verificación SQL (rollback)',
    'activa',
    'No es contenido editorial. Se revierte al final.'
  )
  on conflict (codigo) do update set titulo = excluded.titulo
  returning id into v_fuente_id;

  insert into public.flora_documentos (
    fuente_id, slug, titulo, tema, subtema, palabras_clave, estado, version, embedding_modelo, embedding_dimension
  )
  values (
    v_fuente_id,
    '__verificacion-doc__',
    'Doc verificación',
    'hidroponia',
    'rdwc',
    array['rdwc', 'ph', 'ec'],
    'borrador',
    '0',
    'gemini-embedding-2',
    768
  )
  on conflict (slug) do update set estado = 'borrador'
  returning id into v_doc_id;

  insert into public.flora_fragmentos (
    documento_id,
    seccion_id,
    seccion_titulo,
    contenido,
    palabras_clave,
    contenido_hash,
    embedding,
    embedding_modelo,
    embedding_version
  )
  values (
    v_doc_id,
    'parametros',
    'RDWC y pH',
    'Texto técnico de prueba: RDWC, EC, pH y PPM. Solo verificación.',
    array['ppm', 'ec'],
    'hash-verificacion-enflora-001',
    v_vec,
    'gemini-embedding-2',
    '1'
  )
  on conflict (documento_id, contenido_hash) do update
    set contenido = excluded.contenido,
        embedding = excluded.embedding,
        activo = true
  returning id, tsv into v_frag_id, v_tsv;

  if v_tsv is null then
    raise exception 'FALLO: trigger tsv no rellenó flora_fragmentos.tsv';
  end if;

  -- Como postgres/superuser se ven todas las filas; la RPC filtra por estado publicado.
  select count(*) into v_cnt_borrador
  from public.flora_rag_buscar_hibrido('RDWC pH', v_vec, null, 5, 0);

  if v_cnt_borrador <> 0 then
    raise exception 'FALLO: borrador apareció en búsqueda (esperado 0 filas, got %)', v_cnt_borrador;
  end if;

  update public.flora_documentos
  set estado = 'publicado', publicado_en = now()
  where id = v_doc_id;

  select count(*) into v_cnt_publicado
  from public.flora_rag_buscar_hibrido('PPM EC', v_vec, array['rdwc'], 5, 0);

  if v_cnt_publicado < 1 then
    raise exception 'FALLO: documento publicado no aparece en búsqueda (esperado >= 1, got %)', v_cnt_publicado;
  end if;

  raise notice 'OK: prueba funcional RAG — borrador oculto, publicado recuperable, tsv y vector OK';
end $$;

rollback;

-- =============================================================================
-- 3) Resumen esperado
-- =============================================================================
-- • Sección 1: todas las filas con resultado = OK
-- • Sección 2: mensaje NOTICE "OK: prueba funcional RAG..."
-- • ROLLBACK: no queda la fuente __verificacion_enflora__ en la base
--
-- Verificación opcional (debe devolver 0 filas si no ingestaste nada real):
--   select count(*) from public.flora_fuentes where codigo like '__verificacion%';
