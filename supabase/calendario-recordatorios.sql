-- ENFLORA · Recordatorios del calendario.
-- Aplicar en el SQL Editor después de supabase/calendario-tareas.sql.
-- No borra tareas ni suscripciones. No reejecutar calendario-tareas.sql en producción.
--
-- La hora guardada es hora de pared en America/Argentina/Buenos_Aires (sin horario
-- de verano). 14:03 en el calendario equivalen a 17:03 UTC, no a 14:03 UTC.
-- El cron declarado es cada minuto UTC. Una tarea se avisa cuando ya llegó su
-- hora y todavía no pasaron 30 minutos. Un corte más largo no dispara el atraso.
-- aviso_enviado_en significa que el proveedor push aceptó al menos un envío.
-- No confirma que el teléfono lo haya mostrado.

alter table public.tareas_programadas
  add column if not exists aviso_reclamado_en timestamptz;

alter table public.tareas_programadas
  add column if not exists aviso_intentos integer not null default 0;

alter table public.tareas_programadas
  add column if not exists aviso_reintento_en timestamptz;

alter table public.tareas_programadas
  add column if not exists aviso_cierre text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tareas_aviso_cierre_valido'
  ) then
    alter table public.tareas_programadas
      add constraint tareas_aviso_cierre_valido
      check (aviso_cierre is null or aviso_cierre in ('sin_dispositivo', 'error'));
  end if;
end $$;

create index if not exists tareas_avisos_calendario_idx
  on public.tareas_programadas (fecha_programada, hora_programada)
  where estado = 'pendiente'
    and aviso_push
    and aviso_enviado_en is null
    and aviso_cierre is null;

create table if not exists public.calendario_recordatorios_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  iniciada_en timestamptz not null default pg_catalog.now(),
  terminada_en timestamptz,
  estado text not null,
  motivo text,
  examinadas integer not null default 0,
  elegibles integer not null default 0,
  procesadas integer not null default 0,
  aceptadas integer not null default 0,
  errores integer not null default 0,
  sin_dispositivo integer not null default 0,
  expiradas integer not null default 0,
  omitidas integer not null default 0,
  constraint calendario_recordatorios_estado_valido check (estado in ('ok', 'error', 'omitido')),
  constraint calendario_recordatorios_motivo_valido check (
    motivo is null or motivo in ('configuracion', 'excepcion', 'migracion')
  )
);

create index if not exists calendario_recordatorios_ejecuciones_inicio_idx
  on public.calendario_recordatorios_ejecuciones (iniciada_en desc);

alter table public.calendario_recordatorios_ejecuciones enable row level security;
revoke all on table public.calendario_recordatorios_ejecuciones from public, anon, authenticated;

create or replace function public.guardar_tarea_calendario(
  p_id uuid,
  p_espacio_id uuid,
  p_unidad_id uuid,
  p_tipo text,
  p_descripcion text,
  p_fecha date,
  p_hora time,
  p_planta_ids uuid[],
  p_aviso_push boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  tarea_id uuid;
  previa public.tareas_programadas%rowtype;
  planta_uuid uuid;
  aviso_previo timestamptz;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if p_tipo is null or p_tipo not in ('riego', 'fertilizacion', 'poda', 'revision', 'personalizada') then
    raise exception 'El tipo de tarea no es válido.';
  end if;

  if not public.usuario_es_dueno_espacio(p_espacio_id, usuario) then
    raise exception 'No se encontró el espacio.';
  end if;

  if not public.usuario_es_dueno_unidad(p_unidad_id, usuario) then
    raise exception 'No se encontró la unidad.';
  end if;

  if not exists (
    select 1
    from public.unidades_cultivo as unidad
    where unidad.id = p_unidad_id
      and unidad.espacio_id = p_espacio_id
  ) then
    raise exception 'La unidad no pertenece al espacio.';
  end if;

  if trim(coalesce(p_descripcion, '')) = '' then
    raise exception 'Escribí la tarea.';
  end if;

  if char_length(trim(p_descripcion)) > 500 then
    raise exception 'La tarea es demasiado larga.';
  end if;

  if p_fecha is null or p_fecha < date '2020-01-01' or p_fecha > date '2100-12-31' then
    raise exception 'La fecha no es válida.';
  end if;

  if p_hora is null then
    raise exception 'La hora no es válida.';
  end if;

  if p_planta_ids is not null then
    foreach planta_uuid in array p_planta_ids loop
      if planta_uuid is null then
        continue;
      end if;
      if not public.usuario_es_dueno_planta(planta_uuid, usuario) then
        raise exception 'Una planta no pertenece a tu cuenta.';
      end if;
      if not exists (
        select 1 from public.plantas as planta
        where planta.id = planta_uuid
          and planta.unidad_cultivo_id = p_unidad_id
      ) then
        raise exception 'Una planta no pertenece a la unidad.';
      end if;
    end loop;
  end if;

  if p_id is null then
    insert into public.tareas_programadas (
      usuario_id,
      espacio_id,
      unidad_cultivo_id,
      tipo,
      descripcion,
      fecha_programada,
      hora_programada,
      estado,
      aviso_push
    )
    values (
      usuario,
      p_espacio_id,
      p_unidad_id,
      p_tipo,
      trim(p_descripcion),
      p_fecha,
      p_hora,
      'pendiente',
      coalesce(p_aviso_push, true)
    )
    returning id into tarea_id;
  else
    select * into previa
    from public.tareas_programadas
    where id = p_id
      and usuario_id = usuario;

    if not found then
      raise exception 'No se encontró la tarea.';
    end if;

    if previa.estado <> 'pendiente' then
      raise exception 'Solo se editan tareas pendientes.';
    end if;

    aviso_previo := case
      when previa.fecha_programada is distinct from p_fecha
        or previa.hora_programada is distinct from p_hora
      then null
      else previa.aviso_enviado_en
    end;

    update public.tareas_programadas
    set espacio_id = p_espacio_id,
        unidad_cultivo_id = p_unidad_id,
        tipo = p_tipo,
        descripcion = trim(p_descripcion),
        fecha_programada = p_fecha,
        hora_programada = p_hora,
        aviso_push = coalesce(p_aviso_push, true),
        aviso_enviado_en = aviso_previo,
        aviso_reclamado_en = case
          when previa.fecha_programada is distinct from p_fecha
            or previa.hora_programada is distinct from p_hora
          then null
          else previa.aviso_reclamado_en
        end,
        aviso_intentos = case
          when previa.fecha_programada is distinct from p_fecha
            or previa.hora_programada is distinct from p_hora
          then 0
          else previa.aviso_intentos
        end,
        aviso_reintento_en = case
          when previa.fecha_programada is distinct from p_fecha
            or previa.hora_programada is distinct from p_hora
          then null
          else previa.aviso_reintento_en
        end,
        aviso_cierre = case
          when previa.fecha_programada is distinct from p_fecha
            or previa.hora_programada is distinct from p_hora
          then null
          else previa.aviso_cierre
        end
    where id = p_id
      and usuario_id = usuario;

    delete from public.tarea_plantas where tarea_id = p_id;
    tarea_id := p_id;
  end if;

  if p_planta_ids is not null then
    foreach planta_uuid in array p_planta_ids loop
      if planta_uuid is null then
        continue;
      end if;
      insert into public.tarea_plantas (tarea_id, planta_id)
      values (tarea_id, planta_uuid)
      on conflict do nothing;
    end loop;
  end if;

  return tarea_id;
end;
$$;

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
      tarea.aviso_reclamado_en
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
          'reclamado_en', marcada.aviso_reclamado_en
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

revoke all on function public.reclamar_avisos_calendario(integer) from public, anon, authenticated;
grant execute on function public.reclamar_avisos_calendario(integer) to service_role;

revoke all on function public.cerrar_intento_aviso_calendario(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.cerrar_intento_aviso_calendario(uuid, timestamptz, text) to service_role;

revoke all on function public.registrar_ejecucion_recordatorios_calendario(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_ejecucion_recordatorios_calendario(jsonb) to service_role;

revoke all on function public.resumen_recordatorios_calendario_admin() from public, anon, authenticated;
grant execute on function public.resumen_recordatorios_calendario_admin() to service_role;
