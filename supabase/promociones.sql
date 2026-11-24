-- ENFLORA — promociones sobre la administración de partners.
--
-- Corré este archivo en el SQL editor después de supabase/admin-partners.sql.
-- No lo ejecuta la aplicación. Es idempotente: se puede volver a correr.
-- No borra comercios, campañas ni eventos. No abre datos de usuarios a partners.
-- Una campaña interna no tiene comercio: no simula un anunciante.
-- Los borradores siguen fuera de la lectura pública.

alter table public.partners_campanas
  add column if not exists tipo text not null default 'comercial',
  add column if not exists formato text not null default 'banner',
  add column if not exists segmentos text[] not null default array['gratuito', 'plus', 'licencia']::text[],
  add column if not exists titulo text not null default '',
  add column if not exists descripcion text not null default '',
  add column if not exists cta text not null default '',
  add column if not exists frecuencia_dias integer not null default 0,
  add column if not exists anunciar_futuros boolean not null default false,
  add column if not exists es_upsell_plus boolean not null default false;

alter table public.partners_campanas alter column comercio_id drop not null;

alter table public.partners_campanas drop constraint if exists partners_campanas_ubicacion_valida;
alter table public.partners_campanas drop constraint if exists partners_campanas_tipo_valido;
alter table public.partners_campanas drop constraint if exists partners_campanas_formato_valido;
alter table public.partners_campanas drop constraint if exists partners_campanas_segmentos_validos;
alter table public.partners_campanas drop constraint if exists partners_campanas_frecuencia_valida;
alter table public.partners_campanas drop constraint if exists partners_campanas_tipo_comercio;
alter table public.partners_campanas drop constraint if exists partners_campanas_upsell_valido;
alter table public.partners_campanas drop constraint if exists partners_campanas_textos_largos;

alter table public.partners_campanas
  add constraint partners_campanas_ubicacion_valida check (ubicacion in ('listado_cultivos', 'inicio')),
  add constraint partners_campanas_tipo_valido check (tipo in ('interna', 'comercial', 'beneficio')),
  add constraint partners_campanas_formato_valido check (formato in ('banner', 'modal')),
  add constraint partners_campanas_segmentos_validos check (
    cardinality(segmentos) between 1 and 3
    and segmentos <@ array['gratuito', 'plus', 'licencia']::text[]
  ),
  add constraint partners_campanas_frecuencia_valida check (frecuencia_dias between 0 and 366),
  add constraint partners_campanas_tipo_comercio check (
    (tipo = 'interna' and comercio_id is null)
    or (tipo in ('comercial', 'beneficio') and comercio_id is not null)
  ),
  add constraint partners_campanas_upsell_valido check (
    es_upsell_plus = false
    or (tipo = 'interna' and not ('plus' = any (segmentos)) and enlace = '/pagos/plus')
  ),
  add constraint partners_campanas_textos_largos check (
    pg_catalog.char_length(titulo) <= 80
    and pg_catalog.char_length(descripcion) <= 400
    and pg_catalog.char_length(cta) <= 40
  );

create table if not exists public.partners_frecuencia (
  usuario_id uuid not null,
  campana_id uuid not null references public.partners_campanas (id) on delete cascade,
  impresion_en timestamptz,
  cierre_en timestamptz,
  primary key (usuario_id, campana_id),
  constraint partners_frecuencia_alguna check (impresion_en is not null or cierre_en is not null)
);

create index if not exists partners_frecuencia_campana_idx
  on public.partners_frecuencia (campana_id);

alter table public.partners_frecuencia enable row level security;

drop policy if exists partners_frecuencia_lee on public.partners_frecuencia;
drop policy if exists partners_frecuencia_crea on public.partners_frecuencia;
drop policy if exists partners_frecuencia_edita on public.partners_frecuencia;

create policy partners_frecuencia_lee
on public.partners_frecuencia
for select
to authenticated
using (usuario_id = auth.uid());

create policy partners_frecuencia_crea
on public.partners_frecuencia
for insert
to authenticated
with check (usuario_id = auth.uid());

create policy partners_frecuencia_edita
on public.partners_frecuencia
for update
to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

revoke all on table public.partners_frecuencia from public, anon, authenticated;
grant select, insert, update on table public.partners_frecuencia to authenticated;

create or replace function public.partners_admin_normalizar_campana(
  p_comercio text,
  p_nombre text,
  p_pieza text,
  p_ubicacion text,
  p_enlace text,
  p_inicio text,
  p_fin text,
  p_prioridad integer,
  p_tipo text,
  p_formato text,
  p_segmentos text,
  p_titulo text,
  p_descripcion text,
  p_cta text,
  p_frecuencia integer,
  p_anunciar text,
  p_upsell text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_comercio uuid;
  v_nombre text;
  v_titulo text;
  v_descripcion text;
  v_cta text;
  v_enlace text;
  v_pieza text;
  v_inicio date;
  v_fin date;
  v_segmentos text[];
  v_crudo text;
begin
  if p_tipo not in ('interna', 'comercial', 'beneficio')
     or p_formato not in ('banner', 'modal')
     or p_ubicacion not in ('listado_cultivos', 'inicio')
     or p_anunciar not in ('si', 'no')
     or p_upsell not in ('si', 'no')
     or p_prioridad is null or p_prioridad < 0 or p_prioridad > 100
     or p_frecuencia is null or p_frecuencia < 0 or p_frecuencia > 366
     or (p_ubicacion = 'listado_cultivos' and p_formato <> 'banner')
     or p_segmentos is null
     or p_segmentos !~ '^(gratuito|plus|licencia)(,(gratuito|plus|licencia)){0,2}$'
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_segmentos := pg_catalog.string_to_array(p_segmentos, ',');
  if (select pg_catalog.count(*) from pg_catalog.unnest(v_segmentos) as item) <>
     (select pg_catalog.count(distinct item) from pg_catalog.unnest(v_segmentos) as item)
     or exists (
       select 1 from pg_catalog.unnest(v_segmentos) as item
       where item not in ('gratuito', 'plus', 'licencia')
     )
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_nombre := pg_catalog.btrim(coalesce(p_nombre, ''));
  v_titulo := pg_catalog.btrim(coalesce(p_titulo, ''));
  v_descripcion := pg_catalog.btrim(coalesce(p_descripcion, ''));
  v_cta := pg_catalog.btrim(coalesce(p_cta, ''));
  if pg_catalog.char_length(v_nombre) not between 2 and 120
     or pg_catalog.char_length(v_titulo) > 80
     or pg_catalog.char_length(v_descripcion) > 400
     or pg_catalog.char_length(v_cta) > 40
     or v_titulo ~* 'sin anuncios|sin publicidad|ad-free|ad free'
     or v_descripcion ~* 'sin anuncios|sin publicidad|ad-free|ad free'
     or v_cta ~* 'sin anuncios|sin publicidad|ad-free|ad free'
  then
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
  if v_pieza is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v_crudo := pg_catalog.btrim(coalesce(p_enlace, ''));
  if v_crudo = '' then
    v_enlace := '';
  elsif pg_catalog.left(v_crudo, 1) = '/' then
    if p_tipo <> 'interna'
       or v_crudo !~ '^/[A-Za-z0-9/_-]{1,120}$'
       or v_crudo = '/admin' or v_crudo like '/admin/%'
       or v_crudo = '/api' or v_crudo like '/api/%'
       or pg_catalog.strpos(v_crudo, '..') > 0
    then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end if;
    v_enlace := v_crudo;
  else
    v_enlace := public.partners_admin_url(v_crudo, true);
    if v_enlace is null then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end if;
  end if;
  v_comercio := null;
  if p_tipo = 'interna' then
    if pg_catalog.btrim(coalesce(p_comercio, '')) <> ''
       or pg_catalog.char_length(v_titulo) < 2
       or pg_catalog.char_length(v_cta) < 2
    then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end if;
    if p_upsell = 'si' then
      if 'plus' = any (v_segmentos) or (v_enlace <> '' and v_enlace <> '/pagos/plus') then
        return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
      end if;
      v_enlace := '/pagos/plus';
    end if;
  else
    if p_upsell = 'si' then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end if;
    begin
      v_comercio := pg_catalog.btrim(p_comercio)::uuid;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end;
    if v_comercio is null or not exists (select 1 from public.comercios_asociados c where c.id = v_comercio) then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
    end if;
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'comercio', v_comercio,
    'nombre', v_nombre,
    'pieza', nullif(v_pieza, ''),
    'ubicacion', p_ubicacion,
    'enlace', nullif(v_enlace, ''),
    'inicio', v_inicio,
    'fin', v_fin,
    'prioridad', p_prioridad,
    'tipo', p_tipo,
    'formato', p_formato,
    'segmentos', to_jsonb(v_segmentos),
    'titulo', v_titulo,
    'descripcion', v_descripcion,
    'cta', v_cta,
    'frecuencia', p_frecuencia,
    'anunciar', p_anunciar = 'si',
    'upsell', p_upsell = 'si'
  );
end;
$$;

drop function if exists public.alta_campana_partners_admin(uuid, uuid, text, text, text, text, text, text, integer);
drop function if exists public.editar_campana_partners_admin(uuid, uuid, uuid, text, text, text, text, text, text, integer);

create or replace function public.alta_campana_partners_admin(
  p_admin uuid, p_comercio text, p_nombre text, p_pieza text, p_ubicacion text,
  p_enlace text, p_inicio text, p_fin text, p_prioridad integer, p_tipo text,
  p_formato text, p_segmentos text, p_titulo text, p_descripcion text, p_cta text,
  p_frecuencia integer, p_anunciar text, p_upsell text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v jsonb;
  v_id uuid;
  v_segmentos text[];
begin
  if p_admin is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  v := public.partners_admin_normalizar_campana(
    p_comercio, p_nombre, p_pieza, p_ubicacion, p_enlace, p_inicio, p_fin, p_prioridad,
    p_tipo, p_formato, p_segmentos, p_titulo, p_descripcion, p_cta, p_frecuencia, p_anunciar, p_upsell
  );
  if coalesce(v->>'ok', '') <> 'true' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  select coalesce(pg_catalog.array_agg(item), array[]::text[]) into v_segmentos
  from pg_catalog.jsonb_array_elements_text(v->'segmentos') as item;
  insert into public.partners_campanas (
    comercio_id, nombre, pieza_url, ubicacion, enlace, inicio, fin, estado, prioridad,
    tipo, formato, segmentos, titulo, descripcion, cta, frecuencia_dias, anunciar_futuros, es_upsell_plus
  ) values (
    nullif(v->>'comercio', '')::uuid,
    v->>'nombre',
    v->>'pieza',
    v->>'ubicacion',
    v->>'enlace',
    (v->>'inicio')::date,
    nullif(v->>'fin', '')::date,
    'borrador',
    (v->>'prioridad')::integer,
    v->>'tipo',
    v->>'formato',
    v_segmentos,
    v->>'titulo',
    v->>'descripcion',
    v->>'cta',
    (v->>'frecuencia')::integer,
    (v->>'anunciar')::boolean,
    (v->>'upsell')::boolean
  ) returning id into v_id;
  perform public.partners_admin_auditar(p_admin, 'alta_campana', 'campana', v_id, '', 'borrador');
  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id, 'estado', 'borrador');
end;
$$;

create or replace function public.editar_campana_partners_admin(
  p_admin uuid, p_id uuid, p_comercio text, p_nombre text, p_pieza text, p_ubicacion text,
  p_enlace text, p_inicio text, p_fin text, p_prioridad integer, p_tipo text,
  p_formato text, p_segmentos text, p_titulo text, p_descripcion text, p_cta text,
  p_frecuencia integer, p_anunciar text, p_upsell text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v jsonb;
  v_segmentos text[];
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  if not exists (select 1 from public.partners_campanas k where k.id = p_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;
  v := public.partners_admin_normalizar_campana(
    p_comercio, p_nombre, p_pieza, p_ubicacion, p_enlace, p_inicio, p_fin, p_prioridad,
    p_tipo, p_formato, p_segmentos, p_titulo, p_descripcion, p_cta, p_frecuencia, p_anunciar, p_upsell
  );
  if coalesce(v->>'ok', '') <> 'true' then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  select coalesce(pg_catalog.array_agg(item), array[]::text[]) into v_segmentos
  from pg_catalog.jsonb_array_elements_text(v->'segmentos') as item;
  update public.partners_campanas
  set comercio_id = nullif(v->>'comercio', '')::uuid,
      nombre = v->>'nombre',
      pieza_url = v->>'pieza',
      ubicacion = v->>'ubicacion',
      enlace = v->>'enlace',
      inicio = (v->>'inicio')::date,
      fin = nullif(v->>'fin', '')::date,
      prioridad = (v->>'prioridad')::integer,
      tipo = v->>'tipo',
      formato = v->>'formato',
      segmentos = v_segmentos,
      titulo = v->>'titulo',
      descripcion = v->>'descripcion',
      cta = v->>'cta',
      frecuencia_dias = (v->>'frecuencia')::integer,
      anunciar_futuros = (v->>'anunciar')::boolean,
      es_upsell_plus = (v->>'upsell')::boolean,
      actualizada_en = pg_catalog.now()
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
  v_tipo text;
  v_titulo text;
  v_cta text;
  v_upsell boolean;
  v_segmentos text[];
  v_comercio uuid;
begin
  if p_admin is null or p_id is null or p_estado is null
     or p_estado not in ('borrador', 'programada', 'activa', 'pausada', 'finalizada')
  then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  select k.estado, k.pieza_url, k.enlace, k.fin, k.tipo, k.titulo, k.cta, k.es_upsell_plus, k.segmentos, k.comercio_id,
         c.plan, c.estado_revision
    into v_estado, v_pieza, v_enlace, v_fin, v_tipo, v_titulo, v_cta, v_upsell, v_segmentos, v_comercio,
         v_plan, v_revision
  from public.partners_campanas k
  left join public.comercios_asociados c on c.id = k.comercio_id
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
    if v_fin is not null and v_fin < current_date then
      return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'incompleta');
    end if;
    if v_tipo = 'interna' then
      if v_comercio is not null
         or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_titulo, ''))) < 2
         or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_cta, ''))) < 2
         or (v_upsell and ('plus' = any (v_segmentos) or v_enlace is distinct from '/pagos/plus'))
      then
        return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'incompleta');
      end if;
    elsif v_revision is distinct from 'aprobado'
       or v_plan not in ('visibilidad', 'inteligente')
       or public.partners_admin_url(v_pieza, true) is null
       or public.partners_admin_url(v_enlace, true) is null
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
      'comercio', case when k.tipo = 'interna' then 'ENFLORA' else c.nombre end,
      'ubicacion', k.ubicacion,
      'formato', k.formato,
      'tipo', k.tipo,
      'estado', k.estado,
      'inicio', k.inicio,
      'fin', k.fin,
      'prioridad', k.prioridad,
      'impresiones', (select pg_catalog.count(*)::bigint from public.partners_eventos e where e.campana_id = k.id and e.tipo = 'impresion'),
      'clics', (select pg_catalog.count(*)::bigint from public.partners_eventos e where e.campana_id = k.id and e.tipo = 'clic')
    ) as fila
    from public.partners_campanas k
    left join public.comercios_asociados c on c.id = k.comercio_id
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
  v_cierres bigint;
begin
  if p_admin is null or p_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'consulta_invalida');
  end if;
  select pg_catalog.count(*)::bigint into v_impresiones from public.partners_eventos e where e.campana_id = p_id and e.tipo = 'impresion';
  select pg_catalog.count(*)::bigint into v_clics from public.partners_eventos e where e.campana_id = p_id and e.tipo = 'clic';
  select pg_catalog.count(*)::bigint into v_cierres from public.partners_frecuencia f where f.campana_id = p_id and f.cierre_en is not null;
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'id', k.id,
    'nombre', k.nombre,
    'comercio_id', k.comercio_id,
    'comercio', case when k.tipo = 'interna' then 'ENFLORA' else c.nombre end,
    'ubicacion', k.ubicacion,
    'tipo', k.tipo,
    'formato', k.formato,
    'segmentos', to_jsonb(k.segmentos),
    'titulo', k.titulo,
    'descripcion', k.descripcion,
    'cta', k.cta,
    'frecuencia_dias', k.frecuencia_dias,
    'anunciar_futuros', k.anunciar_futuros,
    'es_upsell_plus', k.es_upsell_plus,
    'pieza_url', coalesce(public.partners_admin_url_publica(k.pieza_url), ''),
    'enlace', case
      when k.enlace = '/pagos/plus' then k.enlace
      else coalesce(public.partners_admin_url_publica(k.enlace), '')
    end,
    'inicio', k.inicio,
    'fin', k.fin,
    'estado', k.estado,
    'prioridad', k.prioridad,
    'impresiones', v_impresiones,
    'clics', v_clics,
    'cierres', v_cierres,
    'creada_en', k.creada_en
  ) into resultado
  from public.partners_campanas k
  left join public.comercios_asociados c on c.id = k.comercio_id
  where k.id = p_id;
  if resultado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'codigo', 'no_encontrado');
  end if;
  return resultado;
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
    left join public.comercios_asociados c on c.id = k.comercio_id
    where k.id = p_campana
      and k.estado = 'activa'
      and k.ubicacion in ('listado_cultivos', 'inicio')
      and k.inicio <= current_date
      and (k.fin is null or k.fin >= current_date)
      and (
        (k.tipo = 'interna' and k.comercio_id is null)
        or (
          k.tipo in ('comercial', 'beneficio')
          and c.aprobado = true
          and c.activo = true
          and c.estado_revision = 'aprobado'
          and c.plan in ('visibilidad', 'inteligente')
          and c.fecha_inicio <= current_date
          and (c.fecha_fin is null or c.fecha_fin >= current_date)
        )
      )
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
      ) order by u.ubicacion)
      from (values ('inicio'::text), ('listado_cultivos'::text)) as u(ubicacion)
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$$;

drop policy if exists partners_campanas_lectura_publica on public.partners_campanas;
create policy partners_campanas_lectura_publica
on public.partners_campanas
for select
to anon, authenticated
using (
  estado = 'activa'
  and ubicacion in ('listado_cultivos', 'inicio')
  and inicio <= current_date
  and (fin is null or fin >= current_date)
  and (
    (tipo = 'interna' and comercio_id is null)
    or (
      tipo in ('comercial', 'beneficio')
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
    )
  )
);

grant select (
  id, comercio_id, nombre, pieza_url, ubicacion, enlace, inicio, fin, estado, prioridad,
  tipo, formato, segmentos, titulo, descripcion, cta, frecuencia_dias, anunciar_futuros, es_upsell_plus
) on public.partners_campanas to anon, authenticated;

revoke all on function public.partners_admin_normalizar_campana(text, text, text, text, text, text, text, integer, text, text, text, text, text, text, integer, text, text) from public, anon, authenticated, service_role;
revoke all on function public.alta_campana_partners_admin(uuid, text, text, text, text, text, text, text, integer, text, text, text, text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.editar_campana_partners_admin(uuid, uuid, text, text, text, text, text, text, text, integer, text, text, text, text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.alta_campana_partners_admin(uuid, text, text, text, text, text, text, text, integer, text, text, text, text, text, text, integer, text, text) to service_role;
grant execute on function public.editar_campana_partners_admin(uuid, uuid, text, text, text, text, text, text, text, integer, text, text, text, text, text, text, integer, text, text) to service_role;
