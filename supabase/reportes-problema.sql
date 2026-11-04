-- ENFLORA · Reportes de problema enviados a Flora.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase, después de registros, registro-fotos y flora_chats_guardados.
--
-- El historial del cultivo sigue siendo un registro con la acción nativa «problema»,
-- sus plantas (foto del momento) y sus fotos. Esta tabla solo guarda el alcance
-- explícito, la clave para no duplicar el envío y el chat de Flora.
-- No guarda la descripción ni las imágenes otra vez.
--
-- Es idempotente. No borra registros ni chats.

create table if not exists public.reportes_problema (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  registro_id uuid not null unique references public.registros (id) on delete cascade,
  unidad_cultivo_id uuid references public.unidades_cultivo (id) on delete set null,
  alcance text not null,
  clave_envio uuid not null,
  clave_sesion text not null,
  flora_chat_id uuid references public.flora_chats_guardados (id) on delete set null,
  estado text not null default 'guardado',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint reportes_problema_alcance check (alcance in ('unidad', 'seleccion')),
  constraint reportes_problema_estado check (
    estado in ('guardado', 'diagnosticando', 'enviado', 'error_flora')
  ),
  constraint reportes_problema_clave_sesion check (
    clave_sesion ~ '^[A-Za-z0-9_-]{8,80}$'
  )
);

create unique index if not exists reportes_problema_usuario_clave_uidx
  on public.reportes_problema (usuario_id, clave_envio);

create unique index if not exists reportes_problema_usuario_sesion_uidx
  on public.reportes_problema (usuario_id, clave_sesion);

create index if not exists reportes_problema_usuario_fecha_idx
  on public.reportes_problema (usuario_id, creado_en desc);

create index if not exists reportes_problema_unidad_idx
  on public.reportes_problema (unidad_cultivo_id, creado_en desc)
  where unidad_cultivo_id is not null;

create index if not exists reportes_problema_chat_idx
  on public.reportes_problema (flora_chat_id)
  where flora_chat_id is not null;

alter table public.reportes_problema enable row level security;

drop policy if exists reportes_problema_select_propios on public.reportes_problema;
create policy reportes_problema_select_propios
  on public.reportes_problema
  for select
  to authenticated
  using (usuario_id = auth.uid());

revoke all on public.reportes_problema from public, anon, authenticated;
grant select on public.reportes_problema to authenticated;

-- Misma regla que alcanceRegistroDeReporte en lib/reportes-problema.js.
create or replace function public.crear_reporte_problema(
  p_clave_envio uuid,
  p_unidad_cultivo_id uuid,
  p_alcance text,
  p_planta_ids uuid[],
  p_descripcion text,
  p_fotos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  existente public.reportes_problema;
  creado public.registros;
  v_ids uuid[];
  v_plantas jsonb;
  v_cantidad integer;
  v_alcance_registro text;
  v_observacion text;
  v_acciones jsonb;
  v_clave_sesion text;
  nuevo public.reportes_problema;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if p_clave_envio is null then
    raise exception 'El envío del reporte no es válido.';
  end if;

  if p_unidad_cultivo_id is null or not public.usuario_es_dueno_unidad(p_unidad_cultivo_id, usuario) then
    raise exception 'No se encontró la unidad.';
  end if;

  if p_alcance is null or p_alcance not in ('unidad', 'seleccion') then
    raise exception 'Indicá si el problema es de todas las plantas o solo de algunas.';
  end if;

  v_observacion := nullif(btrim(coalesce(p_descripcion, '')), '');
  if v_observacion is null then
    raise exception 'Contale a Flora qué está pasando.';
  end if;
  if char_length(v_observacion) > 4000 then
    raise exception 'La descripción es demasiado larga.';
  end if;

  perform pg_advisory_xact_lock(hashtext(usuario::text), hashtext(p_clave_envio::text));

  select *
  into existente
  from public.reportes_problema
  where usuario_id = usuario
    and clave_envio = p_clave_envio;

  if found then
    return jsonb_build_object(
      'reporte_id', existente.id,
      'registro_id', existente.registro_id,
      'estado', existente.estado,
      'clave_sesion', existente.clave_sesion,
      'flora_chat_id', existente.flora_chat_id,
      'ya_existia', true
    );
  end if;

  v_ids := array(
    select distinct id
    from unnest(coalesce(p_planta_ids, array[]::uuid[])) as pedido(id)
    where id is not null
  );

  if p_alcance = 'unidad' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'nombre', case
            when char_length(btrim(coalesce(p.nombre, ''))) > 0 then btrim(p.nombre)
            when p.numero is not null then 'Planta ' || p.numero::text
            else 'Planta'
          end,
          'numero', p.numero,
          'genetica', nullif(btrim(coalesce(p.genetica, '')), ''),
          'unidad_cultivo_id', p.unidad_cultivo_id,
          'nombre_unidad', u.nombre
        )
        order by p.numero nulls last, p.nombre
      ),
      '[]'::jsonb
    )
    into v_plantas
    from public.plantas p
    join public.unidades_cultivo u on u.id = p.unidad_cultivo_id
    join public.espacios e on e.id = u.espacio_id
    where p.unidad_cultivo_id = p_unidad_cultivo_id
      and e.usuario_id = usuario;
  else
    if coalesce(array_length(v_ids, 1), 0) < 1 then
      raise exception 'Elegí al menos una planta.';
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'nombre', case
            when char_length(btrim(coalesce(p.nombre, ''))) > 0 then btrim(p.nombre)
            when p.numero is not null then 'Planta ' || p.numero::text
            else 'Planta'
          end,
          'numero', p.numero,
          'genetica', nullif(btrim(coalesce(p.genetica, '')), ''),
          'unidad_cultivo_id', p.unidad_cultivo_id,
          'nombre_unidad', u.nombre
        )
        order by p.numero nulls last, p.nombre
      ),
      '[]'::jsonb
    )
    into v_plantas
    from public.plantas p
    join public.unidades_cultivo u on u.id = p.unidad_cultivo_id
    join public.espacios e on e.id = u.espacio_id
    where p.id = any(v_ids)
      and p.unidad_cultivo_id = p_unidad_cultivo_id
      and e.usuario_id = usuario;

    if jsonb_array_length(v_plantas) <> coalesce(array_length(v_ids, 1), 0) then
      raise exception 'Hay una planta que no pertenece a esta unidad.';
    end if;
  end if;

  v_cantidad := jsonb_array_length(v_plantas);
  if v_cantidad < 1 then
    raise exception 'Esta unidad no tiene plantas para reportar.';
  end if;

  if p_alcance = 'unidad' then
    v_alcance_registro := 'unidad';
  elsif v_cantidad = 1 then
    v_alcance_registro := 'planta';
  else
    v_alcance_registro := 'plantas';
  end if;

  v_acciones := jsonb_build_array(
    jsonb_build_object(
      'origen', 'nativa',
      'clave_nativa', 'problema',
      'opcion_id', null,
      'nombre', 'Problema'
    )
  );

  creado := public.crear_registro(
    v_alcance_registro,
    'plantas',
    null,
    p_unidad_cultivo_id,
    null,
    null,
    v_observacion,
    now(),
    v_plantas,
    v_acciones,
    '[]'::jsonb,
    coalesce(p_fotos, '[]'::jsonb),
    null
  );

  v_clave_sesion := 'reporte-' || replace(p_clave_envio::text, '-', '');

  insert into public.reportes_problema (
    usuario_id,
    registro_id,
    unidad_cultivo_id,
    alcance,
    clave_envio,
    clave_sesion,
    estado
  ) values (
    usuario,
    creado.id,
    p_unidad_cultivo_id,
    p_alcance,
    p_clave_envio,
    v_clave_sesion,
    'guardado'
  )
  returning * into nuevo;

  return jsonb_build_object(
    'reporte_id', nuevo.id,
    'registro_id', nuevo.registro_id,
    'estado', nuevo.estado,
    'clave_sesion', nuevo.clave_sesion,
    'flora_chat_id', nuevo.flora_chat_id,
    'ya_existia', false
  );
end;
$$;

create or replace function public.reclamar_diagnostico_reporte(p_reporte_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  fila public.reportes_problema;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  select *
  into fila
  from public.reportes_problema
  where id = p_reporte_id
    and usuario_id = usuario
  for update;

  if not found then
    raise exception 'No se encontró el reporte.';
  end if;

  if fila.estado = 'enviado' and fila.flora_chat_id is not null then
    return jsonb_build_object(
      'proceder', false,
      'motivo', 'abierto',
      'estado', fila.estado,
      'flora_chat_id', fila.flora_chat_id,
      'clave_sesion', fila.clave_sesion
    );
  end if;

  if fila.estado = 'diagnosticando' and fila.actualizado_en > now() - interval '90 seconds' then
    return jsonb_build_object(
      'proceder', false,
      'motivo', 'en_curso',
      'estado', fila.estado,
      'clave_sesion', fila.clave_sesion
    );
  end if;

  update public.reportes_problema
  set estado = 'diagnosticando',
      actualizado_en = now()
  where id = fila.id;

  return jsonb_build_object(
    'proceder', true,
    'motivo', 'enviar',
    'estado', 'diagnosticando',
    'clave_sesion', fila.clave_sesion
  );
end;
$$;

create or replace function public.cerrar_diagnostico_reporte(
  p_reporte_id uuid,
  p_estado text,
  p_flora_chat_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  fila public.reportes_problema;
  v_clave text;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if p_estado is null or p_estado not in ('enviado', 'error_flora') then
    raise exception 'El estado del reporte no es válido.';
  end if;

  select *
  into fila
  from public.reportes_problema
  where id = p_reporte_id
    and usuario_id = usuario
  for update;

  if not found then
    raise exception 'No se encontró el reporte.';
  end if;

  if fila.estado = 'enviado' and p_flora_chat_id is not null and fila.flora_chat_id = p_flora_chat_id then
    return jsonb_build_object(
      'ok', true,
      'estado', 'enviado',
      'flora_chat_id', fila.flora_chat_id
    );
  end if;

  if fila.estado = 'enviado' and p_estado = 'error_flora' then
    raise exception 'El reporte ya fue enviado.';
  end if;

  if p_estado = 'enviado' then
    if p_flora_chat_id is null then
      raise exception 'No se encontró la conversación.';
    end if;

    select clave_sesion
    into v_clave
    from public.flora_chats_guardados
    where id = p_flora_chat_id
      and usuario_id = usuario;

    if not found then
      raise exception 'No se puede asociar una conversación de otro usuario.';
    end if;

    if v_clave is distinct from fila.clave_sesion then
      raise exception 'La conversación no corresponde a este reporte.';
    end if;

    update public.reportes_problema
    set estado = 'enviado',
        flora_chat_id = p_flora_chat_id,
        actualizado_en = now()
    where id = fila.id;
  else
    update public.reportes_problema
    set estado = 'error_flora',
        actualizado_en = now()
    where id = fila.id
      and estado <> 'enviado';
  end if;

  return jsonb_build_object(
    'ok', true,
    'estado', p_estado,
    'flora_chat_id', case when p_estado = 'enviado' then p_flora_chat_id else fila.flora_chat_id end
  );
end;
$$;

revoke all on function public.crear_reporte_problema(uuid, uuid, text, uuid[], text, jsonb) from public, anon;
revoke all on function public.reclamar_diagnostico_reporte(uuid) from public, anon;
revoke all on function public.cerrar_diagnostico_reporte(uuid, text, uuid) from public, anon;

grant execute on function public.crear_reporte_problema(uuid, uuid, text, uuid[], text, jsonb) to authenticated;
grant execute on function public.reclamar_diagnostico_reporte(uuid) to authenticated;
grant execute on function public.cerrar_diagnostico_reporte(uuid, text, uuid) to authenticated;
