-- ENFLORA — administración de partners y publicidad.
--
-- Reutiliza public.comercios_asociados. No borra filas comerciales.
-- La lectura pública de comercios aprobados, activos y vigentes queda igual.
-- Las campañas nuevas nacen en borrador. Solo un cambio explícito de estado
-- puede dejarlas activas, y el banner existente las suma recién entonces.
-- No hay publicidad en Flora. No se guarda la IP: el cupo llega como un hash.
-- Una impresión o un clic cuentan una vez por campaña, tipo y token.

alter table public.comercios_asociados
  add column if not exists estado_revision text not null default 'pendiente';

update public.comercios_asociados
set estado_revision = 'aprobado'
where aprobado = true
  and estado_revision = 'pendiente';

do $$
begin
  alter table public.comercios_asociados
    add constraint comercios_asociados_revision_valida
    check (estado_revision in ('pendiente', 'aprobado', 'rechazado'));
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.partners_solicitudes (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  comercio text not null,
  representante text not null,
  correo text not null,
  sitio text not null default '',
  rubro text not null default '',
  plan text not null,
  mensaje text not null default '',
  estado text not null default 'recibida',
  nota_interna text not null default '',
  clave_idempotencia text not null unique,
  recibida_en timestamptz not null default pg_catalog.now(),
  actualizada_en timestamptz not null default pg_catalog.now(),
  constraint partners_solicitudes_plan_valido check (plan in ('presencia', 'visibilidad', 'inteligente', 'indefinido')),
  constraint partners_solicitudes_estado_valido check (estado in ('recibida', 'en_revision', 'aprobada', 'rechazada', 'cerrada')),
  constraint partners_solicitudes_comercio_largo check (pg_catalog.char_length(comercio) between 2 and 120),
  constraint partners_solicitudes_mensaje_largo check (pg_catalog.char_length(mensaje) <= 3000)
);

create index if not exists partners_solicitudes_estado_idx
  on public.partners_solicitudes (estado, recibida_en desc);

create table if not exists public.partners_campanas (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  comercio_id uuid not null references public.comercios_asociados (id) on delete restrict,
  nombre text not null,
  pieza_url text,
  ubicacion text not null,
  enlace text,
  inicio date not null,
  fin date,
  estado text not null default 'borrador',
  prioridad integer not null default 0,
  creada_en timestamptz not null default pg_catalog.now(),
  actualizada_en timestamptz not null default pg_catalog.now(),
  constraint partners_campanas_estado_valido check (estado in ('borrador', 'programada', 'activa', 'pausada', 'finalizada')),
  constraint partners_campanas_ubicacion_valida check (ubicacion = 'listado_cultivos'),
  constraint partners_campanas_prioridad_valida check (prioridad between 0 and 100),
  constraint partners_campanas_fechas check (fin is null or fin >= inicio),
  constraint partners_campanas_nombre_largo check (pg_catalog.char_length(btrim(nombre)) between 2 and 120)
);

create index if not exists partners_campanas_publicas_idx
  on public.partners_campanas (estado, ubicacion, inicio, fin);

create table if not exists public.partners_eventos (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  campana_id uuid not null references public.partners_campanas (id) on delete restrict,
  tipo text not null,
  token text not null,
  creada_en timestamptz not null default pg_catalog.now(),
  constraint partners_eventos_tipo_valido check (tipo in ('impresion', 'clic')),
  constraint partners_eventos_token_valido check (token ~ '^[a-f0-9]{32}$'),
  constraint partners_eventos_unicos unique (campana_id, tipo, token)
);

create index if not exists partners_eventos_dia_idx
  on public.partners_eventos (creada_en);

create table if not exists public.partners_cupo (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  clave text not null,
  origen text not null,
  creada_en timestamptz not null default pg_catalog.now(),
  constraint partners_cupo_origen_valido check (origen in ('solicitud', 'evento')),
  constraint partners_cupo_clave_valida check (clave ~ '^[a-f0-9]{64}$')
);

create index if not exists partners_cupo_clave_idx
  on public.partners_cupo (origen, clave, creada_en);

create table if not exists public.partners_auditoria (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  administrador_id uuid not null,
  accion text not null,
  entidad text not null,
  entidad_id uuid not null,
  antes text not null default '',
  despues text not null default '',
  creada_en timestamptz not null default pg_catalog.now(),
  constraint partners_auditoria_accion_valida check (
    accion in (
      'alta_comercio', 'edicion_comercio', 'estado_comercio',
      'alta_campana', 'edicion_campana', 'estado_campana',
      'estado_solicitud'
    )
  ),
  constraint partners_auditoria_entidad_valida check (entidad in ('comercio', 'campana', 'solicitud'))
);

create index if not exists partners_auditoria_entidad_idx
  on public.partners_auditoria (entidad, entidad_id, creada_en desc);

alter table public.partners_solicitudes enable row level security;
alter table public.partners_campanas enable row level security;
alter table public.partners_eventos enable row level security;
alter table public.partners_cupo enable row level security;
alter table public.partners_auditoria enable row level security;

drop policy if exists partners_campanas_lectura_publica on public.partners_campanas;
create policy partners_campanas_lectura_publica
on public.partners_campanas
for select
to anon, authenticated
using (
  estado = 'activa'
  and ubicacion = 'listado_cultivos'
  and inicio <= current_date
  and (fin is null or fin >= current_date)
  and exists (
    select 1
    from public.comercios_asociados c
    where c.id = comercio_id
      and c.aprobado = true
      and c.activo = true
      and c.estado_revision = 'aprobado'
      and c.plan in ('visibilidad', 'inteligente')
      and c.fecha_inicio <= current_date
      and (c.fecha_fin is null or c.fecha_fin >= current_date)
  )
);

revoke all on table public.partners_solicitudes from public, anon, authenticated;
revoke all on table public.partners_campanas from public, anon, authenticated;
revoke all on table public.partners_eventos from public, anon, authenticated;
revoke all on table public.partners_cupo from public, anon, authenticated;
revoke all on table public.partners_auditoria from public, anon, authenticated;

grant select (
  id, comercio_id, pieza_url, ubicacion, enlace, inicio, fin, estado, prioridad
) on public.partners_campanas to anon, authenticated;

create or replace function public.partners_admin_url(p_url text, p_obligatoria boolean)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  limpio text;
begin
  limpio := pg_catalog.btrim(coalesce(p_url, ''));
  if limpio = '' then
    if p_obligatoria then return null; end if;
    return '';
  end if;
  if pg_catalog.char_length(limpio) > 500 then return null; end if;
  if pg_catalog.left(pg_catalog.lower(limpio), 8) <> 'https://' then return null; end if;
  if pg_catalog.strpos(limpio, '@') > 0
     or pg_catalog.strpos(limpio, ' ') > 0
     or pg_catalog.strpos(limpio, '\') > 0
     or pg_catalog.strpos(pg_catalog.substring(limpio, 9), '.') = 0
  then
    return null;
  end if;
  return limpio;
end;
$$;

create or replace function public.partners_admin_url_publica(p_url text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  limpio text;
  protocolo text;
begin
  limpio := pg_catalog.btrim(coalesce(p_url, ''));
  if limpio = '' then return ''; end if;
  protocolo := pg_catalog.left(pg_catalog.lower(limpio), 8);
  if protocolo <> 'https://' and pg_catalog.left(pg_catalog.lower(limpio), 7) <> 'http://' then
    return '';
  end if;
  if pg_catalog.strpos(limpio, '@') > 0 or pg_catalog.strpos(limpio, ' ') > 0 or pg_catalog.strpos(limpio, '\') > 0 then
    return '';
  end if;
  return limpio;
end;
$$;

create or replace function public.partners_admin_auditar(
  p_admin uuid,
  p_accion text,
  p_entidad text,
  p_entidad_id uuid,
  p_antes text,
  p_despues text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.partners_auditoria (administrador_id, accion, entidad, entidad_id, antes, despues)
  values (
    p_admin,
    p_accion,
    p_entidad,
    p_entidad_id,
    pg_catalog.left(coalesce(p_antes, ''), 40),
    pg_catalog.left(coalesce(p_despues, ''), 40)
  );
$$;

create or replace function public.registrar_solicitud_partners(
  p_comercio text,
  p_representante text,
  p_correo text,
  p_sitio text,
  p_rubro text,
  p_plan text,
  p_mensaje text,
  p_cupo text,
  p_idempotencia text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reciente bigint;
  global_hora bigint;
begin
  if p_cupo is null or p_cupo !~ '^[a-f0-9]{64}$'
     or p_idempotencia is null or p_idempotencia !~ '^[a-f0-9]{64}$'
     or p_plan is null or p_plan not in ('presencia', 'visibilidad', 'inteligente', 'indefinido')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_comercio, ''))) not between 2 and 120
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_representante, ''))) not between 2 and 100
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_correo, ''))) not between 6 and 254
     or pg_catalog.strpos(p_correo, '@') = 0
     or pg_catalog.char_length(coalesce(p_mensaje, '')) > 3000
     or pg_catalog.char_length(coalesce(p_sitio, '')) > 200
     or pg_catalog.char_length(coalesce(p_rubro, '')) > 80
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  if exists (
    select 1 from public.partners_solicitudes s where s.clave_idempotencia = p_idempotencia
  ) then
    return pg_catalog.jsonb_build_object('ok', true, 'repetida', true);
  end if;

  select pg_catalog.count(*)::bigint into reciente
  from public.partners_cupo c
  where c.origen = 'solicitud'
    and c.clave = p_cupo
    and c.creada_en > pg_catalog.now() - interval '15 minutes';

  select pg_catalog.count(*)::bigint into global_hora
  from public.partners_solicitudes s
  where s.recibida_en > pg_catalog.now() - interval '1 hour';

  if reciente >= 5 or global_hora >= 60 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'limite');
  end if;

  insert into public.partners_cupo (clave, origen) values (p_cupo, 'solicitud');
  insert into public.partners_solicitudes (
    comercio, representante, correo, sitio, rubro, plan, mensaje, clave_idempotencia
  ) values (
    pg_catalog.btrim(p_comercio),
    pg_catalog.btrim(p_representante),
    pg_catalog.btrim(p_correo),
    pg_catalog.btrim(coalesce(p_sitio, '')),
    pg_catalog.btrim(coalesce(p_rubro, '')),
    p_plan,
    pg_catalog.btrim(coalesce(p_mensaje, '')),
    p_idempotencia
  );

  return pg_catalog.jsonb_build_object('ok', true, 'repetida', false);
end;
$$;

create or replace function public.registrar_evento_publicidad(
  p_campana uuid,
  p_tipo text,
  p_token text,
  p_cupo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reciente bigint;
  global_hora bigint;
  visible boolean;
begin
  if p_campana is null
     or p_tipo is null or p_tipo not in ('impresion', 'clic')
     or p_token is null or p_token !~ '^[a-f0-9]{32}$'
     or p_cupo is null or p_cupo !~ '^[a-f0-9]{64}$'
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  select exists (
    select 1
    from public.partners_campanas k
    join public.comercios_asociados c on c.id = k.comercio_id
    where k.id = p_campana
      and k.estado = 'activa'
      and k.ubicacion = 'listado_cultivos'
      and k.inicio <= current_date
      and (k.fin is null or k.fin >= current_date)
      and c.aprobado = true
      and c.activo = true
      and c.estado_revision = 'aprobado'
      and c.plan in ('visibilidad', 'inteligente')
      and c.fecha_inicio <= current_date
      and (c.fecha_fin is null or c.fecha_fin >= current_date)
  ) into visible;

  if not visible then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_visible');
  end if;

  if exists (
    select 1 from public.partners_eventos e
    where e.campana_id = p_campana and e.tipo = p_tipo and e.token = p_token
  ) then
    return pg_catalog.jsonb_build_object('ok', true, 'contado', false);
  end if;

  select pg_catalog.count(*)::bigint into reciente
  from public.partners_cupo c
  where c.origen = 'evento' and c.clave = p_cupo and c.creada_en > pg_catalog.now() - interval '15 minutes';

  select pg_catalog.count(*)::bigint into global_hora
  from public.partners_eventos e
  where e.creada_en > pg_catalog.now() - interval '1 hour';

  if reciente >= 30 or global_hora >= 1000 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'limite');
  end if;

  insert into public.partners_cupo (clave, origen) values (p_cupo, 'evento');
  insert into public.partners_eventos (campana_id, tipo, token) values (p_campana, p_tipo, p_token);
  return pg_catalog.jsonb_build_object('ok', true, 'contado', true);
end;
$$;

create or replace function public.resumen_partners_admin(p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resultado jsonb;
begin
  if p_desde is null or p_hasta is null or p_hasta <= p_desde or p_hasta > p_desde + interval '366 days' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  with dias as (
    select pg_catalog.generate_series(
      (p_desde at time zone 'America/Argentina/Buenos_Aires')::date,
      ((p_hasta - interval '1 second') at time zone 'America/Argentina/Buenos_Aires')::date,
      interval '1 day'
    )::date as dia
  )
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'publicidad_en_flora', false,
    'desde', p_desde,
    'hasta', p_hasta,
    'medido_en', pg_catalog.now(),
    'comercios', (select pg_catalog.count(*)::bigint from public.comercios_asociados),
    'aprobados', (select pg_catalog.count(*)::bigint from public.comercios_asociados c where c.estado_revision = 'aprobado'),
    'pendientes', (select pg_catalog.count(*)::bigint from public.comercios_asociados c where c.estado_revision = 'pendiente'),
    'rechazados', (select pg_catalog.count(*)::bigint from public.comercios_asociados c where c.estado_revision = 'rechazado'),
    'activos', (
      select pg_catalog.count(*)::bigint
      from public.comercios_asociados c
      where c.estado_revision = 'aprobado'
        and c.activo = true
        and c.fecha_inicio <= current_date
        and (c.fecha_fin is null or c.fecha_fin >= current_date)
    ),
    'solicitudes', (select pg_catalog.count(*)::bigint from public.partners_solicitudes),
    'solicitudes_recibidas', (select pg_catalog.count(*)::bigint from public.partners_solicitudes s where s.estado = 'recibida'),
    'campanas_borrador', (select pg_catalog.count(*)::bigint from public.partners_campanas k where k.estado = 'borrador'),
    'campanas_programadas', (select pg_catalog.count(*)::bigint from public.partners_campanas k where k.estado = 'programada'),
    'campanas_activas', (select pg_catalog.count(*)::bigint from public.partners_campanas k where k.estado = 'activa'),
    'campanas_pausadas', (select pg_catalog.count(*)::bigint from public.partners_campanas k where k.estado = 'pausada'),
    'campanas_finalizadas', (select pg_catalog.count(*)::bigint from public.partners_campanas k where k.estado = 'finalizada'),
    'impresiones', (
      select pg_catalog.count(*)::bigint from public.partners_eventos e
      where e.tipo = 'impresion' and e.creada_en >= p_desde and e.creada_en < p_hasta
    ),
    'clics', (
      select pg_catalog.count(*)::bigint from public.partners_eventos e
      where e.tipo = 'clic' and e.creada_en >= p_desde and e.creada_en < p_hasta
    ),
    'serie', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'dia', pg_catalog.to_char(d.dia, 'YYYY-MM-DD'),
        'impresiones', (
          select pg_catalog.count(*)::bigint from public.partners_eventos e
          where e.tipo = 'impresion'
            and (e.creada_en at time zone 'America/Argentina/Buenos_Aires')::date = d.dia
            and e.creada_en >= p_desde and e.creada_en < p_hasta
        ),
        'clics', (
          select pg_catalog.count(*)::bigint from public.partners_eventos e
          where e.tipo = 'clic'
            and (e.creada_en at time zone 'America/Argentina/Buenos_Aires')::date = d.dia
            and e.creada_en >= p_desde and e.creada_en < p_hasta
        )
      ) order by d.dia)
      from dias d
    ), '[]'::jsonb),
    'por_ubicacion', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'ubicacion', u.ubicacion,
        'impresiones', (
          select pg_catalog.count(*)::bigint
          from public.partners_eventos e
          join public.partners_campanas k on k.id = e.campana_id
          where e.tipo = 'impresion' and k.ubicacion = u.ubicacion
            and e.creada_en >= p_desde and e.creada_en < p_hasta
        ),
        'clics', (
          select pg_catalog.count(*)::bigint
          from public.partners_eventos e
          join public.partners_campanas k on k.id = e.campana_id
          where e.tipo = 'clic' and k.ubicacion = u.ubicacion
            and e.creada_en >= p_desde and e.creada_en < p_hasta
        )
      ))
      from (select 'listado_cultivos'::text as ubicacion) u
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$$;

create or replace function public.alta_comercio_partners_admin(
  p_admin uuid,
  p_nombre text,
  p_rubro text,
  p_sitio text,
  p_plan text,
  p_inicio text,
  p_fin text,
  p_logo text,
  p_banner text,
  p_enlace text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inicio date;
  v_fin date;
  v_sitio text;
  v_logo text;
  v_banner text;
  v_enlace text;
  v_id uuid;
  v_nombre text;
  v_rubro text;
begin
  if p_admin is null or p_plan is null or p_plan not in ('presencia', 'visibilidad', 'inteligente') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_nombre := pg_catalog.btrim(coalesce(p_nombre, ''));
  v_rubro := pg_catalog.btrim(coalesce(p_rubro, ''));
  if pg_catalog.char_length(v_nombre) not between 2 and 120 or pg_catalog.char_length(v_rubro) > 80 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  begin
    v_inicio := p_inicio::date;
  exception when others then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end;
  v_fin := null;
  if pg_catalog.btrim(coalesce(p_fin, '')) <> '' then
    begin
      v_fin := p_fin::date;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end;
  end if;
  if v_fin is not null and v_fin < v_inicio then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_sitio := public.partners_admin_url(p_sitio, false);
  v_logo := public.partners_admin_url(p_logo, false);
  v_banner := public.partners_admin_url(p_banner, false);
  v_enlace := public.partners_admin_url(p_enlace, false);
  if v_sitio is null or v_logo is null or v_banner is null or v_enlace is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  insert into public.comercios_asociados (
    nombre, rubro, sitio_web, plan, fecha_inicio, fecha_fin, logo_url, banner_url, banner_enlace,
    activo, aprobado, estado_revision
  ) values (
    v_nombre, nullif(v_rubro, ''), nullif(v_sitio, ''), p_plan, v_inicio, v_fin,
    nullif(v_logo, ''), nullif(v_banner, ''), nullif(v_enlace, ''),
    false, false, 'pendiente'
  )
  returning id into v_id;

  perform public.partners_admin_auditar(p_admin, 'alta_comercio', 'comercio', v_id, '', 'pendiente');
  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.editar_comercio_partners_admin(
  p_admin uuid,
  p_id uuid,
  p_nombre text,
  p_rubro text,
  p_sitio text,
  p_plan text,
  p_inicio text,
  p_fin text,
  p_logo text,
  p_banner text,
  p_enlace text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inicio date;
  v_fin date;
  v_sitio text;
  v_logo text;
  v_banner text;
  v_enlace text;
  v_nombre text;
  v_rubro text;
begin
  if p_admin is null or p_id is null or p_plan is null or p_plan not in ('presencia', 'visibilidad', 'inteligente') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  if not exists (select 1 from public.comercios_asociados c where c.id = p_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;
  v_nombre := pg_catalog.btrim(coalesce(p_nombre, ''));
  v_rubro := pg_catalog.btrim(coalesce(p_rubro, ''));
  if pg_catalog.char_length(v_nombre) not between 2 and 120 or pg_catalog.char_length(v_rubro) > 80 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  begin
    v_inicio := p_inicio::date;
  exception when others then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end;
  v_fin := null;
  if pg_catalog.btrim(coalesce(p_fin, '')) <> '' then
    begin
      v_fin := p_fin::date;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end;
  end if;
  if v_fin is not null and v_fin < v_inicio then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_sitio := public.partners_admin_url(p_sitio, false);
  v_logo := public.partners_admin_url(p_logo, false);
  v_banner := public.partners_admin_url(p_banner, false);
  v_enlace := public.partners_admin_url(p_enlace, false);
  if v_sitio is null or v_logo is null or v_banner is null or v_enlace is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  update public.comercios_asociados
  set nombre = v_nombre,
      rubro = nullif(v_rubro, ''),
      sitio_web = nullif(v_sitio, ''),
      plan = p_plan,
      fecha_inicio = v_inicio,
      fecha_fin = v_fin,
      logo_url = nullif(v_logo, ''),
      banner_url = nullif(v_banner, ''),
      banner_enlace = nullif(v_enlace, '')
  where id = p_id;

  perform public.partners_admin_auditar(p_admin, 'edicion_comercio', 'comercio', p_id, '', 'editado');
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.estado_comercio_partners_admin(p_admin uuid, p_id uuid, p_accion text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_revision text;
  v_activo boolean;
  v_nuevo text;
begin
  if p_admin is null or p_id is null or p_accion is null
     or p_accion not in ('aprobar', 'rechazar', 'activar', 'desactivar') then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  select c.estado_revision, c.activo into v_revision, v_activo
  from public.comercios_asociados c
  where c.id = p_id
  for update;

  if v_revision is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;

  if p_accion = 'aprobar' then
    update public.comercios_asociados set estado_revision = 'aprobado', aprobado = true where id = p_id;
    v_nuevo := 'aprobado';
  elsif p_accion = 'rechazar' then
    update public.comercios_asociados
    set estado_revision = 'rechazado', aprobado = false, activo = false
    where id = p_id;
    v_nuevo := 'rechazado';
    v_activo := false;
  elsif p_accion = 'activar' then
    if v_revision <> 'aprobado' then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_aprobado');
    end if;
    update public.comercios_asociados set activo = true where id = p_id;
    v_nuevo := 'activo';
    v_activo := true;
  else
    update public.comercios_asociados set activo = false where id = p_id;
    v_nuevo := 'inactivo';
    v_activo := false;
  end if;

  perform public.partners_admin_auditar(p_admin, 'estado_comercio', 'comercio', p_id, v_revision, v_nuevo);
  return pg_catalog.jsonb_build_object('ok', true, 'estado_revision', case when p_accion = 'aprobar' then 'aprobado' when p_accion = 'rechazar' then 'rechazado' else v_revision end, 'activo', v_activo);
end;
$$;

create or replace function public.listar_comercios_partners_admin(
  p_admin uuid,
  p_busqueda text,
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
  v_busca text;
  v_total bigint;
  v_filas jsonb;
begin
  if p_admin is null or p_estado is null
     or p_estado not in ('todos', 'pendiente', 'aprobado', 'rechazado', 'activo', 'inactivo')
     or p_limite is null or p_limite < 1 or p_limite > 50
     or p_offset is null or p_offset < 0 or p_offset > 100000
     or pg_catalog.char_length(coalesce(p_busqueda, '')) > 80
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_busca := pg_catalog.replace(pg_catalog.replace(pg_catalog.btrim(coalesce(p_busqueda, '')), '%', ''), '_', '');

  select pg_catalog.count(*)::bigint into v_total
  from public.comercios_asociados c
  where (v_busca = '' or c.nombre ilike '%' || v_busca || '%' or coalesce(c.rubro, '') ilike '%' || v_busca || '%')
    and (
      p_estado = 'todos'
      or (p_estado = 'pendiente' and c.estado_revision = 'pendiente')
      or (p_estado = 'aprobado' and c.estado_revision = 'aprobado')
      or (p_estado = 'rechazado' and c.estado_revision = 'rechazado')
      or (p_estado = 'activo' and c.estado_revision = 'aprobado' and c.activo and c.fecha_inicio <= current_date and (c.fecha_fin is null or c.fecha_fin >= current_date))
      or (p_estado = 'inactivo' and c.activo = false)
    );

  select coalesce(pg_catalog.jsonb_agg(fila), '[]'::jsonb) into v_filas
  from (
    select pg_catalog.jsonb_build_object(
      'id', c.id,
      'nombre', c.nombre,
      'rubro', coalesce(c.rubro, ''),
      'plan', c.plan,
      'estado_revision', c.estado_revision,
      'activo', c.activo,
      'aprobado', c.aprobado,
      'fecha_inicio', c.fecha_inicio,
      'fecha_fin', c.fecha_fin
    ) as fila
    from public.comercios_asociados c
    where (v_busca = '' or c.nombre ilike '%' || v_busca || '%' or coalesce(c.rubro, '') ilike '%' || v_busca || '%')
      and (
        p_estado = 'todos'
        or (p_estado = 'pendiente' and c.estado_revision = 'pendiente')
        or (p_estado = 'aprobado' and c.estado_revision = 'aprobado')
        or (p_estado = 'rechazado' and c.estado_revision = 'rechazado')
        or (p_estado = 'activo' and c.estado_revision = 'aprobado' and c.activo and c.fecha_inicio <= current_date and (c.fecha_fin is null or c.fecha_fin >= current_date))
        or (p_estado = 'inactivo' and c.activo = false)
      )
    order by c.fecha_creacion desc, c.id
    limit p_limite offset p_offset
  ) pagina;

  return pg_catalog.jsonb_build_object('ok', true, 'total', v_total, 'limite', p_limite, 'offset', p_offset, 'filas', v_filas);
end;
$$;

create or replace function public.detalle_comercio_partners_admin(p_admin uuid, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resultado jsonb;
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;

  select pg_catalog.jsonb_build_object(
    'ok', true,
    'id', c.id,
    'nombre', c.nombre,
    'rubro', coalesce(c.rubro, ''),
    'sitio_web', coalesce(public.partners_admin_url_publica(c.sitio_web), ''),
    'logo_url', coalesce(public.partners_admin_url_publica(c.logo_url), ''),
    'banner_url', coalesce(public.partners_admin_url_publica(c.banner_url), ''),
    'banner_enlace', coalesce(public.partners_admin_url_publica(c.banner_enlace), ''),
    'plan', c.plan,
    'estado_revision', c.estado_revision,
    'activo', c.activo,
    'aprobado', c.aprobado,
    'fecha_inicio', c.fecha_inicio,
    'fecha_fin', c.fecha_fin,
    'fecha_creacion', c.fecha_creacion,
    'historial', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'accion', a.accion,
        'antes', a.antes,
        'despues', a.despues,
        'creada_en', a.creada_en
      ) order by a.creada_en desc)
      from (
        select accion, antes, despues, creada_en
        from public.partners_auditoria
        where entidad = 'comercio' and entidad_id = c.id
        order by creada_en desc
        limit 30
      ) a
    ), '[]'::jsonb)
  ) into resultado
  from public.comercios_asociados c
  where c.id = p_id;

  if resultado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;
  return resultado;
end;
$$;

create or replace function public.listar_solicitudes_partners_admin(
  p_admin uuid, p_busqueda text, p_estado text, p_limite integer, p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_busca text;
  v_total bigint;
  v_filas jsonb;
begin
  if p_admin is null or p_estado is null
     or p_estado not in ('todos', 'recibida', 'en_revision', 'aprobada', 'rechazada', 'cerrada')
     or p_limite is null or p_limite < 1 or p_limite > 50
     or p_offset is null or p_offset < 0 or p_offset > 100000
     or pg_catalog.char_length(coalesce(p_busqueda, '')) > 80
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_busca := pg_catalog.replace(pg_catalog.replace(pg_catalog.btrim(coalesce(p_busqueda, '')), '%', ''), '_', '');
  select pg_catalog.count(*)::bigint into v_total
  from public.partners_solicitudes s
  where (p_estado = 'todos' or s.estado = p_estado)
    and (v_busca = '' or s.comercio ilike '%' || v_busca || '%' or s.correo ilike '%' || v_busca || '%');
  select coalesce(pg_catalog.jsonb_agg(fila), '[]'::jsonb) into v_filas
  from (
    select pg_catalog.jsonb_build_object(
      'id', s.id,
      'comercio', s.comercio,
      'correo', s.correo,
      'estado', s.estado,
      'plan', s.plan,
      'recibida_en', s.recibida_en,
      'actualizada_en', s.actualizada_en,
      'resumen', pg_catalog.left(s.mensaje, 140)
    ) as fila
    from public.partners_solicitudes s
    where (p_estado = 'todos' or s.estado = p_estado)
      and (v_busca = '' or s.comercio ilike '%' || v_busca || '%' or s.correo ilike '%' || v_busca || '%')
    order by s.recibida_en desc, s.id
    limit p_limite offset p_offset
  ) pagina;
  return pg_catalog.jsonb_build_object('ok', true, 'total', v_total, 'limite', p_limite, 'offset', p_offset, 'filas', v_filas);
end;
$$;

create or replace function public.detalle_solicitud_partners_admin(p_admin uuid, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resultado jsonb;
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'id', s.id,
    'comercio', s.comercio,
    'representante', s.representante,
    'correo', s.correo,
    'sitio', s.sitio,
    'rubro', s.rubro,
    'plan', s.plan,
    'mensaje', s.mensaje,
    'estado', s.estado,
    'nota_interna', s.nota_interna,
    'recibida_en', s.recibida_en,
    'actualizada_en', s.actualizada_en
  ) into resultado
  from public.partners_solicitudes s
  where s.id = p_id;
  if resultado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;
  return resultado;
end;
$$;

create or replace function public.gestionar_solicitud_partners_admin(
  p_admin uuid, p_id uuid, p_estado text, p_nota text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_nota text;
begin
  if p_admin is null or p_id is null or p_estado is null
     or p_estado not in ('recibida', 'en_revision', 'aprobada', 'rechazada', 'cerrada')
     or p_nota is null or pg_catalog.char_length(p_nota) > 2000
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  select s.estado into v_estado from public.partners_solicitudes s where s.id = p_id for update;
  if v_estado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;
  v_nota := pg_catalog.btrim(p_nota);
  update public.partners_solicitudes
  set estado = p_estado, nota_interna = v_nota, actualizada_en = pg_catalog.now()
  where id = p_id;
  perform public.partners_admin_auditar(p_admin, 'estado_solicitud', 'solicitud', p_id, v_estado, p_estado);
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.alta_campana_partners_admin(
  p_admin uuid, p_comercio uuid, p_nombre text, p_pieza text, p_ubicacion text,
  p_enlace text, p_inicio text, p_fin text, p_prioridad integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inicio date;
  v_fin date;
  v_pieza text;
  v_enlace text;
  v_nombre text;
  v_id uuid;
begin
  if p_admin is null or p_comercio is null or p_ubicacion is distinct from 'listado_cultivos'
     or p_prioridad is null or p_prioridad < 0 or p_prioridad > 100
     or not exists (select 1 from public.comercios_asociados c where c.id = p_comercio)
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_nombre := pg_catalog.btrim(coalesce(p_nombre, ''));
  if pg_catalog.char_length(v_nombre) not between 2 and 120 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  begin
    v_inicio := p_inicio::date;
  exception when others then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end;
  v_fin := null;
  if pg_catalog.btrim(coalesce(p_fin, '')) <> '' then
    begin
      v_fin := p_fin::date;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end;
  end if;
  if v_fin is not null and v_fin < v_inicio then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_pieza := public.partners_admin_url(p_pieza, false);
  v_enlace := public.partners_admin_url(p_enlace, false);
  if v_pieza is null or v_enlace is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  insert into public.partners_campanas (comercio_id, nombre, pieza_url, ubicacion, enlace, inicio, fin, estado, prioridad)
  values (p_comercio, v_nombre, nullif(v_pieza, ''), p_ubicacion, nullif(v_enlace, ''), v_inicio, v_fin, 'borrador', p_prioridad)
  returning id into v_id;
  perform public.partners_admin_auditar(p_admin, 'alta_campana', 'campana', v_id, '', 'borrador');
  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id, 'estado', 'borrador');
end;
$$;

create or replace function public.editar_campana_partners_admin(
  p_admin uuid, p_id uuid, p_comercio uuid, p_nombre text, p_pieza text, p_ubicacion text,
  p_enlace text, p_inicio text, p_fin text, p_prioridad integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inicio date;
  v_fin date;
  v_pieza text;
  v_enlace text;
  v_nombre text;
begin
  if p_admin is null or p_id is null or p_comercio is null or p_ubicacion is distinct from 'listado_cultivos'
     or p_prioridad is null or p_prioridad < 0 or p_prioridad > 100
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  if not exists (select 1 from public.partners_campanas k where k.id = p_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;
  if not exists (select 1 from public.comercios_asociados c where c.id = p_comercio) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_nombre := pg_catalog.btrim(coalesce(p_nombre, ''));
  if pg_catalog.char_length(v_nombre) not between 2 and 120 then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  begin
    v_inicio := p_inicio::date;
  exception when others then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end;
  v_fin := null;
  if pg_catalog.btrim(coalesce(p_fin, '')) <> '' then
    begin
      v_fin := p_fin::date;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end;
  end if;
  if v_fin is not null and v_fin < v_inicio then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_pieza := public.partners_admin_url(p_pieza, false);
  v_enlace := public.partners_admin_url(p_enlace, false);
  if v_pieza is null or v_enlace is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  update public.partners_campanas
  set comercio_id = p_comercio, nombre = v_nombre, pieza_url = nullif(v_pieza, ''),
      ubicacion = p_ubicacion, enlace = nullif(v_enlace, ''), inicio = v_inicio, fin = v_fin,
      prioridad = p_prioridad, actualizada_en = pg_catalog.now()
  where id = p_id;
  perform public.partners_admin_auditar(p_admin, 'edicion_campana', 'campana', p_id, '', 'editada');
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.estado_campana_partners_admin(p_admin uuid, p_id uuid, p_estado text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_pieza text;
  v_enlace text;
  v_fin date;
  v_plan text;
  v_revision text;
begin
  if p_admin is null or p_id is null or p_estado is null
     or p_estado not in ('borrador', 'programada', 'activa', 'pausada', 'finalizada')
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  select k.estado, k.pieza_url, k.enlace, k.fin, c.plan, c.estado_revision
    into v_estado, v_pieza, v_enlace, v_fin, v_plan, v_revision
  from public.partners_campanas k
  join public.comercios_asociados c on c.id = k.comercio_id
  where k.id = p_id
  for update of k;
  if v_estado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;
  if p_estado = v_estado then
    return pg_catalog.jsonb_build_object('ok', true, 'estado', v_estado);
  end if;
  if not (
    (v_estado = 'borrador' and p_estado in ('programada', 'activa'))
    or (v_estado = 'programada' and p_estado in ('borrador', 'activa', 'pausada', 'finalizada'))
    or (v_estado = 'activa' and p_estado in ('pausada', 'finalizada'))
    or (v_estado = 'pausada' and p_estado in ('activa', 'finalizada'))
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'transicion');
  end if;
  if p_estado = 'activa' then
    if v_revision <> 'aprobado' or v_plan not in ('visibilidad', 'inteligente')
       or public.partners_admin_url(v_pieza, true) is null
       or public.partners_admin_url(v_enlace, true) is null
       or (v_fin is not null and v_fin < current_date)
    then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'incompleta');
    end if;
  end if;
  update public.partners_campanas set estado = p_estado, actualizada_en = pg_catalog.now() where id = p_id;
  perform public.partners_admin_auditar(p_admin, 'estado_campana', 'campana', p_id, v_estado, p_estado);
  return pg_catalog.jsonb_build_object('ok', true, 'estado', p_estado);
end;
$$;

create or replace function public.listar_campanas_partners_admin(
  p_admin uuid, p_estado text, p_limite integer, p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total bigint;
  v_filas jsonb;
begin
  if p_admin is null or p_estado is null
     or p_estado not in ('todos', 'borrador', 'programada', 'activa', 'pausada', 'finalizada')
     or p_limite is null or p_limite < 1 or p_limite > 50
     or p_offset is null or p_offset < 0 or p_offset > 100000
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  select pg_catalog.count(*)::bigint into v_total
  from public.partners_campanas k
  where p_estado = 'todos' or k.estado = p_estado;
  select coalesce(pg_catalog.jsonb_agg(fila), '[]'::jsonb) into v_filas
  from (
    select pg_catalog.jsonb_build_object(
      'id', k.id,
      'nombre', k.nombre,
      'comercio_id', k.comercio_id,
      'comercio', c.nombre,
      'ubicacion', k.ubicacion,
      'estado', k.estado,
      'inicio', k.inicio,
      'fin', k.fin,
      'prioridad', k.prioridad,
      'impresiones', (select pg_catalog.count(*)::bigint from public.partners_eventos e where e.campana_id = k.id and e.tipo = 'impresion'),
      'clics', (select pg_catalog.count(*)::bigint from public.partners_eventos e where e.campana_id = k.id and e.tipo = 'clic')
    ) as fila
    from public.partners_campanas k
    join public.comercios_asociados c on c.id = k.comercio_id
    where p_estado = 'todos' or k.estado = p_estado
    order by k.creada_en desc, k.id
    limit p_limite offset p_offset
  ) pagina;
  return pg_catalog.jsonb_build_object('ok', true, 'total', v_total, 'limite', p_limite, 'offset', p_offset, 'filas', v_filas);
end;
$$;

create or replace function public.detalle_campana_partners_admin(p_admin uuid, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resultado jsonb;
  v_impresiones bigint;
  v_clics bigint;
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  select pg_catalog.count(*)::bigint into v_impresiones from public.partners_eventos e where e.campana_id = p_id and e.tipo = 'impresion';
  select pg_catalog.count(*)::bigint into v_clics from public.partners_eventos e where e.campana_id = p_id and e.tipo = 'clic';
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'id', k.id,
    'nombre', k.nombre,
    'comercio_id', k.comercio_id,
    'comercio', c.nombre,
    'ubicacion', k.ubicacion,
    'pieza_url', coalesce(public.partners_admin_url_publica(k.pieza_url), ''),
    'enlace', coalesce(public.partners_admin_url_publica(k.enlace), ''),
    'inicio', k.inicio,
    'fin', k.fin,
    'estado', k.estado,
    'prioridad', k.prioridad,
    'impresiones', v_impresiones,
    'clics', v_clics,
    'creada_en', k.creada_en
  ) into resultado
  from public.partners_campanas k
  join public.comercios_asociados c on c.id = k.comercio_id
  where k.id = p_id;
  if resultado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;
  return resultado;
end;
$$;

revoke all on function public.partners_admin_url(text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.partners_admin_url_publica(text) from public, anon, authenticated, service_role;
revoke all on function public.partners_admin_auditar(uuid, text, text, uuid, text, text) from public, anon, authenticated, service_role;

revoke all on function public.registrar_solicitud_partners(text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.registrar_evento_publicidad(uuid, text, text, text) from public;
grant execute on function public.registrar_solicitud_partners(text, text, text, text, text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.registrar_evento_publicidad(uuid, text, text, text) to anon, authenticated, service_role;

revoke all on function public.resumen_partners_admin(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.listar_comercios_partners_admin(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.detalle_comercio_partners_admin(uuid, uuid) from public, anon, authenticated;
revoke all on function public.alta_comercio_partners_admin(uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.editar_comercio_partners_admin(uuid, uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.estado_comercio_partners_admin(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.listar_solicitudes_partners_admin(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.detalle_solicitud_partners_admin(uuid, uuid) from public, anon, authenticated;
revoke all on function public.gestionar_solicitud_partners_admin(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.alta_campana_partners_admin(uuid, uuid, text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.editar_campana_partners_admin(uuid, uuid, uuid, text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.estado_campana_partners_admin(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.listar_campanas_partners_admin(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.detalle_campana_partners_admin(uuid, uuid) from public, anon, authenticated;

grant execute on function public.resumen_partners_admin(timestamptz, timestamptz) to service_role;
grant execute on function public.listar_comercios_partners_admin(uuid, text, text, integer, integer) to service_role;
grant execute on function public.detalle_comercio_partners_admin(uuid, uuid) to service_role;
grant execute on function public.alta_comercio_partners_admin(uuid, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.editar_comercio_partners_admin(uuid, uuid, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.estado_comercio_partners_admin(uuid, uuid, text) to service_role;
grant execute on function public.listar_solicitudes_partners_admin(uuid, text, text, integer, integer) to service_role;
grant execute on function public.detalle_solicitud_partners_admin(uuid, uuid) to service_role;
grant execute on function public.gestionar_solicitud_partners_admin(uuid, uuid, text, text) to service_role;
grant execute on function public.alta_campana_partners_admin(uuid, uuid, text, text, text, text, text, text, integer) to service_role;
grant execute on function public.editar_campana_partners_admin(uuid, uuid, uuid, text, text, text, text, text, text, integer) to service_role;
grant execute on function public.estado_campana_partners_admin(uuid, uuid, text) to service_role;
grant execute on function public.listar_campanas_partners_admin(uuid, text, integer, integer) to service_role;
grant execute on function public.detalle_campana_partners_admin(uuid, uuid) to service_role;
