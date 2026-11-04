-- ENFLORA · Admin · Gestión de usuarios.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase, después de que existan
-- perfiles, espacios, unidades, plantas, registros, ciclos, pagos, licencias y Plus.
-- No modifica Mercado Pago, suscripciones, webhooks, licencias ni crons.
--
-- Es idempotente: CREATE OR REPLACE y CREATE TABLE IF NOT EXISTS.
-- No borra objetos ni datos de cultivo.
--
-- COALESCE, NULLIF, GREATEST y LEAST quedan sin esquema: no existen como
-- pg_catalog.coalesce ni equivalentes. El entero de 8 bytes se escribe ::bigint.
--
-- Lo que sale hacia el panel:
--   nombre, nombre de usuario, correo enmascarado, alta, última conexión,
--   confirmación, plan comercial de producción y conteos.
-- Lo que no se lee: apellido, teléfono, observaciones, genéticas, fotos ni mensajes.
-- La búsqueda no se guarda en la auditoría.
--
-- Última conexión es auth.users.last_sign_in_at.
-- Última actividad es el máximo de registros.fecha_creacion.
-- Si last_sign_in_at o email_confirmed_at no existen, la consulta falla al ejecutarse.
--
-- Plan comercial, solo ambiente produccion, con la misma cobertura que Planes:
--   Plus: suscripción con período vigente y pago acreditado cuyo período sigue vigente.
--   Licencia: licencia activa, pago acreditado, misma identidad y ciclo activo.
--   Una cuenta puede tener los dos. Prueba no cuenta como plan de producción.

create table if not exists public.admin_auditoria_usuarios (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  administrador_id uuid not null,
  accion text not null,
  usuario_id uuid,
  registrado_en timestamptz not null default pg_catalog.now(),
  constraint admin_auditoria_usuarios_accion check (accion in ('listado', 'detalle')),
  constraint admin_auditoria_usuarios_objetivo check (
    (accion = 'listado' and usuario_id is null)
    or (accion = 'detalle' and usuario_id is not null)
  )
);

alter table public.admin_auditoria_usuarios enable row level security;

revoke all on table public.admin_auditoria_usuarios from public, anon, authenticated, service_role;

create index if not exists admin_auditoria_usuarios_registrado_en_idx
  on public.admin_auditoria_usuarios (registrado_en desc);

create or replace function public.usuarios_admin_plegar(p_texto text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.translate(
    pg_catalog.lower(coalesce(p_texto, '')),
    'áéíóúüñàèìòùâêîôûäëïöÿ',
    'aeiouunaeiouaeiouaeioy'
  );
$$;

create or replace function public.usuarios_admin_enmascarar(p_correo text)
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

create or replace function public.usuarios_admin_plan(p_usuario uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_usuario is null then 'gratuito'
    when exists (
      select 1
      from public.plus_suscripciones as s
      where s.usuario_id = p_usuario
        and s.ambiente = 'produccion'
        and s.periodo_vigente_hasta >= pg_catalog.now()
        and (
          s.estado_interno = 'activa'
          or (s.estado_interno = 'cancelada' and s.vigente_hasta_fin_periodo)
        )
        and exists (
          select 1
          from public.plus_pagos_recurrentes as r
          where r.suscripcion_id = s.id
            and r.usuario_id = s.usuario_id
            and r.ambiente = s.ambiente
            and r.estado_interno = 'acreditado'
            and r.periodo_hasta >= pg_catalog.now()
        )
    ) and exists (
      select 1
      from public.licencias_cultivo as l
      join public.pagos as p on p.id = l.pago_id
      join public.ciclos_cultivo as c on c.id = l.ciclo_cultivo_id
      where l.usuario_id = p_usuario
        and p.ambiente = 'produccion'
        and l.estado = 'activa'
        and p.estado = 'acreditado'
        and p.usuario_id = l.usuario_id
        and p.ciclo_cultivo_id = l.ciclo_cultivo_id
        and c.estado = 'activo'
        and c.usuario_id = l.usuario_id
    ) then 'plus_y_licencia'
    when exists (
      select 1
      from public.plus_suscripciones as s
      where s.usuario_id = p_usuario
        and s.ambiente = 'produccion'
        and s.periodo_vigente_hasta >= pg_catalog.now()
        and (
          s.estado_interno = 'activa'
          or (s.estado_interno = 'cancelada' and s.vigente_hasta_fin_periodo)
        )
        and exists (
          select 1
          from public.plus_pagos_recurrentes as r
          where r.suscripcion_id = s.id
            and r.usuario_id = s.usuario_id
            and r.ambiente = s.ambiente
            and r.estado_interno = 'acreditado'
            and r.periodo_hasta >= pg_catalog.now()
        )
    ) then 'plus'
    when exists (
      select 1
      from public.licencias_cultivo as l
      join public.pagos as p on p.id = l.pago_id
      join public.ciclos_cultivo as c on c.id = l.ciclo_cultivo_id
      where l.usuario_id = p_usuario
        and p.ambiente = 'produccion'
        and l.estado = 'activa'
        and p.estado = 'acreditado'
        and p.usuario_id = l.usuario_id
        and p.ciclo_cultivo_id = l.ciclo_cultivo_id
        and c.estado = 'activo'
        and c.usuario_id = l.usuario_id
    ) then 'licencia'
    else 'gratuito'
  end;
$$;

create or replace function public.listar_usuarios_admin(
  p_admin uuid,
  p_busqueda text,
  p_confirmacion text,
  p_plan text,
  p_desde timestamptz,
  p_hasta timestamptz,
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
  v_busqueda text;
begin
  if p_admin is null
    or p_busqueda is null
    or pg_catalog.char_length(p_busqueda) > 80
    or p_busqueda ~ '[[:cntrl:]]'
    or pg_catalog.strpos(p_busqueda, pg_catalog.chr(37)) > 0
    or pg_catalog.strpos(p_busqueda, pg_catalog.chr(92)) > 0
    or pg_catalog.strpos(p_busqueda, pg_catalog.chr(39)) > 0
    or pg_catalog.strpos(p_busqueda, pg_catalog.chr(34)) > 0
    or pg_catalog.strpos(p_busqueda, pg_catalog.chr(59)) > 0
    or p_confirmacion is null
    or p_confirmacion not in ('todos', 'confirmado', 'sin_confirmar')
    or p_plan is null
    or p_plan not in ('todos', 'gratuito', 'plus', 'licencia')
    or p_desde is null
    or p_hasta is null
    or p_hasta <= p_desde
    or p_hasta > p_desde + interval '8000 days'
    or p_limite is distinct from 25
    or p_offset is null
    or p_offset < 0
    or p_offset > 100000
    or p_offset % 25 <> 0
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  v_busqueda := pg_catalog.btrim(p_busqueda);

  insert into public.admin_auditoria_usuarios (administrador_id, accion, usuario_id)
  values (p_admin, 'listado', null);

  return (
    with base as (
      select
        u.id,
        u.created_at,
        u.last_sign_in_at,
        u.email,
        (u.email_confirmed_at is not null) as confirmado,
        pf.nombre,
        pf.nombre_usuario
      from auth.users as u
      left join public.perfiles as pf on pf.id = u.id
      where u.deleted_at is null
        and coalesce(u.is_anonymous, false) = false
        and u.created_at >= p_desde
        and u.created_at < p_hasta
        and (
          p_confirmacion = 'todos'
          or (p_confirmacion = 'confirmado' and u.email_confirmed_at is not null)
          or (p_confirmacion = 'sin_confirmar' and u.email_confirmed_at is null)
        )
        and (
          v_busqueda = ''
          or pg_catalog.strpos(public.usuarios_admin_plegar(pf.nombre), public.usuarios_admin_plegar(v_busqueda)) > 0
          or pg_catalog.strpos(public.usuarios_admin_plegar(pf.nombre_usuario), public.usuarios_admin_plegar(v_busqueda)) > 0
          or pg_catalog.strpos(public.usuarios_admin_plegar(u.email), public.usuarios_admin_plegar(v_busqueda)) > 0
        )
    ),
    filtrados as (
      select base.*
      from base
      where case
        when p_plan = 'todos' then true
        when p_plan = 'gratuito' then public.usuarios_admin_plan(base.id) = 'gratuito'
        when p_plan = 'plus' then public.usuarios_admin_plan(base.id) in ('plus', 'plus_y_licencia')
        when p_plan = 'licencia' then public.usuarios_admin_plan(base.id) in ('licencia', 'plus_y_licencia')
        else false
      end
    ),
    pagina as materialized (
      select *
      from filtrados
      order by created_at desc nulls last, id desc
      limit p_limite
      offset p_offset
    ),
    espacios_n as (
      select e.usuario_id, pg_catalog.count(*)::bigint as cantidad
      from public.espacios as e
      join pagina as pg on pg.id = e.usuario_id
      group by e.usuario_id
    ),
    unidades_n as (
      select e.usuario_id, pg_catalog.count(*)::bigint as cantidad
      from public.unidades_cultivo as un
      join public.espacios as e on e.id = un.espacio_id
      join pagina as pg on pg.id = e.usuario_id
      group by e.usuario_id
    ),
    plantas_n as (
      select e.usuario_id, pg_catalog.count(*)::bigint as cantidad
      from public.plantas as pl
      join public.unidades_cultivo as un on un.id = pl.unidad_cultivo_id
      join public.espacios as e on e.id = un.espacio_id
      join pagina as pg on pg.id = e.usuario_id
      group by e.usuario_id
    ),
    registros_n as (
      select r.usuario_id, pg_catalog.count(*)::bigint as cantidad, pg_catalog.max(r.fecha_creacion) as ultima
      from public.registros as r
      join pagina as pg on pg.id = r.usuario_id
      group by r.usuario_id
    )
    select pg_catalog.jsonb_build_object(
      'ok', true,
      'total', (select pg_catalog.count(*)::bigint from filtrados),
      'limite', p_limite,
      'offset', p_offset,
      'filas', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', pg.id,
          'nombre', pg.nombre,
          'nombre_usuario', pg.nombre_usuario,
          'correo', public.usuarios_admin_enmascarar(pg.email),
          'alta', pg.created_at,
          'ultima_conexion', pg.last_sign_in_at,
          'confirmado', pg.confirmado,
          'plan', public.usuarios_admin_plan(pg.id),
          'espacios', coalesce(es.cantidad, 0),
          'unidades', coalesce(un.cantidad, 0),
          'plantas', coalesce(pl.cantidad, 0),
          'registros', coalesce(rg.cantidad, 0),
          'ultima_actividad', rg.ultima
        ) order by pg.created_at desc nulls last, pg.id desc)
        from pagina as pg
        left join espacios_n as es on es.usuario_id = pg.id
        left join unidades_n as un on un.usuario_id = pg.id
        left join plantas_n as pl on pl.usuario_id = pg.id
        left join registros_n as rg on rg.usuario_id = pg.id
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.detalle_usuario_admin(p_admin uuid, p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_respuesta jsonb;
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  insert into public.admin_auditoria_usuarios (administrador_id, accion, usuario_id)
  values (p_admin, 'detalle', p_id);

  if not exists (
    select 1
    from auth.users as u
    where u.id = p_id
      and u.deleted_at is null
      and coalesce(u.is_anonymous, false) = false
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrada');
  end if;

  select pg_catalog.jsonb_build_object(
    'ok', true,
    'usuario', pg_catalog.jsonb_build_object(
      'id', u.id,
      'nombre', pf.nombre,
      'nombre_usuario', pf.nombre_usuario,
      'correo', public.usuarios_admin_enmascarar(u.email),
      'alta', u.created_at,
      'ultima_conexion', u.last_sign_in_at,
      'confirmado', u.email_confirmed_at is not null,
      'plan', public.usuarios_admin_plan(u.id),
      'espacios', coalesce(es.cantidad, 0),
      'unidades', coalesce(un.cantidad, 0),
      'plantas', coalesce(pl.cantidad, 0),
      'plantas_activas', coalesce(pl.activas, 0),
      'plantas_finalizadas', coalesce(pl.finalizadas, 0),
      'registros', coalesce(rg.cantidad, 0),
      'registros_30', coalesce(rg.recientes, 0),
      'ultima_actividad', rg.ultima
    )
  )
  into v_respuesta
  from auth.users as u
  left join public.perfiles as pf on pf.id = u.id
  left join (
    select e.usuario_id, pg_catalog.count(*)::bigint as cantidad
    from public.espacios as e
    where e.usuario_id = p_id
    group by e.usuario_id
  ) as es on es.usuario_id = u.id
  left join (
    select e.usuario_id, pg_catalog.count(*)::bigint as cantidad
    from public.unidades_cultivo as un
    join public.espacios as e on e.id = un.espacio_id
    where e.usuario_id = p_id
    group by e.usuario_id
  ) as un on un.usuario_id = u.id
  left join (
    select e.usuario_id,
      coalesce(pg_catalog.count(*), 0)::bigint as cantidad,
      coalesce(pg_catalog.count(*) filter (where pl.estado = 'activa'), 0)::bigint as activas,
      coalesce(pg_catalog.count(*) filter (where pl.estado = 'finalizada'), 0)::bigint as finalizadas
    from public.plantas as pl
    join public.unidades_cultivo as un on un.id = pl.unidad_cultivo_id
    join public.espacios as e on e.id = un.espacio_id
    where e.usuario_id = p_id
    group by e.usuario_id
  ) as pl on pl.usuario_id = u.id
  left join (
    select r.usuario_id,
      coalesce(pg_catalog.count(*), 0)::bigint as cantidad,
      coalesce(pg_catalog.count(*) filter (where r.fecha_creacion >= pg_catalog.now() - interval '30 days'), 0)::bigint as recientes,
      pg_catalog.max(r.fecha_creacion) as ultima
    from public.registros as r
    where r.usuario_id = p_id
    group by r.usuario_id
  ) as rg on rg.usuario_id = u.id
  where u.id = p_id
    and u.deleted_at is null
    and coalesce(u.is_anonymous, false) = false;

  if v_respuesta is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrada');
  end if;
  return v_respuesta;
end;
$$;

revoke all on function public.usuarios_admin_plegar(text) from public, anon, authenticated, service_role;
revoke all on function public.usuarios_admin_enmascarar(text) from public, anon, authenticated, service_role;
revoke all on function public.usuarios_admin_plan(uuid) from public, anon, authenticated, service_role;

revoke all on function public.listar_usuarios_admin(uuid, text, text, text, timestamptz, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.listar_usuarios_admin(uuid, text, text, text, timestamptz, timestamptz, integer, integer) to service_role;

revoke all on function public.detalle_usuario_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.detalle_usuario_admin(uuid, uuid) to service_role;
