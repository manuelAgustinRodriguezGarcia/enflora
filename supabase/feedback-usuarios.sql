-- ENFLORA · Feedback de la aplicación.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase, después de perfiles.
-- No modifica cultivos, chats, fotos, Flora ni el resto del esquema.
--
-- Es idempotente: CREATE OR REPLACE, CREATE TABLE IF NOT EXISTS y DROP TRIGGER IF EXISTS.
-- No borra datos.
--
-- Los números del cupo tienen que coincidir con lib/feedback/reglas.js:
--   5 envíos por usuario, ventana de 24 horas, y el mismo texto se rechaza 30 segundos.
-- El candado es pg_advisory_xact_lock por usuario: dos altas simultáneas se ordenan.
--
-- La cuenta autenticada solo puede ejecutar enviar_feedback_usuario(text, text).
-- Esa función no recibe usuario_id, estado, prioridad ni nota. Los fija ella.
-- No hay lectura para la cuenta: no ofrecemos historial.
-- El panel usa las funciones *_admin, solo con service_role, después de
-- comprobar el módulo feedback en el servidor (ADMIN_IDS o ADMIN_IDS_FEEDBACK).
--
-- COALESCE, NULLIF y el resto de la sintaxis del parser quedan sin esquema.
-- El conteo se escribe ::bigint.

create table if not exists public.feedback_usuarios (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  categoria text not null,
  mensaje text not null,
  estado text not null default 'nuevo',
  prioridad text not null default 'normal',
  nota_admin text,
  revisado_por uuid references auth.users (id) on delete set null,
  revisado_en timestamptz,
  creado_en timestamptz not null default pg_catalog.now(),
  actualizado_en timestamptz not null default pg_catalog.now(),
  constraint feedback_usuarios_categoria check (
    categoria in ('sugerencia', 'error_app', 'opinion', 'otro')
  ),
  constraint feedback_usuarios_estado check (
    estado in ('nuevo', 'en_revision', 'planificado', 'implementado', 'descartado')
  ),
  constraint feedback_usuarios_prioridad check (
    prioridad in ('baja', 'normal', 'alta')
  ),
  constraint feedback_usuarios_mensaje_largo check (
    pg_catalog.char_length(mensaje) between 10 and 2000
  ),
  constraint feedback_usuarios_nota_largo check (
    nota_admin is null or pg_catalog.char_length(nota_admin) between 1 and 2000
  )
);

alter table public.feedback_usuarios enable row level security;

revoke all on table public.feedback_usuarios from public, anon, authenticated, service_role;

create index if not exists feedback_usuarios_creado_en_idx
  on public.feedback_usuarios (creado_en desc);

create index if not exists feedback_usuarios_usuario_id_idx
  on public.feedback_usuarios (usuario_id);

create index if not exists feedback_usuarios_categoria_idx
  on public.feedback_usuarios (categoria);

create index if not exists feedback_usuarios_estado_idx
  on public.feedback_usuarios (estado);

create table if not exists public.admin_auditoria_feedback (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  administrador_id uuid not null,
  accion text not null,
  feedback_id uuid,
  estado_anterior text,
  estado_nuevo text,
  prioridad_anterior text,
  prioridad_nueva text,
  nota_modificada boolean not null default false,
  registrado_en timestamptz not null default pg_catalog.now(),
  constraint admin_auditoria_feedback_accion check (accion in ('listado', 'detalle', 'gestion')),
  constraint admin_auditoria_feedback_objetivo check (
    (
      accion = 'listado'
      and feedback_id is null
      and estado_anterior is null
      and estado_nuevo is null
      and prioridad_anterior is null
      and prioridad_nueva is null
      and nota_modificada = false
    )
    or (
      accion = 'detalle'
      and feedback_id is not null
      and estado_anterior is null
      and estado_nuevo is null
      and prioridad_anterior is null
      and prioridad_nueva is null
      and nota_modificada = false
    )
    or (
      accion = 'gestion'
      and feedback_id is not null
      and estado_anterior is not null
      and estado_nuevo is not null
      and prioridad_anterior is not null
      and prioridad_nueva is not null
    )
  )
);

alter table public.admin_auditoria_feedback enable row level security;

revoke all on table public.admin_auditoria_feedback from public, anon, authenticated, service_role;

create index if not exists admin_auditoria_feedback_registrado_en_idx
  on public.admin_auditoria_feedback (registrado_en desc);

create or replace function public.feedback_usuarios_normalizar_alta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.usuario_id := auth.uid();
  if new.usuario_id is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception 'feedback_no_autorizado';
  end if;
  new.estado := 'nuevo';
  new.prioridad := 'normal';
  new.nota_admin := null;
  new.revisado_por := null;
  new.revisado_en := null;
  new.creado_en := pg_catalog.now();
  new.actualizado_en := pg_catalog.now();
  return new;
end;
$$;

create or replace function public.feedback_usuarios_marcar_actualizacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon', 'authenticator') then
    raise exception 'feedback_no_autorizado';
  end if;
  if new.id is distinct from old.id
    or new.usuario_id is distinct from old.usuario_id
    or new.categoria is distinct from old.categoria
    or new.mensaje is distinct from old.mensaje
    or new.creado_en is distinct from old.creado_en
  then
    raise exception 'feedback_inmutable';
  end if;
  new.actualizado_en := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.feedback_usuarios_normalizar_alta() from public, anon, authenticated, service_role;
revoke all on function public.feedback_usuarios_marcar_actualizacion() from public, anon, authenticated, service_role;

drop trigger if exists feedback_usuarios_normalizar_alta on public.feedback_usuarios;
create trigger feedback_usuarios_normalizar_alta
before insert on public.feedback_usuarios
for each row execute function public.feedback_usuarios_normalizar_alta();

drop trigger if exists feedback_usuarios_actualizacion on public.feedback_usuarios;
create trigger feedback_usuarios_actualizacion
before update on public.feedback_usuarios
for each row execute function public.feedback_usuarios_marcar_actualizacion();

create or replace function public.feedback_admin_enmascarar(p_correo text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_correo is null
      or pg_catalog.strpos(p_correo, '@') < 2
      or pg_catalog.split_part(p_correo, '@', 2) = ''
      then null
    else pg_catalog.left(pg_catalog.split_part(p_correo, '@', 1), 1)
      || '***@'
      || pg_catalog.split_part(p_correo, '@', 2)
  end;
$$;

revoke all on function public.feedback_admin_enmascarar(text) from public, anon, authenticated, service_role;

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
  if pg_catalog.char_length(v_mensaje) < 10
    or pg_catalog.char_length(v_mensaje) > 2000
    or pg_catalog.strpos(v_mensaje, pg_catalog.chr(0)) > 0
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

revoke all on function public.enviar_feedback_usuario(text, text) from public, anon, service_role;
grant execute on function public.enviar_feedback_usuario(text, text) to authenticated;

create or replace function public.listar_feedback_admin(
  p_admin uuid,
  p_categoria text,
  p_estado text,
  p_prioridad text,
  p_limite integer,
  p_offset integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nuevo bigint;
  v_revision bigint;
  v_resueltos bigint;
  v_total bigint;
  v_filas jsonb;
begin
  if p_admin is null
    or p_categoria is null
    or p_categoria not in ('todos', 'sugerencia', 'error_app', 'opinion', 'otro')
    or p_estado is null
    or p_estado not in ('todos', 'nuevo', 'en_revision', 'planificado', 'implementado', 'descartado')
    or p_prioridad is null
    or p_prioridad not in ('todos', 'baja', 'normal', 'alta')
    or p_limite is distinct from 20
    or p_offset is null
    or p_offset < 0
    or p_offset > 100000
    or p_offset % 20 <> 0
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  insert into public.admin_auditoria_feedback (administrador_id, accion)
  values (p_admin, 'listado');

  select
    coalesce(pg_catalog.count(*) filter (where f.estado = 'nuevo'), 0)::bigint,
    coalesce(pg_catalog.count(*) filter (where f.estado = 'en_revision'), 0)::bigint,
    coalesce(pg_catalog.count(*) filter (where f.estado in ('implementado', 'descartado')), 0)::bigint
  into v_nuevo, v_revision, v_resueltos
  from public.feedback_usuarios as f
  where (p_categoria = 'todos' or f.categoria = p_categoria)
    and (p_prioridad = 'todos' or f.prioridad = p_prioridad);

  select coalesce(pg_catalog.count(*), 0)::bigint
  into v_total
  from public.feedback_usuarios as f
  where (p_categoria = 'todos' or f.categoria = p_categoria)
    and (p_prioridad = 'todos' or f.prioridad = p_prioridad)
    and (p_estado = 'todos' or f.estado = p_estado);

  select coalesce(
    pg_catalog.jsonb_agg(fila.dato order by fila.creado_en desc, fila.id desc),
    '[]'::jsonb
  )
  into v_filas
  from (
    select
      f.id,
      f.creado_en,
      pg_catalog.jsonb_build_object(
        'id', f.id,
        'categoria', f.categoria,
        'resumen', case
          when pg_catalog.char_length(f.mensaje) <= 140 then f.mensaje
          else pg_catalog.left(f.mensaje, 140) || '…'
        end,
        'creado_en', f.creado_en,
        'estado', f.estado,
        'prioridad', f.prioridad,
        'nombre', pf.nombre,
        'nombre_usuario', pf.nombre_usuario,
        'correo', public.feedback_admin_enmascarar(u.email)
      ) as dato
    from public.feedback_usuarios as f
    left join public.perfiles as pf on pf.id = f.usuario_id
    left join auth.users as u on u.id = f.usuario_id
    where (p_categoria = 'todos' or f.categoria = p_categoria)
      and (p_prioridad = 'todos' or f.prioridad = p_prioridad)
      and (p_estado = 'todos' or f.estado = p_estado)
    order by f.creado_en desc, f.id desc
    limit p_limite
    offset p_offset
  ) as fila;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'total', v_total,
    'limite', p_limite,
    'offset', p_offset,
    'contadores', pg_catalog.jsonb_build_object(
      'nuevo', v_nuevo,
      'en_revision', v_revision,
      'resueltos', v_resueltos
    ),
    'filas', v_filas
  );
end;
$$;

create or replace function public.detalle_feedback_admin(p_admin uuid, p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_feedback jsonb;
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  select pg_catalog.jsonb_build_object(
    'id', f.id,
    'categoria', f.categoria,
    'mensaje', f.mensaje,
    'creado_en', f.creado_en,
    'actualizado_en', f.actualizado_en,
    'estado', f.estado,
    'prioridad', f.prioridad,
    'nota_admin', f.nota_admin,
    'nombre', pf.nombre,
    'nombre_usuario', pf.nombre_usuario,
    'correo', public.feedback_admin_enmascarar(u.email),
    'revisado_en', f.revisado_en
  )
  into v_feedback
  from public.feedback_usuarios as f
  left join public.perfiles as pf on pf.id = f.usuario_id
  left join auth.users as u on u.id = f.usuario_id
  where f.id = p_id;

  if v_feedback is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;

  insert into public.admin_auditoria_feedback (administrador_id, accion, feedback_id)
  values (p_admin, 'detalle', p_id);

  return pg_catalog.jsonb_build_object('ok', true, 'feedback', v_feedback);
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
    or pg_catalog.strpos(p_nota, pg_catalog.chr(0)) > 0
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

revoke all on function public.listar_feedback_admin(uuid, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.listar_feedback_admin(uuid, text, text, text, integer, integer) to service_role;

revoke all on function public.detalle_feedback_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.detalle_feedback_admin(uuid, uuid) to service_role;

revoke all on function public.gestionar_feedback_admin(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.gestionar_feedback_admin(uuid, uuid, text, text, text) to service_role;
