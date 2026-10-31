-- Plus (PLAN 420) — Mercado Pago PreApproval / pagos recurrentes.
-- NO ejecutar automáticamente. Iteración 1: esquema + RLS + RPC reservadas.
-- No reutiliza licencias_cultivo (pago único por ciclo).

create table if not exists public.plus_suscripciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete restrict,
  ambiente text not null,
  proveedor text not null default 'mercadopago',
  preapproval_id text,
  external_reference text not null,
  estado_interno text not null default 'borrador',
  estado_mp text,
  precio_usd numeric(12, 2) not null default 4.20,
  importe_ars numeric(14, 2),
  cotizacion_valor numeric(16, 4),
  cotizacion_fuente text,
  cotizacion_publicada_en timestamptz,
  cotizacion_tipo text,
  init_point text,
  back_url text,
  periodo_vigente_desde timestamptz,
  periodo_vigente_hasta timestamptz,
  proxima_renovacion timestamptz,
  cancelada_en timestamptz,
  vigente_hasta_fin_periodo boolean not null default false,
  creada_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint plus_suscripciones_ambiente check (ambiente in ('prueba', 'produccion')),
  constraint plus_suscripciones_estado_interno check (
    estado_interno in (
      'borrador',
      'pendiente_checkout',
      'activa',
      'pausada',
      'cancelada',
      'vencida',
      'past_due'
    )
  ),
  constraint plus_suscripciones_precio_usd check (precio_usd = 4.20),
  constraint plus_suscripciones_cancelacion check (
    (estado_interno <> 'cancelada' and cancelada_en is null)
    or (estado_interno = 'cancelada' and cancelada_en is not null)
  )
);

create unique index if not exists plus_suscripciones_external_ref_unica
  on public.plus_suscripciones (external_reference);

create unique index if not exists plus_suscripciones_preapproval_unico
  on public.plus_suscripciones (preapproval_id)
  where preapproval_id is not null;

create unique index if not exists plus_suscripciones_activa_por_usuario_ambiente
  on public.plus_suscripciones (usuario_id, ambiente)
  where estado_interno in ('borrador', 'pendiente_checkout', 'activa', 'pausada', 'past_due');

create index if not exists plus_suscripciones_usuario_idx
  on public.plus_suscripciones (usuario_id);

create index if not exists plus_suscripciones_proxima_renovacion_idx
  on public.plus_suscripciones (proxima_renovacion)
  where estado_interno = 'activa';

create table if not exists public.plus_pagos_recurrentes (
  id uuid primary key default gen_random_uuid(),
  suscripcion_id uuid not null references public.plus_suscripciones (id) on delete restrict,
  usuario_id uuid not null references auth.users (id) on delete restrict,
  ambiente text not null,
  authorized_payment_id text,
  payment_id text,
  estado_mp text,
  estado_interno text not null default 'pendiente',
  importe_ars numeric(14, 2) not null,
  importe_cobrado_ars numeric(14, 2),
  cotizacion_valor numeric(16, 4),
  cotizacion_fuente text,
  cotizacion_publicada_en timestamptz,
  periodo_desde timestamptz,
  periodo_hasta timestamptz,
  acreditado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint plus_pagos_ambiente check (ambiente in ('prueba', 'produccion')),
  constraint plus_pagos_estado_interno check (
    estado_interno in ('pendiente', 'acreditado', 'rechazado', 'reembolsado', 'contracargo')
  )
);

create unique index if not exists plus_pagos_authorized_payment_unico
  on public.plus_pagos_recurrentes (authorized_payment_id)
  where authorized_payment_id is not null;

create index if not exists plus_pagos_suscripcion_idx
  on public.plus_pagos_recurrentes (suscripcion_id, creado_en desc);

create table if not exists public.plus_notificaciones (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  tipo text not null,
  recurso_id text not null,
  suscripcion_id uuid references public.plus_suscripciones (id) on delete set null,
  aplicada boolean not null default false,
  creada_en timestamptz not null default now()
);

create table if not exists public.plus_cotizacion_auditoria (
  id uuid primary key default gen_random_uuid(),
  suscripcion_id uuid not null references public.plus_suscripciones (id) on delete restrict,
  operacion text not null,
  importe_ars_anterior numeric(14, 2),
  importe_ars_nuevo numeric(14, 2),
  cotizacion_valor numeric(16, 4),
  cotizacion_fuente text,
  cotizacion_publicada_en timestamptz,
  preapproval_put_ok boolean,
  detalle text,
  creada_en timestamptz not null default now(),
  constraint plus_cotizacion_operacion check (
    operacion in ('alta', 'actualizacion_pre_renovacion', 'cobro', 'ajuste_manual')
  )
);

alter table public.plus_suscripciones enable row level security;
alter table public.plus_pagos_recurrentes enable row level security;
alter table public.plus_notificaciones enable row level security;
alter table public.plus_cotizacion_auditoria enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'plus_suscripciones' and policyname = 'usuario_lee_su_plus'
  ) then
    create policy usuario_lee_su_plus on public.plus_suscripciones
      for select to authenticated
      using (usuario_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'plus_pagos_recurrentes' and policyname = 'usuario_lee_sus_pagos_plus'
  ) then
    create policy usuario_lee_sus_pagos_plus on public.plus_pagos_recurrentes
      for select to authenticated
      using (usuario_id = auth.uid());
  end if;
end $$;

revoke all on public.plus_suscripciones from anon, authenticated;
revoke all on public.plus_pagos_recurrentes from anon, authenticated;
revoke all on public.plus_notificaciones from anon, authenticated;
revoke all on public.plus_cotizacion_auditoria from anon, authenticated;

grant select on public.plus_suscripciones to authenticated;
grant select on public.plus_pagos_recurrentes to authenticated;

grant select, insert, update, delete on public.plus_suscripciones to service_role;
grant select, insert, update, delete on public.plus_pagos_recurrentes to service_role;
grant select, insert, update, delete on public.plus_notificaciones to service_role;
grant select, insert, update, delete on public.plus_cotizacion_auditoria to service_role;

-- Iteración 2: RPC idempotente aplicar_resultado_plus_preapproval / aplicar_pago_recurrente_plus
