-- ENFLORA · Admin · Auditoría central.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase, después de
-- supabase/admin-usuarios.sql y supabase/admin-partners.sql.
-- Las funciones de Expo y de contactos que ya están en producción
-- se llaman desde acá: no se reemplazan y no se copian sus eventos.
--
-- No borra filas. No actualiza historial. No toca Mercado Pago,
-- suscripciones, Web Push ni Flora.
--
-- Lo que ya guardan admin_auditoria_usuarios y partners_auditoria
-- se lee en una vista. No se duplica en admin_auditoria_eventos.
-- Esa tabla solo recibe eventos nuevos (Expo y, más adelante,
-- Planes, Flora, Almacenamiento y Notificaciones). No hay un volcado
-- de acciones anteriores: si no estaban en esas tablas, no aparecen.
--
-- Una mutación de Expo y su fila de auditoría ocurren en la misma
-- función. Si la auditoría no se puede escribir, la función falla y
-- Postgres deshace la mutación. Un rechazo de regla deja la fila de
-- rechazo y no modifica el recurso.
-- La exportación de contactos se lee antes, en la aplicación. Si esta
-- función no confirma la fila, la aplicación no entrega el archivo.
--
-- No se guarda correo, teléfono, mensaje, nota, IP ni el texto de la
-- búsqueda. El identificador de operación lo genera la base: el
-- cliente no lo elige. Repetir el mismo identificador no inserta otra
-- fila ni cambia la que ya existe.
--
-- COALESCE queda sin esquema. Los conteos usan ::bigint.
-- search_path vacío y referencias con esquema.

create table if not exists public.admin_auditoria_eventos (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  operacion_id uuid not null,
  administrador_id uuid not null,
  modulo text not null,
  accion text not null,
  recurso_tipo text not null,
  recurso_id text not null default '',
  resultado text not null,
  motivo text not null default '',
  creada_en timestamptz not null default pg_catalog.now(),
  constraint admin_auditoria_eventos_operacion_unica unique (operacion_id),
  constraint admin_auditoria_eventos_modulo check (
    modulo in (
      'dashboard', 'usuarios', 'planes', 'flora_ia', 'almacenamiento',
      'notificaciones', 'feedback', 'partners', 'expo', 'auditoria'
    )
  ),
  constraint admin_auditoria_eventos_accion check (accion ~ '^[a-z_]{1,40}$'),
  constraint admin_auditoria_eventos_recurso_tipo check (recurso_tipo ~ '^[a-z_]{1,40}$'),
  constraint admin_auditoria_eventos_recurso_id check (
    recurso_id ~ '^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z0-9_-]{1,40}$'
  ),
  constraint admin_auditoria_eventos_resultado check (resultado in ('exito', 'rechazo', 'error')),
  constraint admin_auditoria_eventos_motivo check (motivo ~ '^[a-z0-9_]{0,40}$')
);

alter table public.admin_auditoria_eventos enable row level security;

revoke all on table public.admin_auditoria_eventos from public, anon, authenticated, service_role;

create index if not exists admin_auditoria_eventos_creada_idx
  on public.admin_auditoria_eventos (creada_en desc, id desc);

create index if not exists admin_auditoria_eventos_modulo_idx
  on public.admin_auditoria_eventos (modulo, creada_en desc);

create index if not exists admin_auditoria_eventos_admin_idx
  on public.admin_auditoria_eventos (administrador_id, creada_en desc);

create index if not exists admin_auditoria_usuarios_admin_idx
  on public.admin_auditoria_usuarios (administrador_id, registrado_en desc);

create index if not exists partners_auditoria_admin_idx
  on public.partners_auditoria (administrador_id, creada_en desc);

create or replace view public.admin_auditoria_consolidada
with (security_invoker = true) as
select
  u.id,
  u.id as operacion_id,
  u.administrador_id,
  'usuarios'::text as modulo,
  u.accion,
  case when u.accion = 'detalle' then 'usuario' else 'listado' end as recurso_tipo,
  case when u.accion = 'detalle' then u.usuario_id::text else '' end as recurso_id,
  'exito'::text as resultado,
  ''::text as motivo,
  u.registrado_en as creada_en,
  'heredada'::text as cobertura
from public.admin_auditoria_usuarios as u
union all
select
  p.id,
  p.id as operacion_id,
  p.administrador_id,
  'partners'::text as modulo,
  p.accion,
  p.entidad as recurso_tipo,
  p.entidad_id::text as recurso_id,
  'exito'::text as resultado,
  ''::text as motivo,
  p.creada_en,
  'heredada'::text as cobertura
from public.partners_auditoria as p
union all
select
  e.id,
  e.operacion_id,
  e.administrador_id,
  e.modulo,
  e.accion,
  e.recurso_tipo,
  e.recurso_id,
  e.resultado,
  e.motivo,
  e.creada_en,
  'central'::text as cobertura
from public.admin_auditoria_eventos as e;

revoke all on table public.admin_auditoria_consolidada from public, anon, authenticated, service_role;

create or replace function public.admin_auditoria_motivo_expo(p_texto text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case coalesce(p_texto, '')
    when 'No hay stock suficiente.' then 'sin_stock'
    when 'No se puede descontar esa cantidad.' then 'sin_descuento'
    when 'Inventario sin configurar.' then 'sin_configurar'
    when 'No se encontró el producto.' then 'no_encontrado'
    when 'Las cantidades no son válidas.' then 'cantidades_invalidas'
    when 'La cantidad no es válida.' then 'cantidad_invalida'
    when 'Las entregas no pueden superar el stock.' then 'supera_stock'
    when 'El stock no alcanza para las reservas pendientes.' then 'reservas_pendientes'
    when 'origen_invalido' then 'origen_invalido'
    when 'sin_contacto' then 'sin_contacto'
    else 'operacion_fallida'
  end;
$$;

create or replace function public.admin_auditoria_anotar(
  p_operacion uuid,
  p_admin uuid,
  p_modulo text,
  p_accion text,
  p_recurso_tipo text,
  p_recurso_id text,
  p_resultado text,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_recurso text := pg_catalog.lower(coalesce(p_recurso_id, ''));
  v_motivo text := coalesce(p_motivo, '');
begin
  if p_operacion is null or p_admin is null
     or p_modulo is null
     or p_modulo not in (
       'dashboard', 'usuarios', 'planes', 'flora_ia', 'almacenamiento',
       'notificaciones', 'feedback', 'partners', 'expo', 'auditoria'
     )
     or p_accion is null or p_accion !~ '^[a-z_]{1,40}$'
     or p_recurso_tipo is null or p_recurso_tipo !~ '^[a-z_]{1,40}$'
     or v_recurso !~ '^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z0-9_-]{1,40}$'
     or p_resultado not in ('exito', 'rechazo', 'error')
     or v_motivo !~ '^[a-z0-9_]{0,40}$'
  then
    raise exception 'auditoria_invalida';
  end if;

  insert into public.admin_auditoria_eventos (
    operacion_id, administrador_id, modulo, accion, recurso_tipo, recurso_id, resultado, motivo
  ) values (
    p_operacion, p_admin, p_modulo, p_accion, p_recurso_tipo, v_recurso, p_resultado, v_motivo
  )
  on conflict (operacion_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.admin_auditoria_eventos
    where operacion_id = p_operacion;
  end if;
  return v_id;
end;
$$;

revoke all on function public.admin_auditoria_motivo_expo(text) from public, anon, authenticated, service_role;
revoke all on function public.admin_auditoria_anotar(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated, service_role;

create or replace function public.entrega_expo_auditada(
  p_admin uuid,
  p_slug text,
  p_delta integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila jsonb;
  v_motivo text;
  v_resultado text;
  v_slug text := case when coalesce(p_slug, '') ~ '^[a-z0-9_-]{1,40}$' then p_slug else '' end;
begin
  if p_admin is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  if p_slug is null or p_slug not in ('stickers', 'filtros', 'folletos', 'tuqueros', 'picadores')
     or p_delta is null or p_delta not in (-1, 1, 2, 3)
  then
    perform public.admin_auditoria_anotar(
      pg_catalog.gen_random_uuid(), p_admin, 'expo', 'entrega', 'inventario', v_slug,
      'rechazo', 'cantidad_invalida'
    );
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'cantidad_invalida');
  end if;

  begin
    v_fila := public.registrar_entrega_expo(p_slug, p_delta);
  exception
    when others then
      v_motivo := public.admin_auditoria_motivo_expo(sqlerrm);
      v_resultado := case when v_motivo = 'operacion_fallida' then 'error' else 'rechazo' end;
      perform public.admin_auditoria_anotar(
        pg_catalog.gen_random_uuid(), p_admin, 'expo', 'entrega', 'inventario', p_slug, v_resultado, v_motivo
      );
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', v_motivo);
  end;

  perform public.admin_auditoria_anotar(
    pg_catalog.gen_random_uuid(), p_admin, 'expo', 'entrega', 'inventario', p_slug, 'exito', ''
  );
  return v_fila;
end;
$$;

create or replace function public.inventario_expo_auditado(
  p_admin uuid,
  p_slug text,
  p_stock integer,
  p_entregados integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila jsonb;
  v_motivo text;
  v_resultado text;
  v_slug text := case when coalesce(p_slug, '') ~ '^[a-z0-9_-]{1,40}$' then p_slug else '' end;
begin
  if p_admin is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  if p_slug is null or p_slug not in ('stickers', 'filtros', 'folletos', 'tuqueros', 'picadores')
     or p_stock is null or p_stock < 0 or p_stock > 100000
     or p_entregados is null or p_entregados < 0 or p_entregados > p_stock
  then
    perform public.admin_auditoria_anotar(
      pg_catalog.gen_random_uuid(), p_admin, 'expo', 'inventario', 'inventario', v_slug,
      'rechazo', 'cantidades_invalidas'
    );
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'cantidades_invalidas');
  end if;

  begin
    v_fila := public.guardar_inventario_expo(p_slug, p_stock, p_entregados);
  exception
    when others then
      v_motivo := public.admin_auditoria_motivo_expo(sqlerrm);
      v_resultado := case when v_motivo = 'operacion_fallida' then 'error' else 'rechazo' end;
      perform public.admin_auditoria_anotar(
        pg_catalog.gen_random_uuid(), p_admin, 'expo', 'inventario', 'inventario', p_slug, v_resultado, v_motivo
      );
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', v_motivo);
  end;

  perform public.admin_auditoria_anotar(
    pg_catalog.gen_random_uuid(), p_admin, 'expo', 'inventario', 'inventario', p_slug, 'exito', ''
  );
  return v_fila;
end;
$$;

create or replace function public.reinicio_expo_auditado(p_admin uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila jsonb;
  v_motivo text;
  v_resultado text;
begin
  if p_admin is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  begin
    v_fila := public.reiniciar_participantes_expo();
  exception
    when others then
      v_motivo := public.admin_auditoria_motivo_expo(sqlerrm);
      v_resultado := case when v_motivo = 'operacion_fallida' then 'error' else 'rechazo' end;
      perform public.admin_auditoria_anotar(
        pg_catalog.gen_random_uuid(), p_admin, 'expo', 'reinicio', 'participantes', '', v_resultado, v_motivo
      );
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', v_motivo);
  end;

  perform public.admin_auditoria_anotar(
    pg_catalog.gen_random_uuid(), p_admin, 'expo', 'reinicio', 'participantes', '', 'exito', ''
  );
  return v_fila;
end;
$$;

create or replace function public.contacto_expo_auditado(
  p_admin uuid,
  p_nombre text,
  p_email text,
  p_telefono text,
  p_origen text,
  p_detalle text,
  p_consentimiento boolean,
  p_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_nuevo boolean;
  v_motivo text;
  v_resultado text;
begin
  if p_admin is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  begin
    select r.id_contacto, r.es_nuevo into v_id, v_nuevo
    from public.registrar_contacto_enflora(
      p_nombre, p_email, p_telefono, p_origen, p_detalle, p_consentimiento, p_version
    ) as r;
  exception
    when others then
      v_motivo := public.admin_auditoria_motivo_expo(sqlerrm);
      v_resultado := case when v_motivo = 'operacion_fallida' then 'error' else 'rechazo' end;
      perform public.admin_auditoria_anotar(
        pg_catalog.gen_random_uuid(), p_admin, 'expo', 'alta_contacto', 'contacto', '', v_resultado, v_motivo
      );
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', v_motivo);
  end;

  if v_id is null then
    raise exception 'auditoria_invalida';
  end if;

  perform public.admin_auditoria_anotar(
    pg_catalog.gen_random_uuid(), p_admin, 'expo', 'alta_contacto', 'contacto', v_id::text,
    'exito', case when v_nuevo then 'nuevo' else 'existente' end
  );
  return pg_catalog.jsonb_build_object('id_contacto', v_id, 'es_nuevo', coalesce(v_nuevo, false));
end;
$$;

create or replace function public.edicion_contacto_expo_auditada(
  p_admin uuid,
  p_id uuid,
  p_nombre text,
  p_email text,
  p_telefono text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, ''))), '');
  v_telefono text := nullif(pg_catalog.btrim(coalesce(p_telefono, '')), '');
  v_nombre text := nullif(pg_catalog.btrim(coalesce(p_nombre, '')), '');
  v_fila public.contactos_enflora%rowtype;
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  if (v_email is null and v_telefono is null)
     or (v_nombre is not null and pg_catalog.char_length(v_nombre) > 80)
     or (v_email is not null and (pg_catalog.char_length(v_email) > 200 or pg_catalog.strpos(v_email, '@') < 2))
     or (v_telefono is not null and v_telefono !~ '^\+[1-9][0-9]{7,14}$')
  then
    perform public.admin_auditoria_anotar(
      pg_catalog.gen_random_uuid(), p_admin, 'expo', 'edicion_contacto', 'contacto', p_id::text,
      'rechazo', 'consulta_invalida'
    );
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  begin
    update public.contactos_enflora
    set nombre = v_nombre, email = v_email, telefono = v_telefono
    where id = p_id
    returning * into v_fila;
  exception
    when unique_violation then
      perform public.admin_auditoria_anotar(
        pg_catalog.gen_random_uuid(), p_admin, 'expo', 'edicion_contacto', 'contacto', p_id::text,
        'rechazo', 'duplicado'
      );
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'duplicado');
    when check_violation then
      perform public.admin_auditoria_anotar(
        pg_catalog.gen_random_uuid(), p_admin, 'expo', 'edicion_contacto', 'contacto', p_id::text,
        'rechazo', 'consulta_invalida'
      );
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end;

  if not found then
    perform public.admin_auditoria_anotar(
      pg_catalog.gen_random_uuid(), p_admin, 'expo', 'edicion_contacto', 'contacto', p_id::text,
      'rechazo', 'no_encontrado'
    );
    return pg_catalog.jsonb_build_object('ok', true, 'contacto', null);
  end if;

  perform public.admin_auditoria_anotar(
    pg_catalog.gen_random_uuid(), p_admin, 'expo', 'edicion_contacto', 'contacto', p_id::text, 'exito', ''
  );
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'contacto', pg_catalog.jsonb_build_object(
      'id', v_fila.id,
      'nombre', v_fila.nombre,
      'email', v_fila.email,
      'telefono', v_fila.telefono,
      'origen_inicial', v_fila.origen_inicial,
      'origenes', v_fila.origenes,
      'consentimiento_marketing', v_fila.consentimiento_marketing,
      'consentimiento_fecha', v_fila.consentimiento_fecha,
      'consentimiento_version', v_fila.consentimiento_version,
      'created_at', v_fila.created_at,
      'updated_at', v_fila.updated_at
    )
  );
end;
$$;

create or replace function public.consentimiento_expo_auditado(
  p_admin uuid,
  p_contacto uuid,
  p_acepta boolean,
  p_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
  v_motivo text;
  v_resultado text;
begin
  if p_admin is null or p_contacto is null or p_acepta is null
     or p_version is null or p_version !~ '^[0-9A-Za-z._-]{1,40}$'
  then
    if p_admin is not null then
      perform public.admin_auditoria_anotar(
        pg_catalog.gen_random_uuid(), p_admin, 'expo', 'consentimiento', 'contacto', coalesce(p_contacto::text, ''),
        'rechazo', 'consulta_invalida'
      );
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  begin
    v_ok := public.actualizar_consentimiento_contacto(p_contacto, p_acepta, p_version);
  exception
    when others then
      v_motivo := public.admin_auditoria_motivo_expo(sqlerrm);
      v_resultado := case when v_motivo = 'operacion_fallida' then 'error' else 'rechazo' end;
      perform public.admin_auditoria_anotar(
        pg_catalog.gen_random_uuid(), p_admin, 'expo', 'consentimiento', 'contacto', p_contacto::text, v_resultado, v_motivo
      );
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', v_motivo);
  end;

  if v_ok is not true then
    perform public.admin_auditoria_anotar(
      pg_catalog.gen_random_uuid(), p_admin, 'expo', 'consentimiento', 'contacto', p_contacto::text, 'rechazo', 'no_encontrado'
    );
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;

  perform public.admin_auditoria_anotar(
    pg_catalog.gen_random_uuid(), p_admin, 'expo', 'consentimiento', 'contacto', p_contacto::text,
    'exito', case when p_acepta then 'otorga' else 'retira' end
  );
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.eliminacion_contacto_expo_auditada(p_admin uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  begin
    delete from public.contactos_enflora where id = p_id returning id into v_id;
  exception
    when others then
      perform public.admin_auditoria_anotar(
        pg_catalog.gen_random_uuid(), p_admin, 'expo', 'eliminacion_contacto', 'contacto', p_id::text,
        'error', 'operacion_fallida'
      );
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'operacion_fallida');
  end;

  if v_id is null then
    perform public.admin_auditoria_anotar(
      pg_catalog.gen_random_uuid(), p_admin, 'expo', 'eliminacion_contacto', 'contacto', p_id::text,
      'rechazo', 'no_encontrado'
    );
    return pg_catalog.jsonb_build_object('ok', true, 'eliminado', false);
  end if;

  perform public.admin_auditoria_anotar(
    pg_catalog.gen_random_uuid(), p_admin, 'expo', 'eliminacion_contacto', 'contacto', p_id::text, 'exito', ''
  );
  return pg_catalog.jsonb_build_object('ok', true, 'eliminado', true);
end;
$$;

create or replace function public.exportacion_expo_auditada(
  p_admin uuid,
  p_filtro text,
  p_con_busqueda text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_filtro text;
  v_motivo text;
begin
  if p_admin is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_filtro := case p_filtro
    when 'landing' then 'landing'
    when 'ruleta_420' then 'ruleta_420'
    when 'manual' then 'manual'
    when 'registro' then 'registro'
    when 'con-consentimiento' then 'con_consentimiento'
    when 'sin-consentimiento' then 'sin_consentimiento'
    when 'todos' then 'todos'
    else null
  end;
  if v_filtro is null or p_con_busqueda not in ('si', 'no') then
    perform public.admin_auditoria_anotar(
      pg_catalog.gen_random_uuid(), p_admin, 'expo', 'exportacion', 'exportacion', '', 'rechazo', 'consulta_invalida'
    );
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  v_motivo := case when p_con_busqueda = 'si' then v_filtro || '_busqueda' else v_filtro end;
  perform public.admin_auditoria_anotar(
    pg_catalog.gen_random_uuid(), p_admin, 'expo', 'exportacion', 'exportacion', '', 'exito', v_motivo
  );
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.entrega_expo_auditada(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.inventario_expo_auditado(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.reinicio_expo_auditado(uuid) from public, anon, authenticated;
revoke all on function public.contacto_expo_auditado(uuid, text, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.edicion_contacto_expo_auditada(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.consentimiento_expo_auditado(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.eliminacion_contacto_expo_auditada(uuid, uuid) from public, anon, authenticated;
revoke all on function public.exportacion_expo_auditada(uuid, text, text) from public, anon, authenticated;

grant execute on function public.entrega_expo_auditada(uuid, text, integer) to service_role;
grant execute on function public.inventario_expo_auditado(uuid, text, integer, integer) to service_role;
grant execute on function public.reinicio_expo_auditado(uuid) to service_role;
grant execute on function public.contacto_expo_auditado(uuid, text, text, text, text, text, boolean, text) to service_role;
grant execute on function public.edicion_contacto_expo_auditada(uuid, uuid, text, text, text) to service_role;
grant execute on function public.consentimiento_expo_auditado(uuid, uuid, boolean, text) to service_role;
grant execute on function public.eliminacion_contacto_expo_auditada(uuid, uuid) to service_role;
grant execute on function public.exportacion_expo_auditada(uuid, text, text) to service_role;

create or replace function public.admin_auditoria_filtrar(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_modulo text,
  p_accion text,
  p_resultado text,
  p_administrador text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  if p_desde is null or p_hasta is null or p_hasta <= p_desde or p_hasta > p_desde + interval '366 days' then
    return false;
  end if;
  if p_modulo is null or p_modulo !~ '^$|^(dashboard|usuarios|planes|flora_ia|almacenamiento|notificaciones|feedback|partners|expo|auditoria)$' then
    return false;
  end if;
  if p_accion is null or p_accion !~ '^[a-z_]{0,40}$' then
    return false;
  end if;
  if p_resultado is null or p_resultado !~ '^$|^(exito|rechazo|error)$' then
    return false;
  end if;
  if p_administrador is null or p_administrador !~ '^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if p_administrador <> '' then
    v_admin := p_administrador::uuid;
    if v_admin is null then
      return false;
    end if;
  end if;
  return true;
end;
$$;

revoke all on function public.admin_auditoria_filtrar(timestamptz, timestamptz, text, text, text, text) from public, anon, authenticated, service_role;

create or replace function public.resumen_auditoria_admin(
  p_admin uuid,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_modulo text,
  p_accion text,
  p_resultado text,
  p_administrador text,
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
  v_admin uuid := null;
begin
  if p_admin is null
     or p_limite is distinct from 20
     or p_offset is null
     or p_offset < 0
     or p_offset > 100000
     or p_offset % 20 <> 0
     or not public.admin_auditoria_filtrar(p_desde, p_hasta, p_modulo, p_accion, p_resultado, p_administrador)
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  if p_administrador <> '' then
    v_admin := p_administrador::uuid;
  end if;

  return (
    with base as (
      select *
      from public.admin_auditoria_consolidada
      where creada_en >= p_desde
        and creada_en < p_hasta
        and (p_modulo = '' or modulo = p_modulo)
        and (p_accion = '' or accion = p_accion)
        and (p_resultado = '' or resultado = p_resultado)
        and (v_admin is null or administrador_id = v_admin)
    ),
    pagina as (
      select *
      from base
      order by creada_en desc, id desc
      limit p_limite
      offset p_offset
    )
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'desde', p_desde,
      'hasta', p_hasta,
      'medido_en', pg_catalog.now(),
      'total_registrado', (select pg_catalog.count(*)::bigint from public.admin_auditoria_consolidada),
      'total', (select pg_catalog.count(*)::bigint from base),
      'exitos', (select pg_catalog.count(*)::bigint from base where resultado = 'exito'),
      'rechazos', (select pg_catalog.count(*)::bigint from base where resultado = 'rechazo'),
      'errores', (select pg_catalog.count(*)::bigint from base where resultado = 'error'),
      'heredados', (select pg_catalog.count(*)::bigint from base where cobertura = 'heredada'),
      'centrales', (select pg_catalog.count(*)::bigint from base where cobertura = 'central'),
      'limite', p_limite,
      'offset', p_offset,
      'por_modulo', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('modulo', modulo, 'total', total) order by modulo)
        from (
          select modulo, pg_catalog.count(*)::bigint as total
          from base
          group by modulo
        ) as mods
      ), '[]'::jsonb),
      'por_accion', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('accion', accion, 'total', total) order by accion)
        from (
          select accion, pg_catalog.count(*)::bigint as total
          from base
          group by accion
        ) as acciones
      ), '[]'::jsonb),
      'administradores', coalesce((
        select pg_catalog.jsonb_agg(administrador_id order by administrador_id)
        from (
          select distinct administrador_id
          from base
          order by administrador_id
          limit 50
        ) as admins
      ), '[]'::jsonb),
      'filas', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', id,
          'operacion_id', operacion_id,
          'administrador_id', administrador_id,
          'modulo', modulo,
          'accion', accion,
          'recurso_tipo', recurso_tipo,
          'recurso_id', recurso_id,
          'resultado', resultado,
          'motivo', motivo,
          'creada_en', creada_en,
          'cobertura', cobertura
        ) order by creada_en desc, id desc)
        from pagina
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.detalle_auditoria_admin(p_admin uuid, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fila public.admin_auditoria_consolidada%rowtype;
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  select * into v_fila
  from public.admin_auditoria_consolidada
  where id = p_id;

  if v_fila.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'evento', pg_catalog.jsonb_build_object(
      'id', v_fila.id,
      'operacion_id', v_fila.operacion_id,
      'administrador_id', v_fila.administrador_id,
      'modulo', v_fila.modulo,
      'accion', v_fila.accion,
      'recurso_tipo', v_fila.recurso_tipo,
      'recurso_id', v_fila.recurso_id,
      'resultado', v_fila.resultado,
      'motivo', v_fila.motivo,
      'creada_en', v_fila.creada_en,
      'cobertura', v_fila.cobertura
    )
  );
end;
$$;

revoke all on function public.resumen_auditoria_admin(uuid, timestamptz, timestamptz, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.detalle_auditoria_admin(uuid, uuid) from public, anon, authenticated;

grant execute on function public.resumen_auditoria_admin(uuid, timestamptz, timestamptz, text, text, text, text, integer, integer) to service_role;
grant execute on function public.detalle_auditoria_admin(uuid, uuid) to service_role;
