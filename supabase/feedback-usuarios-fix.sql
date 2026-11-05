-- ENFLORA · Corrección de feedback ya instalado.
--
-- Ejecutar a mano en el SQL Editor SOLO si feedback_usuarios.sql ya fue aplicado
-- y el diagnóstico marca contiene_nul_roto = true.
-- Si las funciones todavía no existen, aplicar supabase/feedback-usuarios.sql
-- (ya corregido) y no este archivo.
--
-- Reemplaza el cuerpo de enviar_feedback_usuario y gestionar_feedback_admin.
-- No toca tablas, filas, índices, triggers, políticas ni la auditoría.
-- CREATE OR REPLACE conserva el dueño. Los GRANT de abajo dejan los mismos roles:
-- authenticated ejecuta el alta; service_role ejecuta la gestión; anon no ejecuta ninguna.
-- No borra datos.

create or replace function public.enviar_feedback_usuario(p_categoria text, p_mensaje text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_mensaje text;
  v_cantidad bigint;
begin
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'sin_sesion');
  end if;
  if coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'anonimo');
  end if;
  if p_categoria is null or p_categoria not in ('sugerencia', 'error_app', 'opinion', 'otro') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'categoria_invalida');
  end if;

  v_mensaje := pg_catalog.regexp_replace(
    pg_catalog.btrim(coalesce(p_mensaje, '')),
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );
  -- text ya rechaza NUL. No comprobarlo en SQL: esa llamada falla al ejecutarse.
  if pg_catalog.char_length(v_mensaje) < 10
    or pg_catalog.char_length(v_mensaje) > 2000
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'mensaje_invalido');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('enflora.feedback_usuarios:' || v_uid::text)
  );

  select coalesce(pg_catalog.count(*), 0)::bigint
  into v_cantidad
  from public.feedback_usuarios
  where usuario_id = v_uid
    and creado_en >= pg_catalog.now() - interval '24 hours';

  if v_cantidad >= 5 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'limite');
  end if;

  if exists (
    select 1
    from public.feedback_usuarios
    where usuario_id = v_uid
      and categoria = p_categoria
      and mensaje = v_mensaje
      and creado_en >= pg_catalog.now() - interval '30 seconds'
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'duplicado');
  end if;

  insert into public.feedback_usuarios (usuario_id, categoria, mensaje)
  values (v_uid, p_categoria, v_mensaje);

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.gestionar_feedback_admin(
  p_admin uuid,
  p_id uuid,
  p_estado text,
  p_prioridad text,
  p_nota text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_prioridad text;
  v_nota text;
  v_nota_nueva text;
begin
  if p_admin is null
    or p_id is null
    or p_estado is null
    or p_estado not in ('nuevo', 'en_revision', 'planificado', 'implementado', 'descartado')
    or p_prioridad is null
    or p_prioridad not in ('baja', 'normal', 'alta')
    or p_nota is null
    or pg_catalog.char_length(p_nota) > 2000
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  v_nota_nueva := nullif(
    pg_catalog.regexp_replace(pg_catalog.btrim(p_nota), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    ''
  );
  if v_nota_nueva is not null and pg_catalog.char_length(v_nota_nueva) > 2000 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  select f.estado, f.prioridad, f.nota_admin
  into v_estado, v_prioridad, v_nota
  from public.feedback_usuarios as f
  where f.id = p_id
  for update;

  if v_estado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;

  if v_estado = p_estado
    and v_prioridad = p_prioridad
    and v_nota is not distinct from v_nota_nueva
  then
    return pg_catalog.jsonb_build_object('ok', true, 'cambio', false);
  end if;

  update public.feedback_usuarios
  set
    estado = p_estado,
    prioridad = p_prioridad,
    nota_admin = v_nota_nueva,
    revisado_por = p_admin,
    revisado_en = pg_catalog.now()
  where id = p_id;

  insert into public.admin_auditoria_feedback (
    administrador_id,
    accion,
    feedback_id,
    estado_anterior,
    estado_nuevo,
    prioridad_anterior,
    prioridad_nueva,
    nota_modificada
  )
  values (
    p_admin,
    'gestion',
    p_id,
    v_estado,
    p_estado,
    v_prioridad,
    p_prioridad,
    v_nota is distinct from v_nota_nueva
  );

  return pg_catalog.jsonb_build_object('ok', true, 'cambio', true);
end;
$$;

revoke all on function public.enviar_feedback_usuario(text, text) from public, anon, service_role;
grant execute on function public.enviar_feedback_usuario(text, text) to authenticated;

revoke all on function public.gestionar_feedback_admin(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.gestionar_feedback_admin(uuid, uuid, text, text, text) to service_role;
