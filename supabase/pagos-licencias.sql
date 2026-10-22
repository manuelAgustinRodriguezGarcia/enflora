do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pagos'
      and column_name = 'unidad_cultivo_id'
  ) then
    raise exception 'pagos ya tiene unidad_cultivo_id. Esta migración no convierte esa versión y no borra datos.';
  end if;
end $$;

create table if not exists public.ciclos_cultivo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete restrict,
  unidad_ancla_id uuid not null references public.unidades_cultivo (id) on delete restrict,
  nombre text not null,
  estado text not null default 'activo',
  iniciado_en timestamptz not null default now(),
  finalizado_en timestamptz,
  constraint ciclos_cultivo_nombre check (char_length(btrim(nombre)) between 1 and 80),
  constraint ciclos_cultivo_estado check (estado in ('activo', 'finalizado')),
  constraint ciclos_cultivo_cierre check (
    (estado = 'activo' and finalizado_en is null)
    or (estado = 'finalizado' and finalizado_en is not null)
  )
);

create index if not exists ciclos_cultivo_usuario_id_idx on public.ciclos_cultivo (usuario_id);
create index if not exists ciclos_cultivo_unidad_ancla_id_idx on public.ciclos_cultivo (unidad_ancla_id);

create or replace function public.ciclos_cultivo_bloquear_identidad()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.usuario_id is distinct from old.usuario_id
     or new.unidad_ancla_id is distinct from old.unidad_ancla_id
     or new.iniciado_en is distinct from old.iniciado_en then
    raise exception 'identidad_ciclo';
  end if;
  if old.estado = 'finalizado' and new.estado is distinct from old.estado then
    raise exception 'ciclo_cerrado';
  end if;
  if new.estado = 'finalizado' and new.finalizado_en is null then
    new.finalizado_en := now();
  end if;
  if new.estado = 'activo' and new.finalizado_en is not null then
    raise exception 'ciclo_abierto_con_cierre';
  end if;
  return new;
end;
$$;

drop trigger if exists ciclos_cultivo_bloquear_identidad on public.ciclos_cultivo;
create trigger ciclos_cultivo_bloquear_identidad
before update on public.ciclos_cultivo
for each row execute function public.ciclos_cultivo_bloquear_identidad();

create table if not exists public.pagos (
  id uuid primary key,
  usuario_id uuid not null references auth.users (id) on delete restrict,
  ciclo_cultivo_id uuid not null references public.ciclos_cultivo (id) on delete restrict,
  proveedor text not null default 'mercadopago',
  ambiente text not null,
  tipo text not null default 'licencia_cultivo',
  precio_usd numeric(12,2) not null,
  importe_ars numeric(14,2) not null,
  cotizacion_valor numeric(16,4) not null,
  cotizacion_fuente text not null,
  cotizacion_publicada_en timestamptz not null,
  cotizacion_tipo text not null,
  order_id text,
  external_reference text not null unique,
  checkout_url text,
  estado text not null default 'creada',
  mp_estado text,
  mp_estado_detalle text,
  vendedor_mp text,
  moneda text not null default 'ARS',
  acreditado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  operacion_mp text,
  constraint pagos_ambiente_valido check (ambiente in ('prueba', 'produccion')),
  constraint pagos_tipo_valido check (tipo = 'licencia_cultivo'),
  constraint pagos_precio_usd check (precio_usd = 30.00),
  constraint pagos_importe_positivo check (importe_ars > 0),
  constraint pagos_cotizacion_positiva check (cotizacion_valor > 0),
  constraint pagos_cotizacion_tipo check (cotizacion_tipo = 'billete_vendedor'),
  constraint pagos_moneda check (moneda = 'ARS'),
  constraint pagos_estado_valido check (
    estado in ('creada', 'pendiente', 'acreditado', 'rechazado', 'cancelado', 'reembolsado', 'contracargo')
  ),
  constraint pagos_proveedor check (proveedor = 'mercadopago')
);

alter table public.pagos add column if not exists operacion_mp text;

create index if not exists pagos_usuario_id_idx on public.pagos (usuario_id);
create index if not exists pagos_ciclo_cultivo_id_idx on public.pagos (ciclo_cultivo_id);
create unique index if not exists pagos_ciclo_abierto_unico
  on public.pagos (ciclo_cultivo_id, ambiente)
  where estado in ('creada', 'pendiente');
create unique index if not exists pagos_order_id_unico
  on public.pagos (order_id)
  where order_id is not null;

create table if not exists public.licencias_cultivo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete restrict,
  ciclo_cultivo_id uuid not null references public.ciclos_cultivo (id) on delete restrict,
  pago_id uuid not null unique references public.pagos (id) on delete restrict,
  estado text not null,
  activada_en timestamptz not null default now(),
  revocada_en timestamptz,
  constraint licencias_estado_valido check (estado in ('activa', 'revocada')),
  constraint licencias_revocacion check (
    (estado = 'activa' and revocada_en is null)
    or (estado = 'revocada' and revocada_en is not null)
  )
);

create unique index if not exists licencias_cultivo_activa_unica
  on public.licencias_cultivo (ciclo_cultivo_id)
  where estado = 'activa';

create table if not exists public.pagos_notificaciones (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  pago_id uuid references public.pagos (id) on delete restrict,
  aplicada boolean not null default false,
  creada_en timestamptz not null default now()
);

alter table public.ciclos_cultivo enable row level security;
alter table public.pagos enable row level security;
alter table public.licencias_cultivo enable row level security;
alter table public.pagos_notificaciones enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ciclos_cultivo' and policyname = 'usuario_lee_sus_ciclos'
  ) then
    create policy usuario_lee_sus_ciclos
    on public.ciclos_cultivo
    for select
    to authenticated
    using (auth.uid() = usuario_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pagos' and policyname = 'usuario_lee_sus_pagos'
  ) then
    create policy usuario_lee_sus_pagos
    on public.pagos
    for select
    to authenticated
    using (auth.uid() = usuario_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'licencias_cultivo' and policyname = 'usuario_lee_sus_licencias'
  ) then
    create policy usuario_lee_sus_licencias
    on public.licencias_cultivo
    for select
    to authenticated
    using (auth.uid() = usuario_id);
  end if;
end $$;

revoke all on public.ciclos_cultivo from anon, authenticated;
revoke all on public.pagos from anon, authenticated;
revoke all on public.licencias_cultivo from anon, authenticated;
revoke all on public.pagos_notificaciones from anon, authenticated;
grant select on public.ciclos_cultivo to authenticated;
grant select on public.pagos to authenticated;
grant select on public.licencias_cultivo to authenticated;
grant select, insert, update, delete on public.ciclos_cultivo to service_role;
grant select, insert, update, delete on public.pagos to service_role;
grant select, insert, update, delete on public.licencias_cultivo to service_role;
grant select, insert, update, delete on public.pagos_notificaciones to service_role;

create or replace function public.estado_pago_siguiente(actual text, propuesto text)
returns text
language sql
immutable
as $$
  select case
    when actual is not distinct from propuesto then actual
    when actual in ('reembolsado', 'contracargo') then actual
    when actual = 'acreditado' and propuesto not in ('reembolsado', 'contracargo') then actual
    else propuesto
  end
$$;

create or replace function public.reservar_pago_cultivo(
  p_usuario uuid,
  p_ciclo uuid,
  p_unidad uuid,
  p_nombre text,
  p_ambiente text,
  p_importe numeric,
  p_cotizacion numeric,
  p_fuente text,
  p_publicada timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dueno uuid;
  v_ancla uuid;
  v_ciclo public.ciclos_cultivo%rowtype;
  v_pago public.pagos%rowtype;
  v_id uuid;
  v_nombre text;
begin
  if p_ambiente not in ('prueba', 'produccion') or p_importe <= 0 or p_cotizacion <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos');
  end if;

  if p_ciclo is not null then
    select * into v_ciclo
    from public.ciclos_cultivo
    where id = p_ciclo
    for update;
    if not found or v_ciclo.usuario_id <> p_usuario then
      return jsonb_build_object('ok', false, 'codigo', 'cultivo_ajeno');
    end if;
    if v_ciclo.estado <> 'activo' then
      return jsonb_build_object('ok', false, 'codigo', 'ciclo_finalizado');
    end if;
    if exists (
      select 1 from public.licencias_cultivo
      where ciclo_cultivo_id = v_ciclo.id and estado = 'activa'
    ) then
      return jsonb_build_object('ok', false, 'codigo', 'licencia_activa');
    end if;
    v_ancla := v_ciclo.unidad_ancla_id;
  else
    v_nombre := btrim(coalesce(p_nombre, ''));
    if p_unidad is null or char_length(v_nombre) < 1 or char_length(v_nombre) > 80 then
      return jsonb_build_object('ok', false, 'codigo', 'nombre');
    end if;
    v_ancla := p_unidad;
  end if;

  select e.usuario_id into v_dueno
  from public.unidades_cultivo u
  join public.espacios e on e.id = u.espacio_id
  where u.id = v_ancla
  for update of u;

  if v_dueno is null or v_dueno <> p_usuario then
    return jsonb_build_object('ok', false, 'codigo', 'cultivo_ajeno');
  end if;

  if p_ciclo is null then
    insert into public.ciclos_cultivo (usuario_id, unidad_ancla_id, nombre)
    values (p_usuario, p_unidad, v_nombre)
    returning * into v_ciclo;
  end if;

  select * into v_pago
  from public.pagos
  where ciclo_cultivo_id = v_ciclo.id
    and usuario_id = p_usuario
    and ambiente = p_ambiente
    and estado in ('creada', 'pendiente')
  for update;

  if found then
    if v_pago.order_id is null then
      update public.pagos
      set importe_ars = p_importe,
          cotizacion_valor = p_cotizacion,
          cotizacion_fuente = p_fuente,
          cotizacion_publicada_en = p_publicada,
          actualizado_en = now()
      where id = v_pago.id
      returning * into v_pago;
    end if;
  else
    v_id := gen_random_uuid();
    begin
      insert into public.pagos (
        id, usuario_id, ciclo_cultivo_id, ambiente, precio_usd, importe_ars,
        cotizacion_valor, cotizacion_fuente, cotizacion_publicada_en, cotizacion_tipo,
        external_reference
      ) values (
        v_id, p_usuario, v_ciclo.id, p_ambiente, 30.00, p_importe,
        p_cotizacion, p_fuente, p_publicada, 'billete_vendedor', v_id::text
      )
      returning * into v_pago;
    exception
      when unique_violation then
        select * into v_pago
        from public.pagos
        where ciclo_cultivo_id = v_ciclo.id
          and usuario_id = p_usuario
          and ambiente = p_ambiente
          and estado in ('creada', 'pendiente')
        for update;
        if not found then
          return jsonb_build_object('ok', false, 'codigo', 'pago_en_curso');
        end if;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'reutilizado', v_pago.order_id is not null,
    'ciclo', jsonb_build_object('id', v_ciclo.id, 'nombre', v_ciclo.nombre, 'estado', v_ciclo.estado),
    'pago', jsonb_build_object(
      'id', v_pago.id,
      'estado', v_pago.estado,
      'order_id', v_pago.order_id,
      'checkout_url', v_pago.checkout_url,
      'importe_ars', v_pago.importe_ars,
      'vendedor_mp', v_pago.vendedor_mp,
      'ambiente', v_pago.ambiente,
      'ciclo_cultivo_id', v_pago.ciclo_cultivo_id
    )
  );
end;
$$;

create or replace function public.finalizar_ciclo_cultivo(p_ciclo uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ciclo public.ciclos_cultivo%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'codigo', 'cultivo_ajeno');
  end if;

  select * into v_ciclo
  from public.ciclos_cultivo
  where id = p_ciclo
  for update;

  if not found or v_ciclo.usuario_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'codigo', 'cultivo_ajeno');
  end if;

  if v_ciclo.estado = 'finalizado' then
    return jsonb_build_object('ok', true, 'estado', 'finalizado');
  end if;

  update public.ciclos_cultivo
  set estado = 'finalizado',
      finalizado_en = coalesce(finalizado_en, now())
  where id = v_ciclo.id;

  return jsonb_build_object('ok', true, 'estado', 'finalizado');
end;
$$;

create or replace function public.guardar_checkout_pago(
  p_pago_id uuid,
  p_usuario uuid,
  p_order_id text,
  p_checkout_url text,
  p_vendedor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago public.pagos%rowtype;
begin
  select * into v_pago from public.pagos where id = p_pago_id for update;
  if not found or v_pago.usuario_id <> p_usuario then
    return jsonb_build_object('ok', false, 'codigo', 'pago_ajeno');
  end if;
  if v_pago.estado not in ('creada', 'pendiente') then
    return jsonb_build_object('ok', false, 'codigo', 'pago_cerrado');
  end if;
  if v_pago.order_id is not null and v_pago.order_id is distinct from p_order_id then
    return jsonb_build_object('ok', false, 'codigo', 'orden_distinta');
  end if;

  update public.pagos
  set order_id = coalesce(v_pago.order_id, p_order_id),
      checkout_url = coalesce(nullif(p_checkout_url, ''), v_pago.checkout_url),
      vendedor_mp = coalesce(v_pago.vendedor_mp, nullif(p_vendedor, '')),
      estado = case when v_pago.estado = 'creada' then 'pendiente' else v_pago.estado end,
      actualizado_en = now()
  where id = v_pago.id
  returning * into v_pago;

  return jsonb_build_object('ok', true, 'checkout_url', v_pago.checkout_url, 'estado', v_pago.estado);
end;
$$;

create or replace function public.aplicar_resultado_pago(
  p_pago_id uuid,
  p_estado text,
  p_mp_estado text,
  p_mp_detalle text,
  p_importe text,
  p_moneda text,
  p_vendedor text,
  p_order_id text,
  p_referencia text,
  p_clave text,
  p_consistente boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago public.pagos%rowtype;
  v_aplicada boolean;
  v_estado text;
  v_importe numeric;
  v_dueno uuid;
begin
  if p_clave is not null then
    insert into public.pagos_notificaciones (clave, pago_id)
    values (p_clave, p_pago_id)
    on conflict (clave) do nothing;
    select aplicada into v_aplicada
    from public.pagos_notificaciones
    where clave = p_clave
    for update;
    if v_aplicada then
      return jsonb_build_object('ok', true, 'duplicada', true);
    end if;
  end if;

  select * into v_pago from public.pagos where id = p_pago_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'pago_inexistente');
  end if;
  if p_referencia is not null and p_referencia is distinct from v_pago.external_reference then
    return jsonb_build_object('ok', false, 'codigo', 'referencia');
  end if;
  if v_pago.order_id is not null and p_order_id is not null and v_pago.order_id is distinct from p_order_id then
    return jsonb_build_object('ok', false, 'codigo', 'orden_distinta');
  end if;
  if p_moneda is not null and p_moneda is distinct from 'ARS' then
    return jsonb_build_object('ok', false, 'codigo', 'moneda');
  end if;
  if v_pago.vendedor_mp is not null and p_vendedor is not null and v_pago.vendedor_mp is distinct from p_vendedor then
    return jsonb_build_object('ok', false, 'codigo', 'vendedor');
  end if;

  if p_importe is not null then
    v_importe := p_importe::numeric;
    if v_importe is distinct from v_pago.importe_ars then
      update public.pagos
      set mp_estado = p_mp_estado,
          mp_estado_detalle = 'importe_no_coincide',
          actualizado_en = now()
      where id = v_pago.id;
      if p_clave is not null then
        update public.pagos_notificaciones set aplicada = true, pago_id = v_pago.id where clave = p_clave;
      end if;
      return jsonb_build_object('ok', false, 'codigo', 'importe');
    end if;
  end if;

  if not p_consistente then
    update public.pagos
    set mp_estado = p_mp_estado,
        mp_estado_detalle = coalesce(p_mp_detalle, mp_estado_detalle),
        actualizado_en = now()
    where id = v_pago.id;
    if p_clave is not null then
      update public.pagos_notificaciones set aplicada = true, pago_id = v_pago.id where clave = p_clave;
    end if;
    return jsonb_build_object('ok', false, 'codigo', coalesce(p_mp_detalle, 'inconsistente'));
  end if;

  if p_estado not in ('creada', 'pendiente', 'acreditado', 'rechazado', 'cancelado', 'reembolsado', 'contracargo') then
    return jsonb_build_object('ok', false, 'codigo', 'estado_invalido');
  end if;

  v_estado := public.estado_pago_siguiente(v_pago.estado, p_estado);

  if v_estado = 'acreditado' and v_pago.estado is distinct from 'acreditado' then
    select usuario_id into v_dueno
    from public.ciclos_cultivo
    where id = v_pago.ciclo_cultivo_id
    for update;
    if v_dueno is distinct from v_pago.usuario_id then
      raise exception 'ciclo_ajeno';
    end if;
  end if;

  update public.pagos
  set estado = v_estado,
      mp_estado = p_mp_estado,
      mp_estado_detalle = p_mp_detalle,
      order_id = coalesce(v_pago.order_id, p_order_id),
      vendedor_mp = coalesce(v_pago.vendedor_mp, nullif(p_vendedor, '')),
      acreditado_en = case
        when v_estado = 'acreditado' then coalesce(v_pago.acreditado_en, now())
        else v_pago.acreditado_en
      end,
      actualizado_en = now()
  where id = v_pago.id;

  if v_estado = 'acreditado' then
    begin
      insert into public.licencias_cultivo (usuario_id, ciclo_cultivo_id, pago_id, estado)
      values (v_pago.usuario_id, v_pago.ciclo_cultivo_id, v_pago.id, 'activa')
      on conflict (pago_id) do nothing;
    exception
      when unique_violation then
        null;
    end;
  end if;

  if v_estado in ('reembolsado', 'contracargo') then
    update public.licencias_cultivo
    set estado = 'revocada',
        revocada_en = coalesce(revocada_en, now())
    where pago_id = v_pago.id
      and estado = 'activa';
  end if;

  if p_clave is not null then
    update public.pagos_notificaciones set aplicada = true, pago_id = v_pago.id where clave = p_clave;
  end if;

  return jsonb_build_object('ok', true, 'duplicada', false, 'estado', v_estado, 'ciclo_cultivo_id', v_pago.ciclo_cultivo_id);
end;
$$;

create or replace function public.licencia_habilita_ciclo(p_ciclo uuid, p_ambiente text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.licencias_cultivo licencia
    join public.pagos pago on pago.id = licencia.pago_id
    where licencia.ciclo_cultivo_id = p_ciclo
      and licencia.usuario_id = auth.uid()
      and licencia.estado = 'activa'
      and pago.usuario_id = auth.uid()
      and pago.ciclo_cultivo_id = licencia.ciclo_cultivo_id
      and pago.estado = 'acreditado'
      and pago.ambiente = p_ambiente
      and p_ambiente in ('prueba', 'produccion')
  );
$$;

drop function if exists public.reservar_pago_cultivo(uuid, uuid, text, numeric, numeric, text, timestamptz);

revoke all on function public.ciclos_cultivo_bloquear_identidad() from public, anon, authenticated;
revoke all on function public.reservar_pago_cultivo(uuid, uuid, uuid, text, text, numeric, numeric, text, timestamptz) from public, anon, authenticated;
revoke all on function public.finalizar_ciclo_cultivo(uuid) from public, anon, authenticated;
revoke all on function public.guardar_checkout_pago(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.aplicar_resultado_pago(uuid, text, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.estado_pago_siguiente(text, text) from public, anon, authenticated;
revoke all on function public.licencia_habilita_ciclo(uuid, text) from public, anon;

grant execute on function public.reservar_pago_cultivo(uuid, uuid, uuid, text, text, numeric, numeric, text, timestamptz) to service_role;
grant execute on function public.finalizar_ciclo_cultivo(uuid) to authenticated;
grant execute on function public.guardar_checkout_pago(uuid, uuid, text, text, text) to service_role;
grant execute on function public.aplicar_resultado_pago(uuid, text, text, text, text, text, text, text, text, text, boolean) to service_role;
grant execute on function public.estado_pago_siguiente(text, text) to service_role;
grant execute on function public.licencia_habilita_ciclo(uuid, text) to authenticated;
