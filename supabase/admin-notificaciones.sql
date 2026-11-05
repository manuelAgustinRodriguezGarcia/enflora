-- ENFLORA — monitoreo administrativo de Web Push.
--
-- Lectura agregada de las tablas que ya usa el envío. No crea campañas, no
-- inserta envíos, no cambia suscripciones y no reemplaza push_lote_pendiente
-- ni push_reclamar_envio. Esas funciones siguen devolviendo el material de
-- envío solo al proceso que ya las usa.
--
-- Una suscripción es un dispositivo. Un usuario puede tener varias. Un envío
-- aceptado significa que el servicio push lo recibió, no que alguien lo haya
-- visto. No hay una métrica de apertura o lectura para las campañas.
--
-- Totales de suscripciones y envíos: estado actual o histórico real.
-- La serie diaria usa el período pedido y un día en cero es un día sin filas.
--
-- Índices ya existentes y suficientes para este volumen:
--   push_suscripciones (activa, creada_en)
--   push_suscripciones (usuario_id)
--   push_suscripciones (usuario_id) where activa and usuario_id is not null
--   push_envios (campana_id, estado)
--   push_envios (suscripcion_id)
-- No se agrega otro índice: la serie por creado_en recorre push_envios, que
-- hoy es una tabla operativa chica. Si crece, el índice candidato es
-- push_envios (creado_en), no una tabla nueva.
--
-- Las acciones futuras (crear, programar, cancelar, elegir destinatarios)
-- no tienen función acá. El envío masivo sigue fuera del panel.

create or replace function public.resumen_notificaciones_admin(
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
  resultado jsonb;
begin
  if p_desde is null or p_hasta is null or p_hasta <= p_desde
     or p_hasta > p_desde + interval '366 days' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  with suscripciones as (
    select
      s.usuario_id,
      s.activa,
      s.creada_en,
      case
        when s.plataforma in ('android', 'ios', 'escritorio', 'desconocida') then s.plataforma
        else 'desconocida'
      end as plataforma,
      case
        when s.activa then null
        when s.motivo_baja in ('usuario', 'expirada', 'reemplazada', 'credenciales') then s.motivo_baja
        when s.motivo_baja is null then 'sin_motivo'
        else 'otro'
      end as motivo
    from public.push_suscripciones s
  ),
  envios as (
    select
      e.creado_en,
      e.actualizado_en,
      e.estado,
      e.tipo,
      e.codigo_estado,
      case
        when e.estado in ('aceptado', 'pendiente', 'enviando') then null
        when e.codigo_estado in (404, 410) or e.estado = 'expirado' then 'suscripcion_invalida'
        when e.codigo_estado in (401, 403) then 'credenciales'
        when e.codigo_estado in (408, 429) or e.codigo_estado >= 500 then 'temporal'
        when e.estado = 'error' and e.error = 'interrumpido' then 'interrumpido'
        when e.estado = 'omitido' then 'omitido'
        else 'otro'
      end as categoria
    from public.push_envios e
  ),
  dias as (
    select pg_catalog.generate_series(
      (p_desde at time zone 'America/Argentina/Buenos_Aires')::date,
      ((p_hasta - interval '1 second') at time zone 'America/Argentina/Buenos_Aires')::date,
      interval '1 day'
    )::date as dia
  ),
  serie as (
    select
      d.dia,
      (
        select pg_catalog.count(*)::bigint
        from suscripciones s
        where (s.creada_en at time zone 'America/Argentina/Buenos_Aires')::date = d.dia
          and s.creada_en >= p_desde
          and s.creada_en < p_hasta
      ) as suscripciones,
      (
        select pg_catalog.count(*)::bigint
        from envios e
        where (e.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = d.dia
          and e.creado_en >= p_desde
          and e.creado_en < p_hasta
      ) as envios,
      (
        select pg_catalog.count(*)::bigint
        from envios e
        where e.estado = 'aceptado'
          and (e.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = d.dia
          and e.creado_en >= p_desde
          and e.creado_en < p_hasta
      ) as aceptados
    from dias d
  )
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'aperturas_disponibles', false,
    'envio_masivo_habilitado', false,
    'desde', p_desde,
    'hasta', p_hasta,
    'medido_en', pg_catalog.now(),
    'ultima_actividad', (select pg_catalog.max(e.actualizado_en) from envios e),
    'suscripciones', (select pg_catalog.count(*)::bigint from suscripciones),
    'activas', (select pg_catalog.count(*)::bigint from suscripciones s where s.activa),
    'inactivas', (select pg_catalog.count(*)::bigint from suscripciones s where not s.activa),
    'usuarios_activos', (
      select pg_catalog.count(distinct s.usuario_id)::bigint
      from suscripciones s
      where s.activa and s.usuario_id is not null
    ),
    'dispositivos_sin_cuenta', (
      select pg_catalog.count(*)::bigint
      from suscripciones s
      where s.activa and s.usuario_id is null
    ),
    'invalidadas', (
      select pg_catalog.count(*)::bigint
      from suscripciones s
      where not s.activa and s.motivo = 'expirada'
    ),
    'altas_periodo', (
      select pg_catalog.count(*)::bigint
      from suscripciones s
      where s.creada_en >= p_desde and s.creada_en < p_hasta
    ),
    'envios', (select pg_catalog.count(*)::bigint from envios),
    'aceptados', (select pg_catalog.count(*)::bigint from envios e where e.estado = 'aceptado'),
    'errores', (select pg_catalog.count(*)::bigint from envios e where e.estado = 'error'),
    'expirados', (select pg_catalog.count(*)::bigint from envios e where e.estado = 'expirado'),
    'omitidos', (select pg_catalog.count(*)::bigint from envios e where e.estado = 'omitido'),
    'pendientes', (
      select pg_catalog.count(*)::bigint
      from envios e
      where e.estado in ('pendiente', 'enviando')
    ),
    'envios_prueba', (select pg_catalog.count(*)::bigint from envios e where e.tipo = 'prueba'),
    'envios_campana', (select pg_catalog.count(*)::bigint from envios e where e.tipo = 'campana'),
    'envios_periodo', (
      select pg_catalog.count(*)::bigint
      from envios e
      where e.creado_en >= p_desde and e.creado_en < p_hasta
    ),
    'aceptados_periodo', (
      select pg_catalog.count(*)::bigint
      from envios e
      where e.estado = 'aceptado' and e.creado_en >= p_desde and e.creado_en < p_hasta
    ),
    'errores_periodo', (
      select pg_catalog.count(*)::bigint
      from envios e
      where e.estado = 'error' and e.creado_en >= p_desde and e.creado_en < p_hasta
    ),
    'expirados_periodo', (
      select pg_catalog.count(*)::bigint
      from envios e
      where e.estado = 'expirado' and e.creado_en >= p_desde and e.creado_en < p_hasta
    ),
    'omitidos_periodo', (
      select pg_catalog.count(*)::bigint
      from envios e
      where e.estado = 'omitido' and e.creado_en >= p_desde and e.creado_en < p_hasta
    ),
    'por_plataforma', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'plataforma', plataforma,
        'suscripciones', suscripciones,
        'activas', activas
      ) order by plataforma)
      from (
        select
          plataforma.plataforma,
          (
            select pg_catalog.count(*)::bigint
            from suscripciones s
            where s.plataforma = plataforma.plataforma
          ) as suscripciones,
          (
            select pg_catalog.count(*)::bigint
            from suscripciones s
            where s.plataforma = plataforma.plataforma and s.activa
          ) as activas
        from (
          select pg_catalog.unnest(array['android', 'escritorio', 'desconocida', 'ios']) as plataforma
        ) plataforma
      ) filas
    ), '[]'::jsonb),
    'por_baja', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'motivo', motivo,
        'suscripciones', suscripciones
      ) order by motivo)
      from (
        select
          motivo.motivo,
          (
            select pg_catalog.count(*)::bigint
            from suscripciones s
            where s.motivo = motivo.motivo
          ) as suscripciones
        from (
          select pg_catalog.unnest(array['credenciales', 'expirada', 'otro', 'reemplazada', 'sin_motivo', 'usuario']) as motivo
        ) motivo
      ) filas
    ), '[]'::jsonb),
    'por_error', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'categoria', categoria,
        'envios', envios
      ) order by categoria)
      from (
        select
          categoria.categoria,
          (
            select pg_catalog.count(*)::bigint
            from envios e
            where e.categoria = categoria.categoria
          ) as envios
        from (
          select pg_catalog.unnest(array[
            'credenciales', 'interrumpido', 'omitido', 'otro', 'suscripcion_invalida', 'temporal'
          ]) as categoria
        ) categoria
      ) filas
    ), '[]'::jsonb),
    'serie', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'dia', pg_catalog.to_char(s.dia, 'YYYY-MM-DD'),
        'suscripciones', s.suscripciones,
        'envios', s.envios,
        'aceptados', s.aceptados
      ) order by s.dia)
      from serie s
    ), '[]'::jsonb)
  )
  into resultado;

  return resultado;
end;
$$;

create or replace function public.listar_campanas_notificaciones_admin(
  p_desde timestamptz,
  p_hasta timestamptz,
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
declare
  total bigint;
  filas jsonb;
begin
  if p_desde is null or p_hasta is null or p_hasta <= p_desde
     or p_hasta > p_desde + interval '366 days'
     or p_estado is null
     or p_estado not in ('todos', 'borrador', 'programada', 'en_curso', 'completada', 'cancelada', 'error')
     or p_limite is null or p_limite < 1 or p_limite > 50
     or p_offset is null or p_offset < 0 or p_offset > 100000 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  select pg_catalog.count(*)::bigint
    into total
  from public.push_campanas c
  where (p_estado = 'todos' or c.estado = p_estado)
    and (
      (c.creada_en >= p_desde and c.creada_en < p_hasta)
      or (c.programada_para >= p_desde and c.programada_para < p_hasta)
    );

  select coalesce(pg_catalog.jsonb_agg(fila order by fila ->> 'creada_en' desc, fila ->> 'id'), '[]'::jsonb)
    into filas
  from (
    select pg_catalog.jsonb_build_object(
      'id', c.id,
      'clave', case
        when c.clave ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$' then c.clave
        else 'campana'
      end,
      'titulo', case
        when pg_catalog.char_length(c.titulo) between 1 and 120
          and pg_catalog.strpos(pg_catalog.lower(c.titulo), 'http') = 0
          and pg_catalog.strpos(c.titulo, '@') = 0
          then c.titulo
        else 'Campaña'
      end,
      'estado', c.estado,
      'creada_en', c.creada_en,
      'programada_para', c.programada_para,
      'iniciada_en', c.iniciada_en,
      'finalizada_en', c.finalizada_en,
      'habilitada', c.habilitada,
      'dispositivos', (
        select pg_catalog.count(distinct e.suscripcion_id)::bigint
        from public.push_envios e
        where e.campana_id = c.id
      ),
      'envios', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id),
      'aceptados', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id and e.estado = 'aceptado'),
      'errores', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id and e.estado = 'error'),
      'expirados', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id and e.estado = 'expirado'),
      'omitidos', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id and e.estado = 'omitido'),
      'pendientes', (
        select pg_catalog.count(*)::bigint
        from public.push_envios e
        where e.campana_id = c.id and e.estado in ('pendiente', 'enviando')
      )
    ) as fila
    from public.push_campanas c
    where (p_estado = 'todos' or c.estado = p_estado)
      and (
        (c.creada_en >= p_desde and c.creada_en < p_hasta)
        or (c.programada_para >= p_desde and c.programada_para < p_hasta)
      )
    order by c.creada_en desc, c.id
    limit p_limite
    offset p_offset
  ) pagina;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'total', total,
    'limite', p_limite,
    'offset', p_offset,
    'filas', filas
  );
end;
$$;

create or replace function public.detalle_campana_notificaciones_admin(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resultado jsonb;
begin
  if p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  select pg_catalog.jsonb_build_object(
    'ok', true,
    'id', c.id,
    'clave', case
      when c.clave ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$' then c.clave
      else 'campana'
    end,
    'titulo', case
      when pg_catalog.char_length(c.titulo) between 1 and 120
        and pg_catalog.strpos(pg_catalog.lower(c.titulo), 'http') = 0
        and pg_catalog.strpos(c.titulo, '@') = 0
        then c.titulo
      else 'Campaña'
    end,
    'estado', c.estado,
    'creada_en', c.creada_en,
    'programada_para', c.programada_para,
    'iniciada_en', c.iniciada_en,
    'finalizada_en', c.finalizada_en,
    'habilitada', c.habilitada,
    'dispositivos', (
      select pg_catalog.count(distinct e.suscripcion_id)::bigint
      from public.push_envios e
      where e.campana_id = c.id
    ),
    'envios', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id),
    'aceptados', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id and e.estado = 'aceptado'),
    'errores', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id and e.estado = 'error'),
    'expirados', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id and e.estado = 'expirado'),
    'omitidos', (select pg_catalog.count(*)::bigint from public.push_envios e where e.campana_id = c.id and e.estado = 'omitido'),
    'pendientes', (
      select pg_catalog.count(*)::bigint
      from public.push_envios e
      where e.campana_id = c.id and e.estado in ('pendiente', 'enviando')
    )
  )
  into resultado
  from public.push_campanas c
  where c.id = p_id;

  if resultado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrada');
  end if;
  return resultado;
end;
$$;

revoke all on function public.resumen_notificaciones_admin(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.listar_campanas_notificaciones_admin(timestamptz, timestamptz, text, integer, integer) from public, anon, authenticated;
revoke all on function public.detalle_campana_notificaciones_admin(uuid) from public, anon, authenticated;

grant execute on function public.resumen_notificaciones_admin(timestamptz, timestamptz) to service_role;
grant execute on function public.listar_campanas_notificaciones_admin(timestamptz, timestamptz, text, integer, integer) to service_role;
grant execute on function public.detalle_campana_notificaciones_admin(uuid) to service_role;
