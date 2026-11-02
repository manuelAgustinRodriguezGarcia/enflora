-- ENFLORA · Admin · Planes e ingresos (solo lectura).
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor después de pagos-licencias.sql y plus-suscripciones.sql.
--
-- No escribe pagos, suscripciones, licencias ni notificaciones.
-- No recalcula importes con la cotización del dólar.
--
-- Ingreso acreditado, una sola vez por identificador de Mercado Pago (payment id / operacion_mp):
--   public.pagos.importe_ars              solo si estado = acreditado y tipo = licencia_cultivo
--   public.plus_pagos_recurrentes.importe_cobrado_ars
--                                         solo si estado_interno = acreditado
-- Si el mismo identificador aparece en las dos tablas con importes distintos, no se suma.
-- Si Plus está acreditado y importe_cobrado_ars es nulo, no se reemplaza por el importe cotizado ni por el precio en dólares.
-- Pendiente, rechazado, cancelado, reembolsado y contracargo no son ingreso.
-- Una suscripción con estado activa no es un cobro.
-- Una licencia habilita solo con estado activa, pago acreditado del mismo ambiente y la misma identidad.
-- La cobertura vigente pide además que el ciclo de cultivo esté activo.
-- Neto, MRR e importe de reembolso se informan como no disponibles: no hay monto de devolución.
--
-- Las dos funciones planes_admin_* arman el criterio y no se conceden a service_role.
-- Las RPC de abajo sí, y el panel además exige la credencial del módulo planes.
-- search_path vacío: tablas y funciones van calificadas.

create or replace function public.planes_admin_movimientos(p_ambiente text)
returns table (
  id uuid,
  origen text,
  usuario_id uuid,
  estado text,
  importe_cobrado_centavos bigint,
  importe_lista_centavos bigint,
  acreditado_en timestamptz,
  creado_en timestamptz,
  clave_mp text,
  referencia_mp text,
  suscripcion_id uuid,
  ciclo_id uuid,
  grupo text,
  sobreviviente boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
      p.id,
      'cultivo'::text as origen,
      p.usuario_id,
      p.estado,
      pg_catalog.round(p.importe_ars * 100)::pg_catalog.bigint as importe_cobrado_centavos,
      pg_catalog.round(p.importe_ars * 100)::pg_catalog.bigint as importe_lista_centavos,
      p.acreditado_en,
      p.creado_en,
      nullif(pg_catalog.btrim(pg_catalog.coalesce(p.operacion_mp, '')), '') as clave_mp,
      nullif(pg_catalog.btrim(pg_catalog.coalesce(p.operacion_mp, '')), '') as referencia_mp,
      null::uuid as suscripcion_id,
      p.ciclo_cultivo_id as ciclo_id
    from public.pagos as p
    where p_ambiente in ('prueba', 'produccion')
      and p.ambiente = p_ambiente
      and p.tipo = 'licencia_cultivo'
    union all
    select
      r.id,
      'plus'::text,
      r.usuario_id,
      r.estado_interno,
      case
        when r.importe_cobrado_ars is null then null
        else pg_catalog.round(r.importe_cobrado_ars * 100)::pg_catalog.bigint
      end,
      case
        when r.importe_ars is null then null
        else pg_catalog.round(r.importe_ars * 100)::pg_catalog.bigint
      end,
      r.acreditado_en,
      r.creado_en,
      nullif(pg_catalog.btrim(pg_catalog.coalesce(r.payment_id, '')), ''),
      nullif(pg_catalog.btrim(pg_catalog.coalesce(r.payment_id, '')), ''),
      r.suscripcion_id,
      null::uuid
    from public.plus_pagos_recurrentes as r
    where p_ambiente in ('prueba', 'produccion')
      and r.ambiente = p_ambiente
  ),
  marcados as (
    select
      b.*,
      case
        when b.clave_mp is null then b.origen || ':' || b.id::text
        else 'mp:' || b.clave_mp
      end as grupo,
      pg_catalog.row_number() over (
        partition by case
          when b.clave_mp is null then b.origen || ':' || b.id::text
          else 'mp:' || b.clave_mp
        end
        order by
          case b.estado
            when 'contracargo' then 1
            when 'reembolsado' then 2
            when 'acreditado' then 3
            when 'rechazado' then 4
            when 'cancelado' then 5
            when 'pendiente' then 6
            else 7
          end,
          case when b.origen = 'plus' then 0 else 1 end,
          b.acreditado_en desc nulls last,
          b.creado_en desc,
          b.id
      ) as orden
    from base as b
  )
  select
    m.id,
    m.origen,
    m.usuario_id,
    m.estado,
    m.importe_cobrado_centavos,
    m.importe_lista_centavos,
    m.acreditado_en,
    m.creado_en,
    m.clave_mp,
    case when m.referencia_mp ~ '^[A-Za-z0-9_-]{1,64}$' then m.referencia_mp else null end,
    m.suscripcion_id,
    m.ciclo_id,
    m.grupo,
    m.orden = 1
  from marcados as m;
$$;

create or replace function public.planes_admin_montos(p_ambiente text)
returns table (
  grupo text,
  centavos bigint,
  es_cruce boolean,
  producto text,
  acreditado_en timestamptz,
  usuario_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  with movimientos as (
    select * from public.planes_admin_movimientos(p_ambiente)
  )
  select
    u.grupo,
    case
      when pg_catalog.count(distinct mv.importe_cobrado_centavos) filter (where mv.importe_cobrado_centavos is not null) > 1 then null
      else pg_catalog.max(mv.importe_cobrado_centavos)
    end as centavos,
    pg_catalog.count(distinct mv.importe_cobrado_centavos) filter (where mv.importe_cobrado_centavos is not null) > 1 as es_cruce,
    case
      when pg_catalog.count(distinct mv.importe_cobrado_centavos) filter (where mv.importe_cobrado_centavos is not null) > 1 then null
      when pg_catalog.bool_or(mv.origen = 'plus' and mv.importe_cobrado_centavos is not null) then 'plus'
      when pg_catalog.max(mv.importe_cobrado_centavos) is not null then 'cultivo'
      else null
    end as producto,
    u.acreditado_en,
    u.usuario_id
  from movimientos as u
  join movimientos as mv
    on mv.grupo = u.grupo
   and mv.estado = 'acreditado'
  where u.sobreviviente
    and u.estado = 'acreditado'
  group by u.grupo, u.acreditado_en, u.usuario_id;
$$;

create or replace function public.resumen_planes_admin(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_ambiente text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_ambiente is null or p_ambiente not in ('prueba', 'produccion') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'ambiente_invalido');
  end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde or p_hasta > p_desde + interval '366 days' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'periodo_invalido');
  end if;

  return (
    with dias as (
      select gs.dia::pg_catalog.date as dia
      from pg_catalog.generate_series(
        (p_desde at time zone 'America/Argentina/Buenos_Aires')::pg_catalog.date,
        ((p_hasta at time zone 'America/Argentina/Buenos_Aires')::pg_catalog.date - 1),
        interval '1 day'
      ) as gs(dia)
    ),
    ingresos as (
      select
        (m.acreditado_en at time zone 'America/Argentina/Buenos_Aires')::pg_catalog.date as dia,
        m.centavos,
        m.producto,
        m.es_cruce
      from public.planes_admin_montos(p_ambiente) as m
      where m.acreditado_en >= p_desde
        and m.acreditado_en < p_hasta
    ),
    serie as (
      select
        d.dia,
        pg_catalog.coalesce(pg_catalog.sum(i.centavos) filter (where i.centavos is not null), 0)::pg_catalog.bigint as centavos
      from dias as d
      left join ingresos as i on i.dia = d.dia
      group by d.dia
    ),
    meses as (
      select
        pg_catalog.to_char(s.dia, 'YYYY-MM') as mes,
        pg_catalog.sum(s.centavos)::pg_catalog.bigint as centavos
      from serie as s
      group by 1
    ),
    estados as (
      select mv.estado
      from public.planes_admin_movimientos(p_ambiente) as mv
      where mv.sobreviviente
        and pg_catalog.coalesce(mv.acreditado_en, mv.creado_en) >= p_desde
        and pg_catalog.coalesce(mv.acreditado_en, mv.creado_en) < p_hasta
    ),
    ancla as (
      select 1 as uno
    )
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'generado_en', pg_catalog.now(),
      'ambiente', p_ambiente,
      'desde', p_desde,
      'hasta', p_hasta,
      'moneda', 'ARS',
      'ingresos_acreditados_centavos', (
        select pg_catalog.coalesce(pg_catalog.sum(i.centavos) filter (where i.centavos is not null), 0)::pg_catalog.bigint from ingresos as i
      ),
      'ingresos_plus_centavos', (
        select pg_catalog.coalesce(pg_catalog.sum(i.centavos) filter (where i.producto = 'plus'), 0)::pg_catalog.bigint from ingresos as i
      ),
      'ingresos_cultivo_centavos', (
        select pg_catalog.coalesce(pg_catalog.sum(i.centavos) filter (where i.producto = 'cultivo'), 0)::pg_catalog.bigint from ingresos as i
      ),
      'sin_importe', (
        select pg_catalog.count(*) filter (where i.centavos is null and i.es_cruce = false)::pg_catalog.bigint from ingresos as i
      ),
      'cruces_importe', (
        select pg_catalog.count(*) filter (where i.es_cruce)::pg_catalog.bigint from ingresos as i
      ),
      'acreditados_sin_fecha', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from public.planes_admin_movimientos(p_ambiente) as mv
        where mv.sobreviviente and mv.estado = 'acreditado' and mv.acreditado_en is null
      ),
      'suscripciones_activas', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from public.plus_suscripciones as s
        where s.ambiente = p_ambiente and s.estado_interno = 'activa'
      ),
      'suscripciones_habilitadas', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from public.plus_suscripciones as s
        where s.ambiente = p_ambiente
          and s.periodo_vigente_hasta >= pg_catalog.now()
          and (
            s.estado_interno = 'activa'
            or (s.estado_interno = 'cancelada' and s.vigente_hasta_fin_periodo)
          )
          and exists (
            select 1 from public.plus_pagos_recurrentes as r
            where r.suscripcion_id = s.id
              and r.ambiente = s.ambiente
              and r.estado_interno = 'acreditado'
              and r.periodo_hasta >= pg_catalog.now()
          )
      ),
      'suscripciones_canceladas', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from public.plus_suscripciones as s
        where s.ambiente = p_ambiente and s.estado_interno = 'cancelada'
      ),
      'suscripciones_activas_sin_pago', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from public.plus_suscripciones as s
        where s.ambiente = p_ambiente
          and s.estado_interno = 'activa'
          and not exists (
            select 1 from public.plus_pagos_recurrentes as r
            where r.suscripcion_id = s.id
              and r.ambiente = s.ambiente
              and r.estado_interno = 'acreditado'
          )
      ),
      'licencias_habilitan_pago', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from public.licencias_cultivo as l
        join public.pagos as p on p.id = l.pago_id
        where p.ambiente = p_ambiente
          and l.estado = 'activa'
          and p.estado = 'acreditado'
          and p.usuario_id = l.usuario_id
          and p.ciclo_cultivo_id = l.ciclo_cultivo_id
      ),
      'licencias_cobertura', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from public.licencias_cultivo as l
        join public.pagos as p on p.id = l.pago_id
        join public.ciclos_cultivo as c on c.id = l.ciclo_cultivo_id
        where p.ambiente = p_ambiente
          and l.estado = 'activa'
          and p.estado = 'acreditado'
          and p.usuario_id = l.usuario_id
          and p.ciclo_cultivo_id = l.ciclo_cultivo_id
          and c.estado = 'activo'
          and c.usuario_id = l.usuario_id
      ),
      'licencias_sin_cobro', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from public.licencias_cultivo as l
        join public.pagos as p on p.id = l.pago_id
        where p.ambiente = p_ambiente
          and l.estado = 'activa'
          and (
            p.estado is distinct from 'acreditado'
            or p.usuario_id is distinct from l.usuario_id
            or p.ciclo_cultivo_id is distinct from l.ciclo_cultivo_id
          )
      ),
      'licencias_sin_pago', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from public.licencias_cultivo as l
        where l.estado = 'activa'
          and not exists (select 1 from public.pagos as p where p.id = l.pago_id)
      ),
      'pagos_pendientes', (select pg_catalog.count(*) filter (where e.estado = 'pendiente')::pg_catalog.bigint from estados as e),
      'pagos_rechazados', (select pg_catalog.count(*) filter (where e.estado = 'rechazado')::pg_catalog.bigint from estados as e),
      'pagos_acreditados', (select pg_catalog.count(*) filter (where e.estado = 'acreditado')::pg_catalog.bigint from estados as e),
      'pagos_reembolsados', (select pg_catalog.count(*) filter (where e.estado = 'reembolsado')::pg_catalog.bigint from estados as e),
      'pagos_contracargos', (select pg_catalog.count(*) filter (where e.estado = 'contracargo')::pg_catalog.bigint from estados as e),
      'pagos_creados', (select pg_catalog.count(*) filter (where e.estado = 'creada')::pg_catalog.bigint from estados as e),
      'pagos_cancelados', (select pg_catalog.count(*) filter (where e.estado = 'cancelado')::pg_catalog.bigint from estados as e),
      'clientes_pago_nuevos', (
        select pg_catalog.count(*)::pg_catalog.bigint
        from (
          select m.usuario_id
          from public.planes_admin_montos(p_ambiente) as m
          where m.centavos is not null and m.acreditado_en is not null
          group by m.usuario_id
          having pg_catalog.min(m.acreditado_en) >= p_desde
             and pg_catalog.min(m.acreditado_en) < p_hasta
        ) as primeros
      ),
      'ingresos_netos_disponibles', false,
      'mrr_disponible', false,
      'reembolsos_importe_disponible', false,
      'serie_dia', pg_catalog.coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('dia', pg_catalog.to_char(s.dia, 'YYYY-MM-DD'), 'centavos', s.centavos)
          order by s.dia
        )
        from serie as s
      ), '[]'::pg_catalog.jsonb),
      'serie_mes', pg_catalog.coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('mes', m.mes, 'centavos', m.centavos)
          order by m.mes
        )
        from meses as m
      ), '[]'::pg_catalog.jsonb)
    )
    from ancla
  );
end;
$$;

create or replace function public.operaciones_planes_admin(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_producto text,
  p_estado text,
  p_ambiente text,
  p_limite integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_ambiente is null or p_ambiente not in ('prueba', 'produccion') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'ambiente_invalido');
  end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde or p_hasta > p_desde + interval '366 days' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'periodo_invalido');
  end if;
  if p_producto is null or p_producto not in ('todos', 'plus', 'pago_unico')
     or p_estado is null or p_estado not in ('todos', 'creada', 'pendiente', 'acreditado', 'rechazado', 'cancelado', 'reembolsado', 'contracargo') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'filtro_invalido');
  end if;
  if p_limite is distinct from 25 or p_offset is null or p_offset < 0 or p_offset > 100000 or p_offset % 25 <> 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'paginacion_invalida');
  end if;

  return (
    with montos as (
      select * from public.planes_admin_montos(p_ambiente)
    ),
    filtrados as (
      select
        mv.id,
        mv.origen,
        pg_catalog.coalesce(mv.acreditado_en, mv.creado_en) as fecha,
        case when mv.origen = 'plus' then 'plus' else 'pago_unico' end as producto,
        mv.estado,
        case
          when mv.estado = 'acreditado' then mo.centavos
          when mv.origen = 'plus' then pg_catalog.coalesce(mv.importe_cobrado_centavos, mv.importe_lista_centavos)
          else mv.importe_cobrado_centavos
        end as importe_centavos,
        mv.referencia_mp,
        mv.usuario_id
      from public.planes_admin_movimientos(p_ambiente) as mv
      left join montos as mo on mo.grupo = mv.grupo
      where mv.sobreviviente
        and pg_catalog.coalesce(mv.acreditado_en, mv.creado_en) >= p_desde
        and pg_catalog.coalesce(mv.acreditado_en, mv.creado_en) < p_hasta
        and (
          p_producto = 'todos'
          or (p_producto = 'plus' and mv.origen = 'plus')
          or (p_producto = 'pago_unico' and mv.origen = 'cultivo')
        )
        and (p_estado = 'todos' or mv.estado = p_estado)
    )
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'total', (select pg_catalog.count(*)::pg_catalog.bigint from filtrados),
      'limite', p_limite,
      'offset', p_offset,
      'filas', pg_catalog.coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', f.id,
            'origen', f.origen,
            'fecha', f.fecha,
            'producto', f.producto,
            'estado', f.estado,
            'importe_centavos', f.importe_centavos,
            'moneda', 'ARS',
            'ambiente', p_ambiente,
            'usuario_id', f.usuario_id,
            'referencia_mp', f.referencia_mp
          )
          order by f.fecha desc, f.id desc
        )
        from (
          select *
          from filtrados
          order by fecha desc, id desc
          limit p_limite
          offset p_offset
        ) as f
      ), '[]'::pg_catalog.jsonb)
    )
  );
end;
$$;

create or replace function public.detalle_operacion_planes_admin(p_origen text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ambiente text;
  v_centavos bigint;
begin
  if p_origen is null or p_origen not in ('plus', 'cultivo') or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'filtro_invalido');
  end if;

  if p_origen = 'cultivo' then
    select p.ambiente into v_ambiente from public.pagos as p where p.id = p_id and p.tipo = 'licencia_cultivo';
  else
    select r.ambiente into v_ambiente from public.plus_pagos_recurrentes as r where r.id = p_id;
  end if;
  if v_ambiente is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrada');
  end if;

  select mo.centavos into v_centavos
  from public.planes_admin_movimientos(v_ambiente) as mv
  join public.planes_admin_montos(v_ambiente) as mo on mo.grupo = mv.grupo
  where mv.id = p_id
    and mv.origen = p_origen
    and mv.sobreviviente
    and mo.centavos is not null;

  if p_origen = 'cultivo' then
    return (
      select pg_catalog.jsonb_build_object(
        'ok', true,
        'operacion', pg_catalog.jsonb_build_object(
          'id', p.id,
          'origen', 'cultivo',
          'producto', 'pago_unico',
          'estado', p.estado,
          'estado_mp', case when p.mp_estado ~ '^[a-z0-9_]{1,40}$' then p.mp_estado else null end,
          'importe_centavos', pg_catalog.coalesce(v_centavos, pg_catalog.round(p.importe_ars * 100)::pg_catalog.bigint),
          'importe_cotizado_centavos', null,
          'moneda', 'ARS',
          'ambiente', p.ambiente,
          'usuario_id', p.usuario_id,
          'referencia_mp', case when nullif(pg_catalog.btrim(pg_catalog.coalesce(p.operacion_mp, '')), '') ~ '^[A-Za-z0-9_-]{1,64}$'
            then nullif(pg_catalog.btrim(p.operacion_mp), '') else null end,
          'orden_mp', case when nullif(pg_catalog.btrim(pg_catalog.coalesce(p.order_id, '')), '') ~ '^[A-Za-z0-9_-]{1,64}$'
            then nullif(pg_catalog.btrim(p.order_id), '') else null end,
          'fecha', pg_catalog.coalesce(p.acreditado_en, p.creado_en),
          'creado_en', p.creado_en,
          'acreditado_en', p.acreditado_en,
          'suscripcion_id', null,
          'ciclo_id', p.ciclo_cultivo_id,
          'periodo_desde', null,
          'periodo_hasta', null,
          'incluida_en_totales', v_centavos is not null
        )
      )
      from public.pagos as p
      where p.id = p_id
    );
  end if;

  return (
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'operacion', pg_catalog.jsonb_build_object(
        'id', r.id,
        'origen', 'plus',
        'producto', 'plus',
        'estado', r.estado_interno,
        'estado_mp', case when r.estado_mp ~ '^[a-z0-9_]{1,40}$' then r.estado_mp else null end,
        'importe_centavos', pg_catalog.coalesce(v_centavos, case
          when r.importe_cobrado_ars is null then null
          else pg_catalog.round(r.importe_cobrado_ars * 100)::pg_catalog.bigint
        end),
        'importe_cotizado_centavos', case
          when r.importe_ars is null then null
          else pg_catalog.round(r.importe_ars * 100)::pg_catalog.bigint
        end,
        'moneda', 'ARS',
        'ambiente', r.ambiente,
        'usuario_id', r.usuario_id,
        'referencia_mp', case when nullif(pg_catalog.btrim(pg_catalog.coalesce(r.payment_id, '')), '') ~ '^[A-Za-z0-9_-]{1,64}$'
          then nullif(pg_catalog.btrim(r.payment_id), '') else null end,
        'orden_mp', case when nullif(pg_catalog.btrim(pg_catalog.coalesce(r.authorized_payment_id, '')), '') ~ '^[A-Za-z0-9_-]{1,64}$'
          then nullif(pg_catalog.btrim(r.authorized_payment_id), '') else null end,
        'fecha', pg_catalog.coalesce(r.acreditado_en, r.creado_en),
        'creado_en', r.creado_en,
        'acreditado_en', r.acreditado_en,
        'suscripcion_id', r.suscripcion_id,
        'ciclo_id', null,
        'periodo_desde', r.periodo_desde,
        'periodo_hasta', r.periodo_hasta,
        'incluida_en_totales', v_centavos is not null
      )
    )
    from public.plus_pagos_recurrentes as r
    where r.id = p_id
  );
end;
$$;

create or replace function public.suscripciones_planes_admin(
  p_ambiente text,
  p_estado text,
  p_limite integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_ambiente is null or p_ambiente not in ('prueba', 'produccion') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'ambiente_invalido');
  end if;
  if p_estado is null or p_estado not in ('todos', 'borrador', 'pendiente_checkout', 'activa', 'pausada', 'cancelada', 'vencida', 'past_due') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'filtro_invalido');
  end if;
  if p_limite is distinct from 25 or p_offset is null or p_offset < 0 or p_offset > 100000 or p_offset % 25 <> 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'paginacion_invalida');
  end if;

  return (
    with filas as (
      select
        s.id,
        s.usuario_id,
        s.ambiente,
        s.estado_interno,
        s.periodo_vigente_desde as periodo_desde,
        s.periodo_vigente_hasta as periodo_hasta,
        s.cancelada_en,
        s.vigente_hasta_fin_periodo,
        s.creada_en,
        (
          select pg_catalog.count(*)::pg_catalog.bigint
          from public.plus_pagos_recurrentes as r
          where r.suscripcion_id = s.id
            and r.ambiente = s.ambiente
            and r.estado_interno = 'acreditado'
        ) as pagos_acreditados,
        pg_catalog.coalesce((
          s.periodo_vigente_hasta >= pg_catalog.now()
          and exists (
            select 1 from public.plus_pagos_recurrentes as r
            where r.suscripcion_id = s.id
              and r.ambiente = s.ambiente
              and r.estado_interno = 'acreditado'
              and r.periodo_hasta >= pg_catalog.now()
          )
          and (
            s.estado_interno = 'activa'
            or (s.estado_interno = 'cancelada' and s.vigente_hasta_fin_periodo)
          )
        ), false) as habilitada
      from public.plus_suscripciones as s
      where s.ambiente = p_ambiente
        and (p_estado = 'todos' or s.estado_interno = p_estado)
    )
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'total', (select pg_catalog.count(*)::pg_catalog.bigint from filas),
      'limite', p_limite,
      'offset', p_offset,
      'filas', pg_catalog.coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', f.id,
          'usuario_id', f.usuario_id,
          'ambiente', f.ambiente,
          'estado_interno', f.estado_interno,
          'periodo_desde', f.periodo_desde,
          'periodo_hasta', f.periodo_hasta,
          'cancelada_en', f.cancelada_en,
          'vigente_hasta_fin_periodo', f.vigente_hasta_fin_periodo,
          'creada_en', f.creada_en,
          'pagos_acreditados', f.pagos_acreditados,
          'renovaciones', pg_catalog.greatest(f.pagos_acreditados - 1, 0),
          'habilitada', f.habilitada,
          'incidencia', case
            when f.estado_interno = 'activa' and f.pagos_acreditados = 0 then 'sin_pago_acreditado'
            when f.estado_interno = 'activa' and f.periodo_hasta < pg_catalog.now() then 'periodo_vencido'
            else null
          end
        ) order by f.creada_en desc, f.id desc)
        from (
          select * from filas
          order by creada_en desc, id desc
          limit p_limite offset p_offset
        ) as f
      ), '[]'::pg_catalog.jsonb)
    )
  );
end;
$$;

create or replace function public.detalle_suscripcion_planes_admin(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  if p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'filtro_invalido');
  end if;
  if not exists (select 1 from public.plus_suscripciones as s where s.id = p_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrada');
  end if;

  select pg_catalog.count(*) into v_total
  from public.plus_pagos_recurrentes as r
  join public.plus_suscripciones as s on s.id = r.suscripcion_id
  where r.suscripcion_id = p_id
    and r.ambiente = s.ambiente;

  return (
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'pagos_recortados', v_total > 24,
      'suscripcion', pg_catalog.jsonb_build_object(
        'id', s.id,
        'usuario_id', s.usuario_id,
        'ambiente', s.ambiente,
        'estado_interno', s.estado_interno,
        'periodo_desde', s.periodo_vigente_desde,
        'periodo_hasta', s.periodo_vigente_hasta,
        'cancelada_en', s.cancelada_en,
        'vigente_hasta_fin_periodo', s.vigente_hasta_fin_periodo,
        'creada_en', s.creada_en,
        'pagos_acreditados', (
          select pg_catalog.count(*)::pg_catalog.bigint
          from public.plus_pagos_recurrentes as r
          where r.suscripcion_id = s.id and r.ambiente = s.ambiente and r.estado_interno = 'acreditado'
        ),
        'renovaciones', pg_catalog.greatest((
          select pg_catalog.count(*)::pg_catalog.bigint
          from public.plus_pagos_recurrentes as r
          where r.suscripcion_id = s.id and r.ambiente = s.ambiente and r.estado_interno = 'acreditado'
        ) - 1, 0),
        'habilitada', pg_catalog.coalesce((
          s.periodo_vigente_hasta >= pg_catalog.now()
          and exists (
            select 1 from public.plus_pagos_recurrentes as r
            where r.suscripcion_id = s.id
              and r.ambiente = s.ambiente
              and r.estado_interno = 'acreditado'
              and r.periodo_hasta >= pg_catalog.now()
          )
          and (
            s.estado_interno = 'activa'
            or (s.estado_interno = 'cancelada' and s.vigente_hasta_fin_periodo)
          )
        ), false),
        'incidencia', case
          when s.estado_interno = 'activa' and not exists (
            select 1 from public.plus_pagos_recurrentes as r
            where r.suscripcion_id = s.id and r.ambiente = s.ambiente and r.estado_interno = 'acreditado'
          ) then 'sin_pago_acreditado'
          when s.estado_interno = 'activa' and s.periodo_vigente_hasta < pg_catalog.now() then 'periodo_vencido'
          else null
        end
      ),
      'pagos', pg_catalog.coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', r.id,
          'estado', r.estado_interno,
          'importe_centavos', case
            when r.estado_interno = 'acreditado' then
              case when r.importe_cobrado_ars is null then null else pg_catalog.round(r.importe_cobrado_ars * 100)::pg_catalog.bigint end
            when r.importe_ars is null then null
            else pg_catalog.round(r.importe_ars * 100)::pg_catalog.bigint
          end,
          'moneda', 'ARS',
          'acreditado_en', r.acreditado_en,
          'creado_en', r.creado_en,
          'referencia_mp', case
            when nullif(pg_catalog.btrim(pg_catalog.coalesce(r.payment_id, '')), '') ~ '^[A-Za-z0-9_-]{1,64}$'
            then nullif(pg_catalog.btrim(r.payment_id), '')
            else null
          end,
          'periodo_desde', r.periodo_desde,
          'periodo_hasta', r.periodo_hasta
        ) order by r.acreditado_en desc nulls last, r.creado_en desc)
        from (
          select r.*
          from public.plus_pagos_recurrentes as r
          where r.suscripcion_id = s.id and r.ambiente = s.ambiente
          order by r.acreditado_en desc nulls last, r.creado_en desc
          limit 24
        ) as r
      ), '[]'::pg_catalog.jsonb)
    )
    from public.plus_suscripciones as s
    where s.id = p_id
  );
end;
$$;

create or replace function public.licencias_planes_admin(
  p_ambiente text,
  p_estado text,
  p_limite integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_ambiente is null or p_ambiente not in ('prueba', 'produccion') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'ambiente_invalido');
  end if;
  if p_estado is null or p_estado not in ('todos', 'activa', 'revocada') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'filtro_invalido');
  end if;
  if p_limite is distinct from 25 or p_offset is null or p_offset < 0 or p_offset > 100000 or p_offset % 25 <> 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'paginacion_invalida');
  end if;

  return (
    with filas as (
      select
        l.id,
        l.usuario_id,
        l.ciclo_cultivo_id as ciclo_id,
        c.estado as ciclo_estado,
        l.pago_id,
        l.estado,
        p.estado as estado_pago,
        p.ambiente,
        l.activada_en,
        l.revocada_en,
        (
          l.estado = 'activa'
          and p.estado = 'acreditado'
          and p.usuario_id = l.usuario_id
          and p.ciclo_cultivo_id = l.ciclo_cultivo_id
        ) as habilita,
        (p.usuario_id = l.usuario_id and p.ciclo_cultivo_id = l.ciclo_cultivo_id) as misma_identidad,
        (
          l.estado = 'activa'
          and p.estado = 'acreditado'
          and p.usuario_id = l.usuario_id
          and p.ciclo_cultivo_id = l.ciclo_cultivo_id
          and c.estado = 'activo'
          and c.usuario_id = l.usuario_id
        ) as cobertura
      from public.licencias_cultivo as l
      join public.pagos as p on p.id = l.pago_id
      join public.ciclos_cultivo as c on c.id = l.ciclo_cultivo_id
      where p.ambiente = p_ambiente
        and (p_estado = 'todos' or l.estado = p_estado)
    )
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'total', (select pg_catalog.count(*)::pg_catalog.bigint from filas),
      'limite', p_limite,
      'offset', p_offset,
      'filas', pg_catalog.coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', f.id,
          'usuario_id', f.usuario_id,
          'ciclo_id', f.ciclo_id,
          'ciclo_estado', f.ciclo_estado,
          'pago_id', f.pago_id,
          'estado', f.estado,
          'estado_pago', f.estado_pago,
          'ambiente', f.ambiente,
          'activada_en', f.activada_en,
          'revocada_en', f.revocada_en,
          'habilita', f.habilita,
          'cobertura', f.cobertura,
          'incidencia', case
            when f.misma_identidad = false then 'identidad_distinta'
            when f.habilita and f.ciclo_estado = 'finalizado' then 'ciclo_finalizado'
            when f.estado = 'activa' and f.estado_pago is distinct from 'acreditado' then 'pago_no_acreditado'
            else null
          end
        ) order by f.activada_en desc, f.id desc)
        from (
          select * from filas
          order by activada_en desc, id desc
          limit p_limite offset p_offset
        ) as f
      ), '[]'::pg_catalog.jsonb)
    )
  );
end;
$$;

create or replace function public.detalle_licencia_planes_admin(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'filtro_invalido');
  end if;
  if not exists (select 1 from public.licencias_cultivo as l where l.id = p_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrada');
  end if;

  return (
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'licencia', pg_catalog.jsonb_build_object(
        'id', l.id,
        'usuario_id', l.usuario_id,
        'ciclo_id', l.ciclo_cultivo_id,
        'ciclo_estado', c.estado,
        'pago_id', l.pago_id,
        'estado', l.estado,
        'estado_pago', p.estado,
        'ambiente', p.ambiente,
        'activada_en', l.activada_en,
        'revocada_en', l.revocada_en,
        'habilita', pg_catalog.coalesce((
          l.estado = 'activa'
          and p.estado = 'acreditado'
          and p.usuario_id = l.usuario_id
          and p.ciclo_cultivo_id = l.ciclo_cultivo_id
          and p.ambiente in ('prueba', 'produccion')
        ), false),
        'cobertura', pg_catalog.coalesce((
          l.estado = 'activa'
          and p.estado = 'acreditado'
          and p.usuario_id = l.usuario_id
          and p.ciclo_cultivo_id = l.ciclo_cultivo_id
          and c.estado = 'activo'
          and c.usuario_id = l.usuario_id
        ), false),
        'incidencia', case
          when p.id is null then 'sin_pago'
          when p.usuario_id is distinct from l.usuario_id or p.ciclo_cultivo_id is distinct from l.ciclo_cultivo_id then 'identidad_distinta'
          when l.estado = 'activa' and p.estado is distinct from 'acreditado' then 'pago_no_acreditado'
          when l.estado = 'activa' and p.estado = 'acreditado' and c.estado = 'finalizado' then 'ciclo_finalizado'
          else null
        end
      )
    )
    from public.licencias_cultivo as l
    left join public.pagos as p on p.id = l.pago_id
    left join public.ciclos_cultivo as c on c.id = l.ciclo_cultivo_id
    where l.id = p_id
  );
end;
$$;

revoke all on function public.planes_admin_movimientos(text) from public, anon, authenticated, service_role;
revoke all on function public.planes_admin_montos(text) from public, anon, authenticated, service_role;

revoke all on function public.resumen_planes_admin(timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.resumen_planes_admin(timestamptz, timestamptz, text) to service_role;

revoke all on function public.operaciones_planes_admin(timestamptz, timestamptz, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.operaciones_planes_admin(timestamptz, timestamptz, text, text, text, integer, integer) to service_role;

revoke all on function public.detalle_operacion_planes_admin(text, uuid) from public, anon, authenticated;
grant execute on function public.detalle_operacion_planes_admin(text, uuid) to service_role;

revoke all on function public.suscripciones_planes_admin(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.suscripciones_planes_admin(text, text, integer, integer) to service_role;

revoke all on function public.detalle_suscripcion_planes_admin(uuid) from public, anon, authenticated;
grant execute on function public.detalle_suscripcion_planes_admin(uuid) to service_role;

revoke all on function public.licencias_planes_admin(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.licencias_planes_admin(text, text, integer, integer) to service_role;

revoke all on function public.detalle_licencia_planes_admin(uuid) from public, anon, authenticated;
grant execute on function public.detalle_licencia_planes_admin(uuid) to service_role;
