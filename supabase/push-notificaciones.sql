create table if not exists public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users (id) on delete set null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  origen text not null,
  plataforma text not null default 'desconocida',
  user_agent text,
  expira_en timestamptz,
  activa boolean not null default true,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  revocada_en timestamptz,
  expirada_en timestamptz,
  ultimo_envio_ok_en timestamptz,
  motivo_baja text,
  constraint push_suscripciones_endpoint_unico unique (endpoint),
  constraint push_suscripciones_origen check (origen in ('landing', 'app')),
  constraint push_suscripciones_plataforma check (plataforma in ('android', 'ios', 'escritorio', 'desconocida')),
  constraint push_suscripciones_endpoint_largo check (char_length(endpoint) between 12 and 2000),
  constraint push_suscripciones_claves check (
    char_length(p256dh) between 16 and 200
    and char_length(auth) between 16 and 200
  )
);

create index if not exists push_suscripciones_activas_idx
  on public.push_suscripciones (activa, creada_en);

create index if not exists push_suscripciones_usuario_idx
  on public.push_suscripciones (usuario_id);

create table if not exists public.push_campanas (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  titulo text not null,
  mensaje text not null,
  url text not null,
  programada_para timestamptz not null,
  zona_horaria text not null default 'America/Argentina/Buenos_Aires',
  habilitada boolean not null default false,
  estado text not null default 'borrador',
  iniciada_en timestamptz,
  finalizada_en timestamptz,
  creada_en timestamptz not null default now(),
  constraint push_campanas_estado check (
    estado in ('borrador', 'programada', 'en_curso', 'completada', 'cancelada', 'error')
  ),
  constraint push_campanas_zona check (zona_horaria = 'America/Argentina/Buenos_Aires'),
  constraint push_campanas_titulo check (char_length(btrim(titulo)) between 1 and 120),
  constraint push_campanas_mensaje check (char_length(btrim(mensaje)) between 1 and 280),
  constraint push_campanas_url check (char_length(url) between 1 and 500)
);

create table if not exists public.push_envios (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid references public.push_campanas (id) on delete cascade,
  suscripcion_id uuid not null references public.push_suscripciones (id) on delete cascade,
  tipo text not null default 'campana',
  clave_idempotencia text not null unique,
  estado text not null,
  codigo_estado integer,
  error text,
  intentos integer not null default 0,
  recibido_en timestamptz,
  recibo_hash text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint push_envios_tipo check (tipo in ('campana', 'prueba')),
  constraint push_envios_estado check (
    estado in ('pendiente', 'enviando', 'aceptado', 'error', 'omitido', 'expirado')
  ),
  constraint push_envios_intentos check (intentos >= 0 and intentos <= 10),
  constraint push_envios_campana check (
    (tipo = 'campana' and campana_id is not null)
    or (tipo = 'prueba' and campana_id is null)
  )
);

create index if not exists push_envios_campana_idx
  on public.push_envios (campana_id, estado);

create index if not exists push_envios_suscripcion_idx
  on public.push_envios (suscripcion_id);

create table if not exists public.push_limites (
  id bigint generated always as identity primary key,
  clave text not null,
  creada_en timestamptz not null default now()
);

create index if not exists push_limites_clave_idx
  on public.push_limites (clave, creada_en);

alter table public.push_suscripciones enable row level security;
alter table public.push_campanas enable row level security;
alter table public.push_envios enable row level security;
alter table public.push_limites enable row level security;

revoke all on public.push_suscripciones from anon, authenticated;
revoke all on public.push_campanas from anon, authenticated;
revoke all on public.push_envios from anon, authenticated;
revoke all on public.push_limites from anon, authenticated;

grant select, insert, update, delete on public.push_suscripciones to service_role;
grant select, insert, update, delete on public.push_campanas to service_role;
grant select, insert, update, delete on public.push_envios to service_role;
grant select, insert, update, delete on public.push_limites to service_role;

create or replace function public.push_lote_pendiente(p_campana uuid, p_limite integer)
returns setof public.push_suscripciones
language sql
stable
security invoker
set search_path = public
as $$
  select s.*
  from public.push_suscripciones s
  where s.activa = true
    and not exists (
      select 1
      from public.push_envios e
      where e.campana_id = p_campana
        and e.suscripcion_id = s.id
        and (
          e.estado in ('aceptado', 'omitido', 'enviando', 'expirado')
          or (e.estado = 'error' and e.intentos >= 3)
        )
    )
  order by s.creada_en
  limit greatest(1, least(coalesce(p_limite, 80), 100));
$$;

create or replace function public.push_reclamar_envio(
  p_campana uuid,
  p_suscripcion uuid,
  p_clave text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.push_envios (
    campana_id,
    suscripcion_id,
    tipo,
    clave_idempotencia,
    estado,
    intentos
  )
  values (p_campana, p_suscripcion, 'campana', p_clave, 'enviando', 1)
  on conflict (clave_idempotencia) do update
    set estado = 'enviando',
        intentos = public.push_envios.intentos + 1,
        actualizado_en = now()
    where public.push_envios.estado in ('pendiente', 'error')
      and public.push_envios.intentos < 3
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.push_lote_pendiente(uuid, integer) from public, anon, authenticated;
revoke all on function public.push_reclamar_envio(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.push_lote_pendiente(uuid, integer) to service_role;
grant execute on function public.push_reclamar_envio(uuid, uuid, text) to service_role;

insert into public.push_campanas (
  clave,
  titulo,
  mensaje,
  url,
  programada_para,
  zona_horaria,
  habilitada,
  estado
)
values (
  'lanzamiento-2026-11',
  '¡Enflora ya está disponible!',
  'Flora te estaba esperando. Entrá y empezá a registrar tus cultivos.',
  'https://enflora.com.ar/',
  timestamptz '2026-11-01 09:00:00-03',
  'America/Argentina/Buenos_Aires',
  false,
  'borrador'
)
on conflict (clave) do nothing;
