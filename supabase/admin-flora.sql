-- ENFLORA · Admin · Métricas de Flora IA.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- No modifica el chat, las herramientas, el RAG, los planes ni los pagos.
--
-- COALESCE, NULLIF, GREATEST y LEAST quedan sin esquema.
-- El entero de 8 bytes se escribe ::bigint.
--
-- Cada fila es una solicitud. No guarda prompts, respuestas, nombres de plantas,
-- genéticas, imágenes ni observaciones.
-- Los tokens nulos significan que el proveedor no los informó: no se estiman.
-- El costo se congela con la tarifa vigente al guardar. Cambiar precios no reescribe el historial.
-- El catálogo nace vacío. Sin una tarifa cargada a mano, el costo queda no disponible.
-- El importe facturado no se calcula: no hay factura del proveedor en esta base.

create table if not exists public.flora_precios_modelo (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  proveedor text not null,
  modelo text not null,
  modalidad text not null,
  usd_por_millon numeric(14, 6) not null,
  vigente_desde timestamptz not null,
  vigente_hasta timestamptz,
  fuente text not null,
  creado_en timestamptz not null default pg_catalog.now(),
  constraint flora_precios_proveedor check (proveedor = 'google'),
  constraint flora_precios_modelo_nombre check (modelo ~ '^[A-Za-z0-9._:+-]{1,64}$'),
  constraint flora_precios_modalidad check (
    modalidad in ('entrada', 'salida', 'pensamiento', 'cache', 'herramientas')
  ),
  constraint flora_precios_tarifa check (usd_por_millon >= 0),
  constraint flora_precios_vigencia check (vigente_hasta is null or vigente_hasta > vigente_desde),
  constraint flora_precios_fuente check (char_length(btrim(fuente)) between 8 and 200)
);

create index if not exists flora_precios_modelo_vigencia_idx
  on public.flora_precios_modelo (proveedor, modelo, modalidad, vigente_desde desc);

create table if not exists public.flora_uso_solicitudes (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  solicitud_id uuid not null unique,
  usuario_id uuid not null,
  registrado_en timestamptz not null,
  proveedor text not null,
  modelo text not null,
  operacion text not null,
  resultado text not null,
  categoria text,
  duracion_ms integer,
  rondas integer not null,
  tokens_entrada integer,
  tokens_salida integer,
  tokens_total integer,
  tokens_pensamiento integer,
  tokens_cache integer,
  tokens_herramientas integer,
  entrada_completa boolean not null,
  salida_completa boolean not null,
  total_completo boolean not null,
  costo_usd numeric(18, 8),
  costo_estado text not null,
  precios jsonb not null,
  facturado_disponible boolean not null default false,
  constraint flora_uso_proveedor check (proveedor = 'google'),
  constraint flora_uso_modelo check (modelo ~ '^[A-Za-z0-9._:+-]{1,64}$'),
  constraint flora_uso_operacion check (operacion in ('chat', 'chat_imagen')),
  constraint flora_uso_resultado check (
    (resultado = 'exito' and categoria is null)
    or (
      resultado = 'error'
      and categoria in (
        'cuota', 'validacion', 'imagen', 'timeout', 'sin_respuesta', 'proveedor', 'configuracion', 'desconocido'
      )
    )
    or (resultado = 'cancelacion' and categoria = 'cancelacion')
  ),
  constraint flora_uso_duracion check (duracion_ms is null or duracion_ms between 0 and 600000),
  constraint flora_uso_rondas check (rondas between 0 and 20),
  constraint flora_uso_tokens_entrada check (tokens_entrada is null or tokens_entrada between 0 and 50000000),
  constraint flora_uso_tokens_salida check (tokens_salida is null or tokens_salida between 0 and 50000000),
  constraint flora_uso_tokens_total check (tokens_total is null or tokens_total between 0 and 50000000),
  constraint flora_uso_tokens_pensamiento check (tokens_pensamiento is null or tokens_pensamiento between 0 and 50000000),
  constraint flora_uso_tokens_cache check (tokens_cache is null or tokens_cache between 0 and 50000000),
  constraint flora_uso_tokens_herramientas check (tokens_herramientas is null or tokens_herramientas between 0 and 50000000),
  constraint flora_uso_costo check (
    (costo_estado = 'calculado' and costo_usd is not null and costo_usd >= 0)
    or (costo_estado = 'no_disponible' and costo_usd is null)
  ),
  constraint flora_uso_costo_estado check (costo_estado in ('calculado', 'no_disponible')),
  constraint flora_uso_facturado check (facturado_disponible = false)
);

create index if not exists flora_uso_solicitudes_registrado_idx
  on public.flora_uso_solicitudes (registrado_en desc);

alter table public.flora_precios_modelo enable row level security;
alter table public.flora_uso_solicitudes enable row level security;

revoke all on table public.flora_precios_modelo from public, anon, authenticated, service_role;
revoke all on table public.flora_uso_solicitudes from public, anon, authenticated, service_role;

create or replace function public.flora_precio_vigente(
  p_proveedor text,
  p_modelo text,
  p_modalidad text,
  p_momento timestamptz
)
returns table (id uuid, usd_por_millon numeric, vigente_desde timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.usd_por_millon, p.vigente_desde
  from public.flora_precios_modelo as p
  where p.proveedor = p_proveedor
    and p.modelo = p_modelo
    and p.modalidad = p_modalidad
    and p.vigente_desde <= p_momento
    and (p.vigente_hasta is null or p.vigente_hasta > p_momento)
  order by p.vigente_desde desc
  limit 1;
$$;

create or replace function public.registrar_uso_flora(
  p_solicitud uuid,
  p_usuario uuid,
  p_proveedor text,
  p_modelo text,
  p_operacion text,
  p_resultado text,
  p_categoria text,
  p_duracion_ms integer,
  p_rondas integer,
  p_tokens_entrada integer,
  p_tokens_salida integer,
  p_tokens_total integer,
  p_tokens_pensamiento integer,
  p_tokens_cache integer,
  p_tokens_herramientas integer,
  p_entrada_completa boolean,
  p_salida_completa boolean,
  p_total_completo boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_momento timestamptz := pg_catalog.now();
  v_estado text := 'calculado';
  v_costo numeric(18, 8) := 0;
  v_precios jsonb := '{}'::jsonb;
  v_id uuid;
  v_tarifa numeric;
  v_vigente timestamptz;
begin
  if p_solicitud is null
    or p_usuario is null
    or p_proveedor is distinct from 'google'
    or p_modelo is null
    or p_modelo !~ '^[A-Za-z0-9._:+-]{1,64}$'
    or p_operacion is null
    or p_operacion not in ('chat', 'chat_imagen')
    or p_resultado is null
    or p_resultado not in ('exito', 'error', 'cancelacion')
    or (p_resultado = 'exito' and p_categoria is not null)
    or (
      p_resultado = 'error'
      and (
        p_categoria is null
        or p_categoria not in (
          'cuota', 'validacion', 'imagen', 'timeout', 'sin_respuesta', 'proveedor', 'configuracion', 'desconocido'
        )
      )
    )
    or (p_resultado = 'cancelacion' and p_categoria is distinct from 'cancelacion')
    or (p_duracion_ms is not null and (p_duracion_ms < 0 or p_duracion_ms > 600000))
    or p_rondas is null
    or p_rondas < 0
    or p_rondas > 20
    or p_entrada_completa is null
    or p_salida_completa is null
    or p_total_completo is null
    or (p_tokens_entrada is not null and (p_tokens_entrada < 0 or p_tokens_entrada > 50000000))
    or (p_tokens_salida is not null and (p_tokens_salida < 0 or p_tokens_salida > 50000000))
    or (p_tokens_total is not null and (p_tokens_total < 0 or p_tokens_total > 50000000))
    or (p_tokens_pensamiento is not null and (p_tokens_pensamiento < 0 or p_tokens_pensamiento > 50000000))
    or (p_tokens_cache is not null and (p_tokens_cache < 0 or p_tokens_cache > 50000000))
    or (p_tokens_herramientas is not null and (p_tokens_herramientas < 0 or p_tokens_herramientas > 50000000))
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  if p_entrada_completa is not true or p_tokens_entrada is null or p_salida_completa is not true or p_tokens_salida is null then
    v_estado := 'no_disponible';
  end if;

  if v_estado = 'calculado' then
    select f.id, f.usd_por_millon, f.vigente_desde into v_id, v_tarifa, v_vigente
    from public.flora_precio_vigente(p_proveedor, p_modelo, 'entrada', v_momento) as f;
    if v_id is null then
      v_estado := 'no_disponible';
    else
      v_costo := v_costo + (p_tokens_entrada::numeric * v_tarifa / 1000000);
      v_precios := v_precios || pg_catalog.jsonb_build_object(
        'entrada', pg_catalog.jsonb_build_object('id', v_id, 'usd_por_millon', v_tarifa, 'vigente_desde', v_vigente)
      );
    end if;
  end if;

  if v_estado = 'calculado' then
    v_id := null;
    select f.id, f.usd_por_millon, f.vigente_desde into v_id, v_tarifa, v_vigente
    from public.flora_precio_vigente(p_proveedor, p_modelo, 'salida', v_momento) as f;
    if v_id is null then
      v_estado := 'no_disponible';
    else
      v_costo := v_costo + (p_tokens_salida::numeric * v_tarifa / 1000000);
      v_precios := v_precios || pg_catalog.jsonb_build_object(
        'salida', pg_catalog.jsonb_build_object('id', v_id, 'usd_por_millon', v_tarifa, 'vigente_desde', v_vigente)
      );
    end if;
  end if;

  if v_estado = 'calculado' and p_tokens_pensamiento is not null and p_tokens_pensamiento > 0 then
    v_id := null;
    select f.id, f.usd_por_millon, f.vigente_desde into v_id, v_tarifa, v_vigente
    from public.flora_precio_vigente(p_proveedor, p_modelo, 'pensamiento', v_momento) as f;
    if v_id is null then
      v_estado := 'no_disponible';
    else
      v_costo := v_costo + (p_tokens_pensamiento::numeric * v_tarifa / 1000000);
      v_precios := v_precios || pg_catalog.jsonb_build_object(
        'pensamiento', pg_catalog.jsonb_build_object('id', v_id, 'usd_por_millon', v_tarifa, 'vigente_desde', v_vigente)
      );
    end if;
  end if;

  if v_estado = 'calculado' and p_tokens_cache is not null and p_tokens_cache > 0 then
    v_id := null;
    select f.id, f.usd_por_millon, f.vigente_desde into v_id, v_tarifa, v_vigente
    from public.flora_precio_vigente(p_proveedor, p_modelo, 'cache', v_momento) as f;
    if v_id is null then
      v_estado := 'no_disponible';
    else
      v_costo := v_costo + (p_tokens_cache::numeric * v_tarifa / 1000000);
      v_precios := v_precios || pg_catalog.jsonb_build_object(
        'cache', pg_catalog.jsonb_build_object('id', v_id, 'usd_por_millon', v_tarifa, 'vigente_desde', v_vigente)
      );
    end if;
  end if;

  if v_estado = 'calculado' and p_tokens_herramientas is not null and p_tokens_herramientas > 0 then
    v_id := null;
    select f.id, f.usd_por_millon, f.vigente_desde into v_id, v_tarifa, v_vigente
    from public.flora_precio_vigente(p_proveedor, p_modelo, 'herramientas', v_momento) as f;
    if v_id is null then
      v_estado := 'no_disponible';
    else
      v_costo := v_costo + (p_tokens_herramientas::numeric * v_tarifa / 1000000);
      v_precios := v_precios || pg_catalog.jsonb_build_object(
        'herramientas', pg_catalog.jsonb_build_object('id', v_id, 'usd_por_millon', v_tarifa, 'vigente_desde', v_vigente)
      );
    end if;
  end if;

  if v_estado <> 'calculado' then
    v_costo := null;
    v_precios := '{}'::jsonb;
  end if;

  insert into public.flora_uso_solicitudes (
    solicitud_id, usuario_id, registrado_en, proveedor, modelo, operacion, resultado, categoria,
    duracion_ms, rondas, tokens_entrada, tokens_salida, tokens_total, tokens_pensamiento,
    tokens_cache, tokens_herramientas, entrada_completa, salida_completa, total_completo,
    costo_usd, costo_estado, precios
  ) values (
    p_solicitud, p_usuario, v_momento, p_proveedor, p_modelo, p_operacion, p_resultado, p_categoria,
    p_duracion_ms, p_rondas, p_tokens_entrada, p_tokens_salida, p_tokens_total, p_tokens_pensamiento,
    p_tokens_cache, p_tokens_herramientas, p_entrada_completa, p_salida_completa, p_total_completo,
    v_costo, v_estado, v_precios
  )
  on conflict (solicitud_id) do nothing;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.resumen_flora_admin(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_modelo text,
  p_operacion text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_desde is null
    or p_hasta is null
    or p_hasta <= p_desde
    or p_hasta > p_desde + interval '366 days'
    or p_modelo is null
    or p_modelo !~ '^[A-Za-z0-9._:+-]{1,64}$'
    or p_operacion is null
    or p_operacion not in ('todos', 'chat', 'chat_imagen')
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  return (
    with uso as (
      select *
      from public.flora_uso_solicitudes as u
      where u.registrado_en >= p_desde
        and u.registrado_en < p_hasta
        and (p_modelo = 'todos' or u.modelo = p_modelo)
        and (p_operacion = 'todos' or u.operacion = p_operacion)
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
        (u.registrado_en at time zone 'America/Argentina/Buenos_Aires')::date as dia,
        pg_catalog.count(*)::bigint as solicitudes,
        pg_catalog.count(*) filter (where u.resultado = 'error')::bigint as errores,
        pg_catalog.sum(u.tokens_total)::bigint as tokens_total,
        pg_catalog.sum(u.costo_usd) filter (where u.costo_estado = 'calculado') as costo_usd
      from uso as u
      group by 1
    )
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'desde', p_desde,
      'hasta', p_hasta,
      'solicitudes', (select pg_catalog.count(*)::bigint from uso),
      'usuarios', (select pg_catalog.count(distinct usuario_id)::bigint from uso),
      'exitos', (select pg_catalog.count(*) filter (where resultado = 'exito')::bigint from uso),
      'errores', (select pg_catalog.count(*) filter (where resultado = 'error')::bigint from uso),
      'cancelaciones', (select pg_catalog.count(*) filter (where resultado = 'cancelacion')::bigint from uso),
      'muestras_latencia', (select pg_catalog.count(duracion_ms)::bigint from uso),
      'duracion_promedio_ms', (
        select case
          when pg_catalog.count(duracion_ms) > 0 then pg_catalog.round(pg_catalog.avg(duracion_ms))::bigint
          else null
        end
        from uso
      ),
      'duracion_p50_ms', (
        select case
          when pg_catalog.count(duracion_ms) >= 20
            then pg_catalog.round((pg_catalog.percentile_cont(0.5) within group (order by duracion_ms))::numeric)::bigint
          else null
        end
        from uso
      ),
      'duracion_p95_ms', (
        select case
          when pg_catalog.count(duracion_ms) >= 20
            then pg_catalog.round((pg_catalog.percentile_cont(0.95) within group (order by duracion_ms))::numeric)::bigint
          else null
        end
        from uso
      ),
      'tokens_entrada', (select pg_catalog.sum(tokens_entrada)::bigint from uso),
      'tokens_salida', (select pg_catalog.sum(tokens_salida)::bigint from uso),
      'tokens_total', (select pg_catalog.sum(tokens_total)::bigint from uso),
      'tokens_pensamiento', (select pg_catalog.sum(tokens_pensamiento)::bigint from uso),
      'tokens_cache', (select pg_catalog.sum(tokens_cache)::bigint from uso),
      'tokens_herramientas', (select pg_catalog.sum(tokens_herramientas)::bigint from uso),
      'solicitudes_sin_entrada', (select pg_catalog.count(*) filter (where tokens_entrada is null)::bigint from uso),
      'solicitudes_sin_salida', (select pg_catalog.count(*) filter (where tokens_salida is null)::bigint from uso),
      'solicitudes_sin_total', (select pg_catalog.count(*) filter (where tokens_total is null)::bigint from uso),
      'costo_usd', (select pg_catalog.sum(costo_usd) filter (where costo_estado = 'calculado') from uso),
      'solicitudes_con_costo', (select pg_catalog.count(*) filter (where costo_estado = 'calculado')::bigint from uso),
      'solicitudes_sin_costo', (select pg_catalog.count(*) filter (where costo_estado = 'no_disponible')::bigint from uso),
      'usuarios_con_costo', (
        select pg_catalog.count(distinct usuario_id) filter (where costo_estado = 'calculado')::bigint from uso
      ),
      'costo_promedio_usuario_usd', (
        select case
          when pg_catalog.count(distinct usuario_id) filter (where costo_estado = 'calculado') = 0 then null
          else pg_catalog.sum(costo_usd) filter (where costo_estado = 'calculado')
            / pg_catalog.count(distinct usuario_id) filter (where costo_estado = 'calculado')
        end
        from uso
      ),
      'facturado_disponible', false,
      'por_modelo', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'modelo', m.modelo,
          'solicitudes', m.solicitudes,
          'tokens_total', m.tokens_total,
          'costo_usd', m.costo_usd
        ) order by m.solicitudes desc, m.modelo)
        from (
          select
            u.modelo,
            pg_catalog.count(*)::bigint as solicitudes,
            pg_catalog.sum(u.tokens_total)::bigint as tokens_total,
            pg_catalog.sum(u.costo_usd) filter (where u.costo_estado = 'calculado') as costo_usd
          from uso as u
          group by u.modelo
          order by pg_catalog.count(*) desc, u.modelo
          limit 12
        ) as m
      ), '[]'::jsonb),
      'por_operacion', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'operacion', o.operacion,
          'solicitudes', o.solicitudes,
          'tokens_total', o.tokens_total,
          'costo_usd', o.costo_usd
        ) order by o.operacion)
        from (
          select
            u.operacion,
            pg_catalog.count(*)::bigint as solicitudes,
            pg_catalog.sum(u.tokens_total)::bigint as tokens_total,
            pg_catalog.sum(u.costo_usd) filter (where u.costo_estado = 'calculado') as costo_usd
          from uso as u
          group by u.operacion
        ) as o
      ), '[]'::jsonb),
      'serie', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'dia', d.dia,
          'solicitudes', coalesce(p.solicitudes, 0),
          'errores', coalesce(p.errores, 0),
          'tokens_total', p.tokens_total,
          'costo_usd', p.costo_usd
        ) order by d.dia)
        from dias as d
        left join por_dia as p on p.dia = d.dia
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.flora_precio_vigente(text, text, text, timestamptz) from public, anon, authenticated, service_role;

revoke all on function public.registrar_uso_flora(uuid, uuid, text, text, text, text, text, integer, integer, integer, integer, integer, integer, integer, integer, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.registrar_uso_flora(uuid, uuid, text, text, text, text, text, integer, integer, integer, integer, integer, integer, integer, integer, boolean, boolean, boolean) to service_role;

revoke all on function public.resumen_flora_admin(timestamptz, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.resumen_flora_admin(timestamptz, timestamptz, text, text) to service_role;
