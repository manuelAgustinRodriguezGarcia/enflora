create extension if not exists pgcrypto;

create table if not exists public.contactos_enflora (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  email text,
  telefono text,
  origen_inicial text not null,
  origenes text[] not null default '{}',
  consentimiento_marketing boolean not null default false,
  consentimiento_fecha timestamptz,
  consentimiento_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contactos_enflora_origen_inicial_check check (origen_inicial in ('landing', 'ruleta_420', 'manual', 'registro')),
  constraint contactos_enflora_algun_contacto_check check (email is not null or telefono is not null),
  constraint contactos_enflora_email_normalizado_check check (email is null or email = lower(btrim(email))),
  constraint contactos_enflora_telefono_normalizado_check check (telefono is null or telefono ~ '^\+[1-9][0-9]{7,14}$'),
  constraint contactos_enflora_nombre_largo_check check (nombre is null or char_length(nombre) between 1 and 80)
);

create unique index if not exists contactos_enflora_email_unico
  on public.contactos_enflora (email)
  where email is not null;

create unique index if not exists contactos_enflora_telefono_unico
  on public.contactos_enflora (telefono)
  where telefono is not null;

create index if not exists contactos_enflora_created_at_idx
  on public.contactos_enflora (created_at desc);

create index if not exists contactos_enflora_nombre_idx
  on public.contactos_enflora (lower(nombre));

create index if not exists contactos_enflora_origenes_idx
  on public.contactos_enflora using gin (origenes);

create table if not exists public.contactos_origenes (
  id bigint generated always as identity primary key,
  contacto_id uuid not null references public.contactos_enflora (id) on delete cascade,
  origen text not null,
  detalle text,
  veces integer not null default 1,
  primera_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now(),
  constraint contactos_origenes_origen_check check (origen in ('landing', 'ruleta_420', 'manual', 'registro')),
  constraint contactos_origenes_unico unique (contacto_id, origen)
);

create table if not exists public.contactos_consentimientos (
  id bigint generated always as identity primary key,
  contacto_id uuid not null references public.contactos_enflora (id) on delete cascade,
  acepta boolean not null,
  version text,
  origen text not null,
  registrado_en timestamptz not null default now(),
  constraint contactos_consentimientos_origen_check check (origen in ('landing', 'ruleta_420', 'manual', 'registro'))
);

create index if not exists contactos_consentimientos_contacto_idx
  on public.contactos_consentimientos (contacto_id, registrado_en desc);

create or replace function public.contactos_enflora_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists contactos_enflora_touch_trg on public.contactos_enflora;
create trigger contactos_enflora_touch_trg
  before update on public.contactos_enflora
  for each row execute function public.contactos_enflora_touch();

create or replace function public.contactos_origenes_sync()
returns trigger
language plpgsql
as $$
declare
  v_contacto uuid := coalesce(new.contacto_id, old.contacto_id);
begin
  update public.contactos_enflora c
  set origenes = coalesce(
    (
      select array_agg(o.origen order by o.primera_vez)
      from public.contactos_origenes o
      where o.contacto_id = v_contacto
    ),
    '{}'
  )
  where c.id = v_contacto;
  return null;
end;
$$;

drop trigger if exists contactos_origenes_sync_trg on public.contactos_origenes;
create trigger contactos_origenes_sync_trg
  after insert or update or delete on public.contactos_origenes
  for each row execute function public.contactos_origenes_sync();

alter table public.contactos_enflora enable row level security;
alter table public.contactos_origenes enable row level security;
alter table public.contactos_consentimientos enable row level security;

revoke all on table public.contactos_enflora from public, anon, authenticated;
revoke all on table public.contactos_origenes from public, anon, authenticated;
revoke all on table public.contactos_consentimientos from public, anon, authenticated;

grant select, insert, update, delete on table public.contactos_enflora to service_role;
grant select, insert, update, delete on table public.contactos_origenes to service_role;
grant select, insert, update, delete on table public.contactos_consentimientos to service_role;

create or replace function public.registrar_contacto_enflora(
  p_nombre text,
  p_email text,
  p_telefono text,
  p_origen text,
  p_detalle text,
  p_consentimiento boolean,
  p_version text
)
returns table (id_contacto uuid, es_nuevo boolean, consentimiento_cambiado boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_telefono text := nullif(btrim(coalesce(p_telefono, '')), '');
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_id uuid;
  v_nuevo boolean := false;
  v_consentia boolean := false;
  v_cambio boolean := false;
begin
  if p_origen not in ('landing', 'ruleta_420', 'manual', 'registro') then
    raise exception 'origen_invalido';
  end if;
  if v_email is null and v_telefono is null then
    raise exception 'sin_contacto';
  end if;

  perform pg_advisory_xact_lock(hashtext('contactos_enflora:' || coalesce(v_email, v_telefono)));
  if v_email is not null and v_telefono is not null then
    perform pg_advisory_xact_lock(hashtext('contactos_enflora:' || v_telefono));
  end if;

  if v_email is not null then
    select c.id, c.consentimiento_marketing into v_id, v_consentia
    from public.contactos_enflora c
    where c.email = v_email;
  end if;

  if v_id is null and v_telefono is not null then
    select c.id, c.consentimiento_marketing into v_id, v_consentia
    from public.contactos_enflora c
    where c.telefono = v_telefono;
  end if;

  if v_id is null then
    insert into public.contactos_enflora (
      nombre, email, telefono, origen_inicial,
      consentimiento_marketing, consentimiento_fecha, consentimiento_version
    )
    values (
      v_nombre, v_email, v_telefono, p_origen,
      coalesce(p_consentimiento, false),
      case when p_consentimiento then now() end,
      case when p_consentimiento then p_version end
    )
    returning id into v_id;
    v_nuevo := true;
    v_cambio := coalesce(p_consentimiento, false);
  else
    if v_email is not null and exists (
      select 1 from public.contactos_enflora x where x.email = v_email and x.id <> v_id
    ) then
      v_email := null;
    end if;
    if v_telefono is not null and exists (
      select 1 from public.contactos_enflora x where x.telefono = v_telefono and x.id <> v_id
    ) then
      v_telefono := null;
    end if;

    update public.contactos_enflora c
    set
      nombre = coalesce(c.nombre, v_nombre),
      email = coalesce(c.email, v_email),
      telefono = coalesce(c.telefono, v_telefono)
    where c.id = v_id
      and (
        (c.nombre is null and v_nombre is not null)
        or (c.email is null and v_email is not null)
        or (c.telefono is null and v_telefono is not null)
      );

    if coalesce(p_consentimiento, false) and not v_consentia then
      update public.contactos_enflora c
      set
        consentimiento_marketing = true,
        consentimiento_fecha = now(),
        consentimiento_version = p_version
      where c.id = v_id;
      v_cambio := true;
    end if;
  end if;

  if v_cambio then
    insert into public.contactos_consentimientos (contacto_id, acepta, version, origen)
    values (v_id, true, p_version, p_origen);
  end if;

  insert into public.contactos_origenes (contacto_id, origen, detalle)
  values (v_id, p_origen, nullif(btrim(coalesce(p_detalle, '')), ''))
  on conflict (contacto_id, origen) do update
    set veces = public.contactos_origenes.veces + 1,
        ultima_vez = now(),
        detalle = coalesce(excluded.detalle, public.contactos_origenes.detalle);

  return query select v_id, v_nuevo, v_cambio;
end;
$$;

revoke all on function public.registrar_contacto_enflora(text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.registrar_contacto_enflora(text, text, text, text, text, boolean, text) to service_role;

create or replace function public.actualizar_consentimiento_contacto(
  p_contacto uuid,
  p_acepta boolean,
  p_version text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual boolean;
begin
  select c.consentimiento_marketing into v_actual
  from public.contactos_enflora c
  where c.id = p_contacto
  for update;
  if not found then
    return false;
  end if;
  if v_actual = p_acepta then
    return true;
  end if;

  update public.contactos_enflora c
  set
    consentimiento_marketing = p_acepta,
    consentimiento_fecha = now(),
    consentimiento_version = case when p_acepta then p_version else c.consentimiento_version end
  where c.id = p_contacto;

  insert into public.contactos_consentimientos (contacto_id, acepta, version, origen)
  values (p_contacto, p_acepta, p_version, 'manual');
  return true;
end;
$$;

revoke all on function public.actualizar_consentimiento_contacto(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.actualizar_consentimiento_contacto(uuid, boolean, text) to service_role;

create or replace function public.resumen_contactos_enflora()
returns table (
  total bigint,
  landing bigint,
  ruleta bigint,
  con_consentimiento bigint,
  hoy bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*)::bigint as total,
    count(*) filter (where 'landing' = any(origenes))::bigint as landing,
    count(*) filter (where 'ruleta_420' = any(origenes))::bigint as ruleta,
    count(*) filter (where consentimiento_marketing)::bigint as con_consentimiento,
    count(*) filter (
      where created_at >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'
    )::bigint as hoy
  from public.contactos_enflora;
$$;

revoke all on function public.resumen_contactos_enflora() from public, anon, authenticated;
grant execute on function public.resumen_contactos_enflora() to service_role;

alter table public.contactos_enflora drop constraint if exists contactos_enflora_origen_inicial_check;
alter table public.contactos_enflora
  add constraint contactos_enflora_origen_inicial_check
  check (origen_inicial in ('landing', 'ruleta_420', 'manual', 'registro'));

alter table public.contactos_origenes drop constraint if exists contactos_origenes_origen_check;
alter table public.contactos_origenes
  add constraint contactos_origenes_origen_check
  check (origen in ('landing', 'ruleta_420', 'manual', 'registro'));

alter table public.contactos_consentimientos drop constraint if exists contactos_consentimientos_origen_check;
alter table public.contactos_consentimientos
  add constraint contactos_consentimientos_origen_check
  check (origen in ('landing', 'ruleta_420', 'manual', 'registro'));
