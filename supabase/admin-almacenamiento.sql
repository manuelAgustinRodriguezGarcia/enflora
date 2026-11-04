-- ENFLORA · Admin · almacenamiento real de Supabase Storage.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase.
-- Es idempotente: se puede correr más de una vez.
--
-- Lee storage.objects una sola vez y devuelve agregados.
-- No lista rutas, no firma URLs y no usa el tamaño declarado en registro_fotos.
-- No mide el tamaño de PostgreSQL, el tráfico ni lo facturado.
-- No crea un cron. La ocupación histórica no se puede reconstruir sin snapshots.
--
-- Medición periódica propuesta, sin activar:
--   create table public.admin_almacenamiento_mediciones (
--     medido_en timestamptz primary key default now(),
--     objetos bigint not null,
--     bytes bigint,
--     bytes_completos boolean not null
--   );
-- Un cron futuro podría insertar una fila por día. Este archivo no lo crea.

create or replace function public.almacenamiento_admin_bytes(p_metadata jsonb)
returns bigint
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when p_metadata is null then null
    when pg_catalog.jsonb_typeof(p_metadata -> 'size') in ('number', 'string')
      and (p_metadata ->> 'size') ~ '^[0-9]{1,15}$'
      then (p_metadata ->> 'size')::bigint
    when pg_catalog.jsonb_typeof(p_metadata -> 'contentLength') in ('number', 'string')
      and (p_metadata ->> 'contentLength') ~ '^[0-9]{1,15}$'
      then (p_metadata ->> 'contentLength')::bigint
    else null
  end;
$$;

create or replace function public.almacenamiento_admin_categoria(p_bucket text, p_nombre text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when p_bucket = 'enflora-fotos'
      and p_nombre ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/registros/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_m\.(webp|jpg|png)$'
      then 'miniaturas'
    when p_bucket = 'enflora-fotos'
      and p_nombre ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/portadas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_m\.(webp|jpg|png)$'
      then 'miniaturas'
    when p_bucket = 'enflora-fotos'
      and p_nombre ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/registros/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
      then 'registros'
    when p_bucket = 'enflora-fotos'
      and p_nombre ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/portadas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
      then 'portadas'
    when p_bucket = 'enflora-fotos'
      and p_nombre ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/flora/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
      then 'flora'
    when p_bucket in ('avatars', 'geneticas-imagenes') then 'otros'
    else 'sin_clasificar'
  end;
$$;

create or replace function public.resumen_almacenamiento_admin(
  p_desde timestamptz,
  p_hasta timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_objetos bigint;
  v_con_tamano bigint;
  v_bytes bigint;
  v_imagenes bigint;
  v_sin_mime bigint;
  v_promedio bigint;
  v_ultimo timestamptz;
  v_anadidos bigint;
  v_anadidos_con_tamano bigint;
  v_anadidos_bytes bigint;
begin
  if p_desde is null
    or p_hasta is null
    or p_hasta <= p_desde
    or p_hasta > p_desde + interval '366 days'
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  with objetos as (
    select
      o.bucket_id,
      o.created_at,
      o.updated_at,
      public.almacenamiento_admin_categoria(o.bucket_id, o.name) as categoria,
      public.almacenamiento_admin_bytes(o.metadata) as bytes,
      case
        when o.metadata is null then null
        when pg_catalog.jsonb_typeof(o.metadata -> 'mimetype') <> 'string' then null
        when (o.metadata ->> 'mimetype') ~* '^[a-z0-9][a-z0-9.+-]{0,40}/[a-z0-9][a-z0-9.+-]{0,40}$'
          then pg_catalog.lower(o.metadata ->> 'mimetype')
        else null
      end as mime
    from storage.objects as o
  ),
  totales as (
    select
      pg_catalog.count(*)::bigint as objetos,
      pg_catalog.count(bytes)::bigint as con_tamano,
      case when pg_catalog.count(bytes) = 0 then null else pg_catalog.sum(bytes)::bigint end as bytes,
      pg_catalog.count(*) filter (where mime like 'image/%')::bigint as imagenes,
      pg_catalog.count(*) filter (where mime is null)::bigint as sin_mime,
      case
        when pg_catalog.count(bytes) = 0 then null
        else pg_catalog.round(pg_catalog.sum(bytes) / pg_catalog.count(bytes))::bigint
      end as promedio,
      pg_catalog.max(updated_at) as ultimo,
      pg_catalog.count(*) filter (where created_at >= p_desde and created_at < p_hasta)::bigint as anadidos,
      pg_catalog.count(bytes) filter (where created_at >= p_desde and created_at < p_hasta)::bigint as anadidos_con_tamano,
      case
        when pg_catalog.count(bytes) filter (where created_at >= p_desde and created_at < p_hasta) = 0 then null
        else pg_catalog.sum(bytes) filter (where created_at >= p_desde and created_at < p_hasta)::bigint
      end as anadidos_bytes
    from objetos
  )
  select objetos, con_tamano, bytes, imagenes, sin_mime, promedio, ultimo, anadidos, anadidos_con_tamano, anadidos_bytes
  into v_objetos, v_con_tamano, v_bytes, v_imagenes, v_sin_mime, v_promedio, v_ultimo, v_anadidos, v_anadidos_con_tamano, v_anadidos_bytes
  from totales;

  return (
    with objetos as (
      select
        o.bucket_id,
        o.created_at,
        public.almacenamiento_admin_categoria(o.bucket_id, o.name) as categoria,
        public.almacenamiento_admin_bytes(o.metadata) as bytes,
        case
          when o.metadata is null then null
          when pg_catalog.jsonb_typeof(o.metadata -> 'mimetype') <> 'string' then null
          when (o.metadata ->> 'mimetype') ~* '^[a-z0-9][a-z0-9.+-]{0,40}/[a-z0-9][a-z0-9.+-]{0,40}$'
            then pg_catalog.lower(o.metadata ->> 'mimetype')
          else null
        end as mime
      from storage.objects as o
    ),
    dias as (
      select gs::date as dia
      from pg_catalog.generate_series(
        (p_desde at time zone 'America/Argentina/Buenos_Aires')::date,
        ((p_hasta - interval '1 millisecond') at time zone 'America/Argentina/Buenos_Aires')::date,
        interval '1 day'
      ) as gs
    ),
    por_dia as (
      select
        (u.created_at at time zone 'America/Argentina/Buenos_Aires')::date as dia,
        pg_catalog.count(*)::bigint as objetos,
        case
          when pg_catalog.count(*) = 0 then null
          when pg_catalog.count(u.bytes) = 0 then null
          else pg_catalog.sum(u.bytes)::bigint
        end as bytes
      from objetos as u
      where u.created_at >= p_desde and u.created_at < p_hasta
      group by 1
    ),
    buckets as (
      select
        case
          when b.id ~ '^[a-z0-9][a-z0-9_-]{0,63}$' then b.id
          else 'sin_clasificar'
        end as bucket,
        pg_catalog.count(u.bucket_id)::bigint as objetos,
        case
          when pg_catalog.count(u.bucket_id) = 0 then 0
          when pg_catalog.count(u.bytes) = 0 then null
          else pg_catalog.sum(u.bytes)::bigint
        end as bytes,
        (pg_catalog.count(u.bucket_id) - pg_catalog.count(u.bytes))::bigint as objetos_sin_tamano
      from storage.buckets as b
      left join objetos as u on u.bucket_id = b.id
      group by 1
      union all
      select
        case
          when u.bucket_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$' then u.bucket_id
          else 'sin_clasificar'
        end as bucket,
        pg_catalog.count(*)::bigint as objetos,
        case
          when pg_catalog.count(u.bytes) = 0 then null
          else pg_catalog.sum(u.bytes)::bigint
        end as bytes,
        (pg_catalog.count(*) - pg_catalog.count(u.bytes))::bigint as objetos_sin_tamano
      from objetos as u
      where not exists (
        select 1 from storage.buckets as b where b.id = u.bucket_id
      )
      group by 1
    ),
    categorias as (
      select categoria
      from (
        values ('registros'), ('portadas'), ('flora'), ('miniaturas'), ('otros'), ('sin_clasificar')
      ) as lista(categoria)
    )
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'medido_en', pg_catalog.now(),
      'desde', p_desde,
      'hasta', p_hasta,
      'objetos', coalesce(v_objetos, 0),
      'bytes', case when coalesce(v_objetos, 0) = 0 then 0 else v_bytes end,
      'bytes_completos', coalesce(v_objetos, 0) = 0 or coalesce(v_objetos, 0) = coalesce(v_con_tamano, 0),
      'objetos_sin_tamano', coalesce(v_objetos, 0) - coalesce(v_con_tamano, 0),
      'imagenes', coalesce(v_imagenes, 0),
      'objetos_sin_mime', coalesce(v_sin_mime, 0),
      'promedio_bytes', v_promedio,
      'ultimo_objeto_en', v_ultimo,
      'ocupacion_historica_disponible', false,
      'anadidos_objetos', coalesce(v_anadidos, 0),
      'anadidos_bytes', case
        when coalesce(v_anadidos, 0) = 0 then 0
        when coalesce(v_anadidos, 0) = coalesce(v_anadidos_con_tamano, 0) then v_anadidos_bytes
        else v_anadidos_bytes
      end,
      'anadidos_sin_tamano', coalesce(v_anadidos, 0) - coalesce(v_anadidos_con_tamano, 0),
      'por_bucket', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'bucket', q.bucket,
          'objetos', q.objetos,
          'bytes', q.bytes,
          'objetos_sin_tamano', q.objetos_sin_tamano
        ) order by q.objetos desc, q.bucket)
        from (
          select bucket, pg_catalog.sum(objetos)::bigint as objetos,
            case when pg_catalog.sum(objetos) = 0 then 0 when pg_catalog.count(bytes) = 0 then null else pg_catalog.sum(bytes)::bigint end as bytes,
            pg_catalog.sum(objetos_sin_tamano)::bigint as objetos_sin_tamano
          from buckets
          group by bucket
        ) as q
      ), '[]'::jsonb),
      'por_categoria', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'categoria', c.categoria,
          'objetos', coalesce(a.objetos, 0),
          'bytes', case
            when coalesce(a.objetos, 0) = 0 then 0
            when coalesce(a.con_tamano, 0) = 0 then null
            else a.bytes
          end,
          'objetos_sin_tamano', coalesce(a.objetos, 0) - coalesce(a.con_tamano, 0)
        ) order by c.categoria)
        from categorias as c
        left join (
          select
            categoria,
            pg_catalog.count(*)::bigint as objetos,
            pg_catalog.count(bytes)::bigint as con_tamano,
            pg_catalog.sum(bytes)::bigint as bytes
          from objetos
          group by categoria
        ) as a on a.categoria = c.categoria
      ), '[]'::jsonb),
      'por_mime', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'mime', m.mime,
          'objetos', m.objetos,
          'bytes', m.bytes
        ) order by m.objetos desc, m.mime)
        from (
          select
            coalesce(mime, 'sin_tipo') as mime,
            pg_catalog.count(*)::bigint as objetos,
            case when pg_catalog.count(bytes) = 0 then null else pg_catalog.sum(bytes)::bigint end as bytes
          from objetos
          group by 1
          order by pg_catalog.count(*) desc, 1
          limit 12
        ) as m
      ), '[]'::jsonb),
      'serie', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'dia', d.dia,
          'objetos', coalesce(p.objetos, 0),
          'bytes', case
            when coalesce(p.objetos, 0) = 0 then 0
            else p.bytes
          end
        ) order by d.dia)
        from dias as d
        left join por_dia as p on p.dia = d.dia
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.almacenamiento_admin_bytes(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.almacenamiento_admin_categoria(text, text) from public, anon, authenticated, service_role;
revoke all on function public.resumen_almacenamiento_admin(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.resumen_almacenamiento_admin(timestamptz, timestamptz) to service_role;
