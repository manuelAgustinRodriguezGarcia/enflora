-- ENFLORA · Intentos de recordatorios y cierre visible.
-- Ejecutar en el SQL Editor DESPUÉS de supabase/calendario-recordatorios.sql
-- (la versión ya aplicada en producción) y ANTES de desplegar el código de este sprint.
-- Idempotente. No borra tareas, no reabre avisos cerrados y no envía notificaciones.
-- No modifica push_envios: las campañas y la prueba siguen con sus tipos actuales.
alter table public.tareas_programadas drop constraint if exists tareas_aviso_cierre_valido;
alter table public.tareas_programadas
  add constraint tareas_aviso_cierre_valido
  check (
    aviso_cierre is null
    or aviso_cierre in (
      'sin_dispositivo',
      'error',
      'credenciales',
      'rechazado',
      'indeterminado',
      'vencido'
    )
  );

-- Un intento por dispositivo. No guarda endpoints, claves ni el cuerpo del proveedor.
-- Aceptado significa que el servicio push respondió 2xx, no que el teléfono lo mostró.
create table if not exists public.calendario_aviso_intentos (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas_programadas (id) on delete cascade,
  suscripcion_id uuid references public.push_suscripciones (id) on delete set null,
  reclamado_en timestamptz,
  intentado_en timestamptz not null default pg_catalog.now(),
  numero_intento integer,
  codigo_estado integer,
  categoria text not null,
  estado text not null,
  aceptado_en timestamptz,
  constraint calendario_aviso_intentos_estado check (
    estado in ('aceptado', 'error', 'expirado', 'omitido')
  ),
  constraint calendario_aviso_intentos_categoria check (
    categoria in (
      'aceptado',
      'temporal',
      'credenciales',
      'expirada',
      'rechazado',
      'sin_estado',
      'sin_dispositivo',
      'payload',
      'lectura',
      'cierre',
      'otro'
    )
  ),
  constraint calendario_aviso_intentos_codigo check (
    codigo_estado is null or (codigo_estado >= 100 and codigo_estado <= 599)
  ),
  constraint calendario_aviso_intentos_numero check (
    numero_intento is null or (numero_intento >= 0 and numero_intento <= 20)
  )
);

create index if not exists calendario_aviso_intentos_tarea_idx
  on public.calendario_aviso_intentos (tarea_id, intentado_en desc);

create index if not exists calendario_aviso_intentos_recientes_idx
  on public.calendario_aviso_intentos (intentado_en desc);

create unique index if not exists calendario_aviso_intentos_aceptado_idx
  on public.calendario_aviso_intentos (tarea_id, suscripcion_id)
  where estado = 'aceptado' and suscripcion_id is not null;

alter table public.calendario_aviso_intentos enable row level security;
revoke all on table public.calendario_aviso_intentos from public, anon, authenticated;
grant select, insert, update, delete on table public.calendario_aviso_intentos to service_role;

create or replace function public.reclamar_avisos_calendario(p_limite integer default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  limite integer := least(greatest(coalesce(p_limite, 40), 1), 80);
  examinadas integer := 0;
  resultado jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado.';
  end if;

  -- Lo que ya salió de la ventana no se envía tarde y tampoco queda pendiente en silencio.
  -- No toca un aviso_cierre ya puesto: los fallos históricos siguen cerrados.
  update public.tareas_programadas as tarea
  set aviso_cierre = 'vencido'
  where tarea.estado = 'pendiente'
    and tarea.aviso_push
    and tarea.aviso_enviado_en is null
    and tarea.aviso_cierre is null
    and (tarea.fecha_programada + tarea.hora_programada) at time zone 'America/Argentina/Buenos_Aires'
      <= now() - interval '30 minutes';

  select least(count(*)::bigint, 1000000)::int into examinadas
  from public.tareas_programadas as tarea
  where tarea.estado = 'pendiente'
    and tarea.aviso_push
    and tarea.aviso_enviado_en is null
    and tarea.aviso_cierre is null
    and (tarea.fecha_programada + tarea.hora_programada) at time zone 'America/Argentina/Buenos_Aires' <= now()
    and (tarea.fecha_programada + tarea.hora_programada) at time zone 'America/Argentina/Buenos_Aires' > now() - interval '30 minutes';

  with candidatas as (
    select tarea.id
    from public.tareas_programadas as tarea
    where tarea.estado = 'pendiente'
      and tarea.aviso_push
      and tarea.aviso_enviado_en is null
      and tarea.aviso_cierre is null
      and tarea.aviso_intentos < 5
      and (tarea.aviso_reintento_en is null or tarea.aviso_reintento_en <= now())
      and (tarea.aviso_reclamado_en is null or tarea.aviso_reclamado_en < now() - interval '2 minutes')
      and (tarea.fecha_programada + tarea.hora_programada) at time zone 'America/Argentina/Buenos_Aires' <= now()
      and (tarea.fecha_programada + tarea.hora_programada) at time zone 'America/Argentina/Buenos_Aires' > now() - interval '30 minutes'
    order by tarea.fecha_programada, tarea.hora_programada
    limit limite
    for update skip locked
  ),
  marcadas as (
    update public.tareas_programadas as tarea
    set aviso_reclamado_en = clock_timestamp(),
        aviso_intentos = tarea.aviso_intentos + 1
    from candidatas
    where tarea.id = candidatas.id
    returning
      tarea.id,
      tarea.usuario_id,
      tarea.tipo,
      tarea.descripcion,
      tarea.unidad_cultivo_id,
      tarea.fecha_programada,
      tarea.hora_programada,
      tarea.aviso_reclamado_en,
      tarea.aviso_intentos
  )
  select jsonb_build_object(
    'examinadas', examinadas,
    'tareas', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', marcada.id,
          'usuario_id', marcada.usuario_id,
          'tipo', marcada.tipo,
          'descripcion', marcada.descripcion,
          'unidad_nombre', unidad.nombre,
          'fecha_programada', marcada.fecha_programada,
          'hora_programada', to_char(marcada.hora_programada, 'HH24:MI'),
          'reclamado_en', marcada.aviso_reclamado_en,
          'intento', marcada.aviso_intentos
        )
      ),
      '[]'::jsonb
    )
  )
  into resultado
  from marcadas as marcada
  join public.unidades_cultivo as unidad on unidad.id = marcada.unidad_cultivo_id;

  if resultado is null then
    resultado := jsonb_build_object('examinadas', examinadas, 'tareas', '[]'::jsonb);
  end if;

  return resultado;
end;
$$;

create or replace function public.cerrar_intento_aviso_calendario(
  p_id uuid,
  p_reclamado_en timestamptz,
  p_resultado text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado.';
  end if;

  if p_id is null or p_reclamado_en is null then
    return;
  end if;

  if p_resultado = 'aceptado' then
    update public.tareas_programadas
    set aviso_enviado_en = clock_timestamp(),
        aviso_reclamado_en = null,
        aviso_reintento_en = null
    where id = p_id
      and aviso_enviado_en is null
      and estado = 'pendiente'
      and aviso_reclamado_en >= p_reclamado_en - interval '2 seconds'
      and aviso_reclamado_en <= p_reclamado_en + interval '2 seconds';
    return;
  end if;

  if p_resultado = 'liberar' then
    update public.tareas_programadas
    set aviso_reclamado_en = null
    where id = p_id
      and aviso_enviado_en is null
      and aviso_reclamado_en >= p_reclamado_en - interval '2 seconds'
      and aviso_reclamado_en <= p_reclamado_en + interval '2 seconds';
    return;
  end if;

  if p_resultado in ('credenciales', 'rechazado', 'indeterminado') then
    update public.tareas_programadas
    set aviso_reclamado_en = null,
        aviso_reintento_en = null,
        aviso_cierre = p_resultado
    where id = p_id
      and aviso_enviado_en is null
      and aviso_reclamado_en >= p_reclamado_en - interval '2 seconds'
      and aviso_reclamado_en <= p_reclamado_en + interval '2 seconds';
    return;
  end if;

  if p_resultado not in ('reintentar', 'sin_dispositivo') then
    return;
  end if;

  update public.tareas_programadas
  set aviso_reclamado_en = null,
      aviso_cierre = case
        when aviso_intentos >= 5 and p_resultado = 'sin_dispositivo' then 'sin_dispositivo'
        when aviso_intentos >= 5 then 'error'
        else null
      end,
      aviso_reintento_en = case
        when aviso_intentos >= 5 then null
        when aviso_intentos <= 1 then clock_timestamp() + interval '1 minute'
        when aviso_intentos = 2 then clock_timestamp() + interval '2 minutes'
        when aviso_intentos = 3 then clock_timestamp() + interval '4 minutes'
        else clock_timestamp() + interval '8 minutes'
      end
  where id = p_id
    and aviso_enviado_en is null
    and aviso_reclamado_en >= p_reclamado_en - interval '2 seconds'
    and aviso_reclamado_en <= p_reclamado_en + interval '2 seconds';
end;
$$;

create or replace function public.registrar_ejecucion_recordatorios_calendario(p_resumen jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  estado text := p_resumen->>'estado';
  motivo text := nullif(p_resumen->>'motivo', '');
  examinadas bigint := least(greatest(coalesce((p_resumen->>'examinadas')::bigint, 0), 0), 1000000);
  elegibles bigint := least(greatest(coalesce((p_resumen->>'elegibles')::bigint, 0), 0), 1000000);
  procesadas bigint := least(greatest(coalesce((p_resumen->>'procesadas')::bigint, 0), 0), 1000000);
  aceptadas bigint := least(greatest(coalesce((p_resumen->>'aceptadas')::bigint, 0), 0), 1000000);
  errores bigint := least(greatest(coalesce((p_resumen->>'errores')::bigint, 0), 0), 1000000);
  sin_dispositivo bigint := least(greatest(coalesce((p_resumen->>'sin_dispositivo')::bigint, 0), 0), 1000000);
  expiradas bigint := least(greatest(coalesce((p_resumen->>'expiradas')::bigint, 0), 0), 1000000);
  omitidas bigint := least(greatest(coalesce((p_resumen->>'omitidas')::bigint, 0), 0), 1000000);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado.';
  end if;

  if estado is null or estado not in ('ok', 'error', 'omitido') then
    raise exception 'estado';
  end if;

  if motivo is not null and motivo not in ('configuracion', 'excepcion', 'migracion') then
    motivo := null;
  end if;

  insert into public.calendario_recordatorios_ejecuciones (
    iniciada_en,
    terminada_en,
    estado,
    motivo,
    examinadas,
    elegibles,
    procesadas,
    aceptadas,
    errores,
    sin_dispositivo,
    expiradas,
    omitidas
  )
  values (
    pg_catalog.now(),
    pg_catalog.now(),
    estado,
    motivo,
    examinadas::int,
    elegibles::int,
    procesadas::int,
    aceptadas::int,
    errores::int,
    sin_dispositivo::int,
    expiradas::int,
    omitidas::int
  );

  delete from public.calendario_recordatorios_ejecuciones
  where iniciada_en < pg_catalog.now() - interval '14 days';

  delete from public.calendario_aviso_intentos
  where intentado_en < pg_catalog.now() - interval '14 days';
end;
$$;

create or replace function public.resumen_recordatorios_calendario_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ultima public.calendario_recordatorios_ejecuciones%rowtype;
  hay boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_autorizado');
  end if;

  select *
  into ultima
  from public.calendario_recordatorios_ejecuciones
  order by iniciada_en desc
  limit 1;
  hay := found;

  if not hay then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'cron_declarado', '* * * * *',
      'zona_cron', 'UTC',
      'vercel_confirmado', false,
      'entregas_disponibles', false,
      'medido_en', pg_catalog.now(),
      'hay_ejecucion', false,
      'ultima', null
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'cron_declarado', '* * * * *',
    'zona_cron', 'UTC',
    'vercel_confirmado', false,
    'entregas_disponibles', false,
    'medido_en', pg_catalog.now(),
    'hay_ejecucion', true,
    'ultima', pg_catalog.jsonb_build_object(
      'iniciada_en', ultima.iniciada_en,
      'terminada_en', ultima.terminada_en,
      'estado', ultima.estado,
      'motivo', ultima.motivo,
      'examinadas', ultima.examinadas,
      'elegibles', ultima.elegibles,
      'procesadas', ultima.procesadas,
      'aceptadas', ultima.aceptadas,
      'errores', ultima.errores,
      'sin_dispositivo', ultima.sin_dispositivo,
      'expiradas', ultima.expiradas,
      'omitidas', ultima.omitidas
    )
  );
end;
$$;

create or replace function public.listar_intentos_recordatorios_calendario_admin(p_limite integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  limite integer := least(greatest(coalesce(p_limite, 40), 1), 80);
  intentos jsonb := '[]'::jsonb;
  cierres jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_autorizado');
  end if;

  select coalesce(pg_catalog.jsonb_agg(fila.dato order by fila.intentado_en desc), '[]'::jsonb)
  into intentos
  from (
    select
      intento.intentado_en,
      pg_catalog.jsonb_build_object(
        'intentado_en', intento.intentado_en,
        'estado', intento.estado,
        'categoria', intento.categoria,
        'codigo_estado', intento.codigo_estado,
        'numero_intento', intento.numero_intento,
        'aceptado_en', intento.aceptado_en,
        'fecha_programada', tarea.fecha_programada,
        'hora_programada', pg_catalog.to_char(tarea.hora_programada, 'HH24:MI'),
        'referencia', pg_catalog.substr(intento.tarea_id::text, 1, 8)
      ) as dato
    from public.calendario_aviso_intentos as intento
    left join public.tareas_programadas as tarea on tarea.id = intento.tarea_id
    order by intento.intentado_en desc
    limit limite
  ) as fila;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'aviso_cierre', cierre.aviso_cierre,
        'cantidad', cierre.cantidad
      )
      order by cierre.aviso_cierre
    ),
    '[]'::jsonb
  )
  into cierres
  from (
    select tarea.aviso_cierre, count(*)::bigint as cantidad
    from public.tareas_programadas as tarea
    where tarea.aviso_cierre is not null
      and tarea.fecha_programada >= (pg_catalog.timezone('America/Argentina/Buenos_Aires', pg_catalog.now()))::date - 2
    group by tarea.aviso_cierre
  ) as cierre;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'entregas_disponibles', false,
    'intentos', intentos,
    'cierres', cierres
  );
end;
$$;

revoke all on function public.reclamar_avisos_calendario(integer) from public, anon, authenticated;
grant execute on function public.reclamar_avisos_calendario(integer) to service_role;

revoke all on function public.cerrar_intento_aviso_calendario(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.cerrar_intento_aviso_calendario(uuid, timestamptz, text) to service_role;

revoke all on function public.registrar_ejecucion_recordatorios_calendario(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_ejecucion_recordatorios_calendario(jsonb) to service_role;

revoke all on function public.resumen_recordatorios_calendario_admin() from public, anon, authenticated;
grant execute on function public.resumen_recordatorios_calendario_admin() to service_role;

revoke all on function public.listar_intentos_recordatorios_calendario_admin(integer) from public, anon, authenticated;
grant execute on function public.listar_intentos_recordatorios_calendario_admin(integer) to service_role;

