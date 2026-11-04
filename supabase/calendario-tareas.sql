-- ENFLORA · Calendario de tareas del cultivador.
-- Extiende tareas_programadas (no crea un módulo paralelo).
-- Aplicar manualmente en el SQL Editor. No ejecutar desde la app.
--
-- Recordatorios push:
--   Esta migración guarda el aviso y expone reclamar_avisos_tareas / liberar_aviso_tarea
--   solo para service_role. No programa ningún cron.
--   Para que un aviso salga al teléfono hace falta, además de esta migración:
--     1. Las claves VAPID que ya usa el push web (FCM) y SUPABASE_SERVICE_ROLE_KEY.
--     2. CRON_SECRET en el proyecto. vercel.json llama GET /api/calendario/recordatorios
--        cada minuto; Vercel manda Authorization: Bearer <CRON_SECRET>.
--   Sin eso la app guarda la tarea y no envía nada.

alter table public.tareas_programadas
  add column if not exists espacio_id uuid references public.espacios (id) on delete cascade;

alter table public.tareas_programadas
  add column if not exists tipo text not null default 'personalizada';

alter table public.tareas_programadas
  add column if not exists hora_programada time not null default '09:00:00';

alter table public.tareas_programadas
  add column if not exists estado text not null default 'pendiente';

alter table public.tareas_programadas
  add column if not exists aviso_push boolean not null default true;

alter table public.tareas_programadas
  add column if not exists aviso_enviado_en timestamptz;

update public.tareas_programadas as tarea
set espacio_id = unidad.espacio_id
from public.unidades_cultivo as unidad
where tarea.unidad_cultivo_id = unidad.id
  and tarea.espacio_id is null;

delete from public.tareas_programadas
where espacio_id is null;

alter table public.tareas_programadas
  alter column espacio_id set not null;

update public.tareas_programadas
set estado = 'completada'
where completada = true
  and estado = 'pendiente';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tareas_tipo_valido'
  ) then
    alter table public.tareas_programadas
      add constraint tareas_tipo_valido
      check (tipo in ('riego', 'fertilizacion', 'poda', 'revision', 'personalizada'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tareas_estado_valido'
  ) then
    alter table public.tareas_programadas
      add constraint tareas_estado_valido
      check (estado in ('pendiente', 'completada', 'cancelada'));
  end if;
end $$;

create index if not exists tareas_programadas_usuario_estado_fecha_idx
  on public.tareas_programadas (usuario_id, estado, fecha_programada, hora_programada);

create index if not exists tareas_avisos_pendientes_idx
  on public.tareas_programadas (fecha_programada, hora_programada)
  where estado = 'pendiente' and aviso_push and aviso_enviado_en is null;

create or replace function public.tareas_sincronizar_estado()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.completada is distinct from old.completada
     and new.estado is not distinct from old.estado then
    if new.completada then
      new.estado := 'completada';
    elsif old.estado = 'completada' then
      new.estado := 'pendiente';
    end if;
  else
    new.completada := new.estado = 'completada';
  end if;

  new.fecha_actualizacion := now();
  return new;
end;
$$;

drop trigger if exists tareas_sincronizar_estado_trg on public.tareas_programadas;
create trigger tareas_sincronizar_estado_trg
  before insert or update on public.tareas_programadas
  for each row
  execute function public.tareas_sincronizar_estado();

create or replace function public.tareas_validar_propiedad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.unidades_cultivo as unidad
    join public.espacios as espacio on espacio.id = unidad.espacio_id
    where unidad.id = new.unidad_cultivo_id
      and espacio.id = new.espacio_id
      and espacio.usuario_id = new.usuario_id
  ) then
    raise exception 'La tarea no pertenece a tu cultivo.';
  end if;
  return new;
end;
$$;

drop trigger if exists tareas_validar_propiedad_trg on public.tareas_programadas;
create trigger tareas_validar_propiedad_trg
  before insert or update on public.tareas_programadas
  for each row
  execute function public.tareas_validar_propiedad();

create or replace function public.tarea_plantas_validar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.tareas_programadas as tarea
    join public.plantas as planta on planta.id = new.planta_id
    join public.unidades_cultivo as unidad on unidad.id = planta.unidad_cultivo_id
    join public.espacios as espacio on espacio.id = unidad.espacio_id
    where tarea.id = new.tarea_id
      and planta.unidad_cultivo_id = tarea.unidad_cultivo_id
      and espacio.usuario_id = tarea.usuario_id
  ) then
    raise exception 'Una planta no pertenece a la unidad.';
  end if;
  return new;
end;
$$;

drop trigger if exists tarea_plantas_validar_trg on public.tarea_plantas;
create trigger tarea_plantas_validar_trg
  before insert or update on public.tarea_plantas
  for each row
  execute function public.tarea_plantas_validar();

alter table public.tareas_programadas enable row level security;
alter table public.tarea_plantas enable row level security;

drop policy if exists tareas_propias on public.tareas_programadas;
create policy tareas_propias on public.tareas_programadas
  for all
  to authenticated
  using (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.unidades_cultivo as unidad
      join public.espacios as espacio on espacio.id = unidad.espacio_id
      where unidad.id = unidad_cultivo_id
        and espacio.id = espacio_id
        and espacio.usuario_id = auth.uid()
    )
  )
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.unidades_cultivo as unidad
      join public.espacios as espacio on espacio.id = unidad.espacio_id
      where unidad.id = unidad_cultivo_id
        and espacio.id = espacio_id
        and espacio.usuario_id = auth.uid()
    )
  );

drop policy if exists tarea_plantas_propias on public.tarea_plantas;
create policy tarea_plantas_propias on public.tarea_plantas
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.tareas_programadas as tarea
      join public.plantas as planta on planta.id = planta_id
      join public.unidades_cultivo as unidad on unidad.id = planta.unidad_cultivo_id
      join public.espacios as espacio on espacio.id = unidad.espacio_id
      where tarea.id = tarea_id
        and tarea.usuario_id = auth.uid()
        and planta.unidad_cultivo_id = tarea.unidad_cultivo_id
        and espacio.usuario_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tareas_programadas as tarea
      join public.plantas as planta on planta.id = planta_id
      join public.unidades_cultivo as unidad on unidad.id = planta.unidad_cultivo_id
      join public.espacios as espacio on espacio.id = unidad.espacio_id
      where tarea.id = tarea_id
        and tarea.usuario_id = auth.uid()
        and planta.unidad_cultivo_id = tarea.unidad_cultivo_id
        and espacio.usuario_id = auth.uid()
    )
  );

-- Atajo existente del registro: misma firma, ahora completa espacio, tipo y hora.
create or replace function public.crear_tarea_programada(
  p_unidad_id uuid,
  p_descripcion text,
  p_fecha date,
  p_planta_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  nueva_id uuid;
  espacio uuid;
  planta_uuid uuid;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if not public.usuario_es_dueno_unidad(p_unidad_id, usuario) then
    raise exception 'No se encontró la unidad.';
  end if;

  select unidad.espacio_id into espacio
  from public.unidades_cultivo as unidad
  where unidad.id = p_unidad_id;

  if espacio is null or not public.usuario_es_dueno_espacio(espacio, usuario) then
    raise exception 'No se encontró el espacio.';
  end if;

  if trim(coalesce(p_descripcion, '')) = '' then
    raise exception 'Escribí la tarea.';
  end if;

  if char_length(trim(p_descripcion)) > 500 then
    raise exception 'La tarea es demasiado larga.';
  end if;

  if p_fecha is null or p_fecha < hoy then
    raise exception 'La fecha no puede ser anterior a hoy.';
  end if;

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
    espacio,
    p_unidad_id,
    'personalizada',
    trim(p_descripcion),
    p_fecha,
    '09:00',
    'pendiente',
    true
  )
  returning id into nueva_id;

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
      insert into public.tarea_plantas (tarea_id, planta_id)
      values (nueva_id, planta_uuid)
      on conflict do nothing;
    end loop;
  end if;

  return nueva_id;
end;
$$;

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
        aviso_enviado_en = aviso_previo
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

-- Cambia el estado. No inserta ni modifica registros de cultivo.
create or replace function public.cambiar_estado_tarea_calendario(
  p_id uuid,
  p_estado text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  actualizado integer;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if p_estado is null or p_estado not in ('pendiente', 'completada', 'cancelada') then
    raise exception 'El estado no es válido.';
  end if;

  update public.tareas_programadas
  set estado = p_estado
  where id = p_id
    and usuario_id = usuario;

  get diagnostics actualizado = row_count;
  if actualizado = 0 then
    raise exception 'No se encontró la tarea.';
  end if;

  return p_estado;
end;
$$;

create or replace function public.eliminar_tarea_calendario(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  borrada integer;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  delete from public.tareas_programadas
  where id = p_id
    and usuario_id = usuario;

  get diagnostics borrada = row_count;
  if borrada = 0 then
    raise exception 'No se encontró la tarea.';
  end if;
end;
$$;

create or replace function public.reclamar_avisos_tareas(p_limite integer default 40)
returns table (
  id uuid,
  usuario_id uuid,
  tipo text,
  descripcion text,
  unidad_nombre text,
  fecha_programada date,
  hora_programada time
)
language plpgsql
security definer
set search_path = public
as $$
declare
  limite integer := least(greatest(coalesce(p_limite, 40), 1), 80);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado.';
  end if;

  return query
  with candidatas as (
    select tarea.id
    from public.tareas_programadas as tarea
    where tarea.estado = 'pendiente'
      and tarea.aviso_push
      and tarea.aviso_enviado_en is null
      and (tarea.fecha_programada + tarea.hora_programada) at time zone 'America/Argentina/Buenos_Aires' <= now()
      and (tarea.fecha_programada + tarea.hora_programada) at time zone 'America/Argentina/Buenos_Aires' > now() - interval '12 hours'
    order by tarea.fecha_programada, tarea.hora_programada
    limit limite
    for update skip locked
  ),
  marcadas as (
    update public.tareas_programadas as tarea
    set aviso_enviado_en = now()
    from candidatas
    where tarea.id = candidatas.id
    returning
      tarea.id,
      tarea.usuario_id,
      tarea.tipo,
      tarea.descripcion,
      tarea.unidad_cultivo_id,
      tarea.fecha_programada,
      tarea.hora_programada
  )
  select
    marcada.id,
    marcada.usuario_id,
    marcada.tipo,
    marcada.descripcion,
    unidad.nombre,
    marcada.fecha_programada,
    marcada.hora_programada
  from marcadas as marcada
  join public.unidades_cultivo as unidad on unidad.id = marcada.unidad_cultivo_id;
end;
$$;

create or replace function public.liberar_aviso_tarea(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado.';
  end if;

  update public.tareas_programadas
  set aviso_enviado_en = null
  where id = p_id
    and estado = 'pendiente';
end;
$$;

revoke all on function public.guardar_tarea_calendario(uuid, uuid, uuid, text, text, date, time, uuid[], boolean) from public, anon;
grant execute on function public.guardar_tarea_calendario(uuid, uuid, uuid, text, text, date, time, uuid[], boolean) to authenticated;

revoke all on function public.cambiar_estado_tarea_calendario(uuid, text) from public, anon;
grant execute on function public.cambiar_estado_tarea_calendario(uuid, text) to authenticated;

revoke all on function public.eliminar_tarea_calendario(uuid) from public, anon;
grant execute on function public.eliminar_tarea_calendario(uuid) to authenticated;

revoke all on function public.reclamar_avisos_tareas(integer) from public, anon, authenticated;
grant execute on function public.reclamar_avisos_tareas(integer) to service_role;

revoke all on function public.liberar_aviso_tarea(uuid) from public, anon, authenticated;
grant execute on function public.liberar_aviso_tarea(uuid) to service_role;
