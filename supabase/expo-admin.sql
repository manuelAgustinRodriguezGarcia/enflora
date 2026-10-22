create table if not exists public.expo_inventario (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  stock_total integer,
  entregados integer not null default 0,
  updated_at timestamptz
);

create table if not exists public.expo_participantes (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null unique,
  created_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  partidas_iniciadas integer not null default 1
);

alter table public.expo_inventario drop constraint if exists expo_inventario_slug_valido;
alter table public.expo_inventario drop constraint if exists expo_inventario_nombre_no_vacio;
alter table public.expo_inventario drop constraint if exists expo_inventario_stock_no_negativo;
alter table public.expo_inventario drop constraint if exists expo_inventario_entregados_no_negativo;
alter table public.expo_inventario drop constraint if exists expo_inventario_entregados_dentro_stock;

alter table public.expo_inventario
add constraint expo_inventario_slug_valido
check (slug in ('stickers', 'filtros', 'folletos', 'tuqueros', 'picadores'));

alter table public.expo_inventario
add constraint expo_inventario_nombre_no_vacio
check (char_length(btrim(nombre)) > 0);

alter table public.expo_inventario
add constraint expo_inventario_stock_no_negativo
check (stock_total is null or stock_total >= 0);

alter table public.expo_inventario
add constraint expo_inventario_entregados_no_negativo
check (entregados >= 0);

alter table public.expo_inventario
add constraint expo_inventario_entregados_dentro_stock
check (stock_total is null or entregados <= stock_total);

alter table public.expo_inventario
add column if not exists reservados integer not null default 0;

alter table public.expo_inventario drop constraint if exists expo_inventario_reservados_no_negativo;
alter table public.expo_inventario drop constraint if exists expo_inventario_reservados_dentro_stock;

alter table public.expo_inventario
add constraint expo_inventario_reservados_no_negativo
check (reservados >= 0);

alter table public.expo_inventario
add constraint expo_inventario_reservados_dentro_stock
check (stock_total is null or entregados + reservados <= stock_total);

alter table public.expo_participantes drop constraint if exists expo_participantes_partidas_positivas;

alter table public.expo_participantes
add constraint expo_participantes_partidas_positivas
check (partidas_iniciadas > 0);

alter table public.expo_inventario enable row level security;
alter table public.expo_participantes enable row level security;

revoke all on table public.expo_inventario from public, anon, authenticated, service_role;
revoke all on table public.expo_participantes from public, anon, authenticated, service_role;
grant select on table public.expo_inventario to service_role;

insert into public.expo_inventario (slug, nombre)
values
  ('stickers', 'Stickers'),
  ('filtros', 'Filtros'),
  ('folletos', 'Folletos'),
  ('tuqueros', 'Tuqueros'),
  ('picadores', 'Picadores')
on conflict (slug) do nothing;

create or replace function public.registrar_entrega_expo(p_slug text, p_delta integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.expo_inventario%rowtype;
begin
  if p_delta is null or p_delta not in (-1, 1, 2, 3) then
    raise exception 'La cantidad no es válida.';
  end if;

  select *
  into fila
  from public.expo_inventario
  where slug = p_slug
  for update;

  if not found then
    raise exception 'No se encontró el producto.';
  end if;

  if fila.stock_total is null then
    raise exception 'Inventario sin configurar.';
  end if;

  if fila.entregados + p_delta < 0 then
    raise exception 'No se puede descontar esa cantidad.';
  end if;

  if fila.entregados + p_delta > fila.stock_total then
    raise exception 'No hay stock suficiente.';
  end if;

  update public.expo_inventario
  set
    entregados = entregados + p_delta,
    reservados = case
      when p_delta > 0 then greatest(0, reservados - least(reservados, p_delta))
      else reservados
    end,
    updated_at = now()
  where id = fila.id
  returning * into fila;

  return jsonb_build_object(
    'slug', fila.slug,
    'nombre', fila.nombre,
    'stock_total', fila.stock_total,
    'entregados', fila.entregados,
    'reservados', fila.reservados,
    'updated_at', fila.updated_at
  );
end;
$$;

create or replace function public.guardar_inventario_expo(
  p_slug text,
  p_stock integer,
  p_entregados integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.expo_inventario%rowtype;
begin
  if p_stock is null or p_stock < 0 or p_entregados is null or p_entregados < 0 then
    raise exception 'Las cantidades no son válidas.';
  end if;

  if p_entregados > p_stock then
    raise exception 'Las entregas no pueden superar el stock.';
  end if;

  select *
  into fila
  from public.expo_inventario
  where slug = p_slug
  for update;

  if not found then
    raise exception 'No se encontró el producto.';
  end if;

  if p_entregados + fila.reservados > p_stock then
    raise exception 'El stock no alcanza para las reservas pendientes.';
  end if;

  update public.expo_inventario
  set
    stock_total = p_stock,
    entregados = p_entregados,
    updated_at = now()
  where id = fila.id
  returning * into fila;

  return jsonb_build_object(
    'slug', fila.slug,
    'nombre', fila.nombre,
    'stock_total', fila.stock_total,
    'entregados', fila.entregados,
    'reservados', fila.reservados,
    'updated_at', fila.updated_at
  );
end;
$$;

create or replace function public.registrar_partida_expo(p_visitor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor is null then
    raise exception 'El visitante no es válido.';
  end if;

  insert into public.expo_participantes (visitor_id)
  values (p_visitor)
  on conflict (visitor_id) do update
  set
    partidas_iniciadas = public.expo_participantes.partidas_iniciadas + 1,
    last_played_at = now();
end;
$$;

create or replace function public.resumen_participantes_expo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'participantes', count(*),
    'partidas', coalesce(sum(partidas_iniciadas), 0)
  )
  from public.expo_participantes;
$$;

revoke all on function public.registrar_entrega_expo(text, integer) from public, anon, authenticated;
revoke all on function public.guardar_inventario_expo(text, integer, integer) from public, anon, authenticated;
revoke all on function public.registrar_partida_expo(uuid) from public, anon, authenticated;
revoke all on function public.resumen_participantes_expo() from public, anon, authenticated;

grant execute on function public.registrar_entrega_expo(text, integer) to service_role;
grant execute on function public.guardar_inventario_expo(text, integer, integer) to service_role;
grant execute on function public.registrar_partida_expo(uuid) to service_role;
grant execute on function public.resumen_participantes_expo() to service_role;

create table if not exists public.expo_ruleta_estado (
  id integer primary key,
  giros integer not null default 0,
  ultimo_resultado text,
  constraint expo_ruleta_estado_unica check (id = 1),
  constraint expo_ruleta_estado_giros_no_negativos check (giros >= 0),
  constraint expo_ruleta_estado_ultimo_valido check (
    ultimo_resultado is null
    or ultimo_resultado in ('SAFE_PACK', 'GRINDER', 'TUBE', 'BONUS_PACK', 'CONSOLATION')
  )
);

insert into public.expo_ruleta_estado (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.expo_ruleta_partidas (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  estado text not null default 'jugando',
  vidas integer not null default 2,
  aciertos integer not null default 0,
  ronda integer not null default 0,
  ronda_especial integer not null,
  usadas text[] not null default '{}',
  excluidas text[] not null default '{}',
  pregunta_id text,
  categoria_id text,
  correct_index integer,
  pregunta_respondida boolean not null default true,
  respuesta_indice integer,
  acerto boolean,
  resultado text,
  cantidades jsonb,
  elegibles jsonb,
  giro integer,
  constraint expo_ruleta_partidas_estado_valido check (estado in ('jugando', 'ganada', 'perdida', 'resuelta')),
  constraint expo_ruleta_partidas_ronda_especial check (ronda_especial between 1 and 5),
  constraint expo_ruleta_partidas_vidas check (vidas >= 0 and vidas <= 2),
  constraint expo_ruleta_partidas_aciertos check (aciertos >= 0 and aciertos <= 5),
  constraint expo_ruleta_partidas_resultado check (
    resultado is null or resultado in ('SAFE_PACK', 'GRINDER', 'TUBE', 'BONUS_PACK', 'CONSOLATION')
  )
);

alter table public.expo_ruleta_partidas drop constraint if exists expo_ruleta_partidas_aciertos;
alter table public.expo_ruleta_partidas add constraint expo_ruleta_partidas_aciertos check (aciertos >= 0 and aciertos <= 5);

alter table public.expo_ruleta_partidas add column if not exists excluidas text[] not null default '{}';

alter table public.expo_ruleta_partidas drop constraint if exists expo_ruleta_partidas_ronda_especial;
alter table public.expo_ruleta_partidas add constraint expo_ruleta_partidas_ronda_especial check (ronda_especial between 1 and 5);

alter table public.expo_ruleta_estado enable row level security;
alter table public.expo_ruleta_partidas enable row level security;

revoke all on table public.expo_ruleta_estado from public, anon, authenticated, service_role;
revoke all on table public.expo_ruleta_partidas from public, anon, authenticated, service_role;

create or replace function public.stock_alcanza_ruleta(p_cantidades jsonb)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  producto text;
  cantidad integer;
  fila public.expo_inventario%rowtype;
begin
  if p_cantidades is null or jsonb_typeof(p_cantidades) <> 'object' then
    return false;
  end if;

  for producto, cantidad in
    select clave, valor::integer
    from jsonb_each_text(p_cantidades) as pares(clave, valor)
  loop
    if cantidad is null or cantidad <= 0 then
      continue;
    end if;

    if producto not in ('stickers', 'filtros', 'folletos', 'tuqueros', 'picadores') then
      return false;
    end if;

    select *
    into fila
    from public.expo_inventario
    where slug = producto;

    if not found or fila.stock_total is null then
      return false;
    end if;

    if fila.stock_total - fila.entregados - fila.reservados < cantidad then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.bloquear_inventario_ruleta()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  producto text;
begin
  foreach producto in array array['filtros', 'folletos', 'picadores', 'stickers', 'tuqueros']
  loop
    perform 1
    from public.expo_inventario
    where slug = producto
    for update;
  end loop;
end;
$$;

create or replace function public.elegibles_ruleta(
  p_giro integer,
  p_ultimo text,
  p_pesos jsonb,
  p_cantidades jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ids text[] := array['GRINDER', 'TUBE', 'BONUS_PACK', 'CONSOLATION'];
  premio text;
  peso numeric;
  motivo text;
  lista jsonb := '[]'::jsonb;
begin
  foreach premio in array ids
  loop
    begin
      peso := coalesce((p_pesos ->> premio)::numeric, 0);
    exception
      when invalid_text_representation then
        raise exception 'Las probabilidades no son válidas.';
    end;

    motivo := null;

    if peso <= 0 then
      motivo := 'peso';
    elsif premio = 'GRINDER' and p_giro < 11 then
      motivo := 'giro';
    elsif premio = 'TUBE' and p_giro < 11 then
      motivo := 'giro';
    elsif premio = 'GRINDER' and p_ultimo = 'TUBE' then
      motivo := 'consecutivo';
    elsif premio = 'TUBE' and p_ultimo = 'GRINDER' then
      motivo := 'consecutivo';
    elsif not public.stock_alcanza_ruleta(p_cantidades -> premio) then
      motivo := 'stock';
    end if;

    if motivo is not null then
      peso := 0;
    end if;

    lista := lista || jsonb_build_array(
      jsonb_build_object(
        'id', premio,
        'peso', peso,
        'motivo', motivo
      )
    );
  end loop;

  return lista;
end;
$$;

create or replace function public.reservar_pack_ruleta(p_pack jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  producto text;
  cantidad integer;
  fila public.expo_inventario%rowtype;
begin
  if p_pack is null or jsonb_typeof(p_pack) <> 'object' then
    raise exception 'El premio no es válido.';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_pack) as clave
    where clave not in ('stickers', 'filtros', 'folletos', 'tuqueros', 'picadores')
  ) then
    raise exception 'El premio no es válido.';
  end if;

  foreach producto in array array['filtros', 'folletos', 'picadores', 'stickers', 'tuqueros']
  loop
    cantidad := coalesce((p_pack ->> producto)::integer, 0);
    if cantidad <= 0 then
      continue;
    end if;

    select *
    into fila
    from public.expo_inventario
    where slug = producto
    for update;

    if not found or fila.stock_total is null
      or fila.stock_total - fila.entregados - fila.reservados < cantidad then
      raise exception 'No hay stock suficiente.';
    end if;

    update public.expo_inventario
    set
      reservados = reservados + cantidad,
      updated_at = now()
    where id = fila.id;
  end loop;
end;
$$;

create or replace function public.crear_partida_ruleta(p_visitor uuid, p_ronda integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  fila public.expo_ruleta_partidas%rowtype;
  previa public.expo_ruleta_partidas%rowtype;
  opciones integer[];
  ronda integer;
  bloqueadas text[];
begin
  if p_visitor is null then
    raise exception 'La partida no es válida.';
  end if;

  select *
  into previa
  from public.expo_ruleta_partidas
  where visitor_id = p_visitor
  order by created_at desc
  limit 1;

  if found and previa.ronda_especial in (3, 4, 5) then
    select coalesce(array_agg(valor order by valor), array[3, 4, 5])
    into opciones
    from unnest(array[3, 4, 5]) as valor
    where valor <> previa.ronda_especial;
    bloqueadas := coalesce(previa.usadas, '{}'::text[]);
  elsif found then
    opciones := array[3, 4, 5];
    bloqueadas := coalesce(previa.usadas, '{}'::text[]);
  else
    opciones := array[3, 4, 5];
    bloqueadas := '{}'::text[];
  end if;

  ronda := opciones[1 + floor(random() * cardinality(opciones))::integer];

  if ronda is null or ronda not in (3, 4, 5) then
    raise exception 'La partida no es válida.';
  end if;

  insert into public.expo_ruleta_partidas (visitor_id, ronda_especial, excluidas)
  values (p_visitor, ronda, bloqueadas)
  returning * into fila;

  return jsonb_build_object(
    'id', fila.id,
    'rondaEspecial', fila.ronda_especial
  );
end;
$$;

create or replace function public.leer_partida_ruleta(p_visitor uuid, p_partida uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  fila public.expo_ruleta_partidas%rowtype;
begin
  select *
  into fila
  from public.expo_ruleta_partidas
  where id = p_partida
    and visitor_id = p_visitor;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', fila.id,
    'estado', fila.estado,
    'vidas', fila.vidas,
    'aciertos', fila.aciertos,
    'ronda', fila.ronda,
    'rondaEspecial', fila.ronda_especial,
    'usadas', to_jsonb(fila.usadas),
    'excluidas', to_jsonb(coalesce(fila.excluidas, '{}'::text[])),
    'preguntaId', fila.pregunta_id,
    'categoriaId', fila.categoria_id,
    'respondida', fila.pregunta_respondida,
    'resultado', fila.resultado,
    'cantidades', fila.cantidades,
    'elegibles', fila.elegibles,
    'giro', fila.giro
  );
end;
$$;

create or replace function public.fijar_pregunta_ruleta(
  p_visitor uuid,
  p_partida uuid,
  p_pregunta text,
  p_categoria text,
  p_correcta integer,
  p_especial text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  fila public.expo_ruleta_partidas%rowtype;
  siguiente integer;
begin
  select *
  into fila
  from public.expo_ruleta_partidas
  where id = p_partida
    and visitor_id = p_visitor
  for update;

  if not found then
    raise exception 'No se encontró la partida.';
  end if;

  if fila.estado <> 'jugando' then
    raise exception 'La partida ya no acepta preguntas.';
  end if;

  if fila.pregunta_id is not null and not fila.pregunta_respondida then
    return jsonb_build_object(
      'preguntaId', fila.pregunta_id,
      'categoriaId', fila.categoria_id,
      'ronda', fila.ronda,
      'vidas', fila.vidas,
      'aciertos', fila.aciertos,
      'usadas', to_jsonb(fila.usadas)
    );
  end if;

  if fila.aciertos >= 5 or fila.vidas <= 0 then
    raise exception 'La partida ya no acepta preguntas.';
  end if;

  if p_pregunta is null or char_length(btrim(p_pregunta)) = 0 or p_pregunta = any(fila.usadas) then
    raise exception 'La pregunta no es válida.';
  end if;

  if p_correcta is null or p_correcta not in (0, 1, 2, 3) then
    raise exception 'La pregunta no es válida.';
  end if;

  if p_especial is null or char_length(btrim(p_especial)) = 0 then
    raise exception 'La pregunta especial no está configurada.';
  end if;

  siguiente := fila.ronda + 1;

  if siguiente = fila.ronda_especial and p_pregunta <> p_especial then
    raise exception 'La pregunta especial es obligatoria.';
  end if;

  if siguiente <> fila.ronda_especial and p_pregunta = p_especial then
    raise exception 'La pregunta especial no corresponde a esta ronda.';
  end if;

  if siguiente > fila.ronda_especial and not (p_especial = any(fila.usadas)) then
    raise exception 'La pregunta especial es obligatoria.';
  end if;

  update public.expo_ruleta_partidas
  set
    ronda = siguiente,
    pregunta_id = p_pregunta,
    categoria_id = p_categoria,
    correct_index = p_correcta,
    pregunta_respondida = false,
    respuesta_indice = null,
    acerto = null,
    usadas = fila.usadas || p_pregunta,
    updated_at = now()
  where id = fila.id
  returning * into fila;

  return jsonb_build_object(
    'preguntaId', fila.pregunta_id,
    'categoriaId', fila.categoria_id,
    'ronda', fila.ronda,
    'vidas', fila.vidas,
    'aciertos', fila.aciertos,
    'usadas', to_jsonb(fila.usadas)
  );
end;
$$;

create or replace function public.responder_pregunta_ruleta(
  p_visitor uuid,
  p_partida uuid,
  p_indice integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  fila public.expo_ruleta_partidas%rowtype;
  fue_acierto boolean;
  nuevos_aciertos integer;
  nuevas_vidas integer;
  nuevo_estado text;
begin
  if p_indice is null or p_indice not in (0, 1, 2, 3) then
    raise exception 'La respuesta no es válida.';
  end if;

  select *
  into fila
  from public.expo_ruleta_partidas
  where id = p_partida
    and visitor_id = p_visitor
  for update;

  if not found then
    raise exception 'No se encontró la partida.';
  end if;

  if fila.pregunta_id is null or fila.correct_index is null then
    raise exception 'No hay una pregunta pendiente.';
  end if;

  if fila.pregunta_respondida then
    if fila.respuesta_indice is distinct from p_indice then
      raise exception 'Esa pregunta ya fue respondida.';
    end if;

    return jsonb_build_object(
      'acerto', fila.acerto,
      'correcta', fila.correct_index,
      'aciertos', fila.aciertos,
      'vidas', fila.vidas,
      'estado', fila.estado,
      'preguntaId', fila.pregunta_id
    );
  end if;

  fue_acierto := p_indice = fila.correct_index;
  nuevos_aciertos := fila.aciertos + case when fue_acierto then 1 else 0 end;
  nuevas_vidas := case when fue_acierto then fila.vidas else greatest(0, fila.vidas - 1) end;
  nuevo_estado := 'jugando';

  if nuevos_aciertos >= 5 then
    nuevo_estado := 'ganada';
  elsif nuevas_vidas <= 0 then
    nuevo_estado := 'perdida';
  end if;

  update public.expo_ruleta_partidas
  set
    aciertos = nuevos_aciertos,
    vidas = nuevas_vidas,
    estado = nuevo_estado,
    pregunta_respondida = true,
    respuesta_indice = p_indice,
    acerto = fue_acierto,
    updated_at = now()
  where id = fila.id;

  return jsonb_build_object(
    'acerto', fue_acierto,
    'correcta', fila.correct_index,
    'aciertos', nuevos_aciertos,
    'vidas', nuevas_vidas,
    'estado', nuevo_estado,
    'preguntaId', fila.pregunta_id
  );
end;
$$;

create or replace function public.preview_ruleta(p_pesos jsonb, p_cantidades jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  estado_giro public.expo_ruleta_estado%rowtype;
  lista jsonb;
begin
  select *
  into estado_giro
  from public.expo_ruleta_estado
  where id = 1;

  if not found then
    raise exception 'Falta el estado global de la ruleta.';
  end if;

  lista := public.elegibles_ruleta(estado_giro.giros + 1, estado_giro.ultimo_resultado, p_pesos, p_cantidades);

  return jsonb_build_object(
    'giro', estado_giro.giros + 1,
    'elegibles', lista
  );
end;
$$;

create or replace function public.disponibilidad_premio_ruleta(
  p_visitor uuid,
  p_partida uuid,
  p_especial text,
  p_cantidades jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  fila public.expo_ruleta_partidas%rowtype;
  habilitada boolean;
begin
  select *
  into fila
  from public.expo_ruleta_partidas
  where id = p_partida
    and visitor_id = p_visitor;

  habilitada := found
    and fila.estado = 'ganada'
    and fila.resultado is null
    and fila.aciertos >= 5
    and p_especial = any(fila.usadas);

  return jsonb_build_object(
    'habilitada', habilitada,
    'seguro', habilitada and public.stock_alcanza_ruleta(p_cantidades)
  );
end;
$$;

create or replace function public.resolver_premio_ruleta(
  p_visitor uuid,
  p_partida uuid,
  p_modo text,
  p_especial text,
  p_pesos jsonb,
  p_cantidades jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  fila public.expo_ruleta_partidas%rowtype;
  estado_giro public.expo_ruleta_estado%rowtype;
  lista jsonb;
  pieza record;
  peso numeric;
  total numeric := 0;
  punto numeric;
  acumulado numeric := 0;
  elegido text;
  pack jsonb;
  siguiente integer;
begin
  if p_modo not in ('seguro', 'arriesgar') then
    raise exception 'La partida no es válida.';
  end if;

  if p_pesos is null or jsonb_typeof(p_pesos) <> 'object' or p_cantidades is null or jsonb_typeof(p_cantidades) <> 'object' then
    raise exception 'Las probabilidades no son válidas.';
  end if;

  select *
  into fila
  from public.expo_ruleta_partidas
  where id = p_partida
    and visitor_id = p_visitor
  for update;

  if not found then
    raise exception 'No se encontró la partida.';
  end if;

  if fila.resultado is not null then
    return jsonb_build_object(
      'premioId', fila.resultado,
      'cantidades', fila.cantidades,
      'elegibles', fila.elegibles,
      'giro', fila.giro,
      'estado', fila.estado,
      'repetido', true
    );
  end if;

  if fila.estado <> 'ganada' or fila.aciertos < 5 or p_especial is null or not (p_especial = any(fila.usadas)) then
    raise exception 'La partida no está habilitada para un premio.';
  end if;

  if p_modo = 'seguro' then
    pack := p_cantidades -> 'SAFE_PACK';
    perform public.bloquear_inventario_ruleta();

    if not public.stock_alcanza_ruleta(pack) then
      raise exception 'No hay stock suficiente.';
    end if;

    perform public.reservar_pack_ruleta(pack);

    update public.expo_ruleta_partidas
    set
      resultado = 'SAFE_PACK',
      cantidades = pack,
      estado = 'resuelta',
      updated_at = now()
    where id = fila.id
    returning * into fila;

    return jsonb_build_object(
      'premioId', fila.resultado,
      'cantidades', fila.cantidades,
      'elegibles', fila.elegibles,
      'giro', fila.giro,
      'estado', fila.estado,
      'repetido', false
    );
  end if;

  select *
  into estado_giro
  from public.expo_ruleta_estado
  where id = 1
  for update;

  if not found then
    raise exception 'Falta el estado global de la ruleta.';
  end if;

  siguiente := estado_giro.giros + 1;
  perform public.bloquear_inventario_ruleta();
  lista := public.elegibles_ruleta(siguiente, estado_giro.ultimo_resultado, p_pesos, p_cantidades);

  for pieza in
    select value
    from jsonb_array_elements(lista)
  loop
    total := total + greatest(coalesce((pieza.value ->> 'peso')::numeric, 0), 0);
  end loop;

  if total <= 0 then
    raise exception 'No hay premios disponibles.';
  end if;

  punto := random() * total;
  acumulado := 0;

  for pieza in
    select value
    from jsonb_array_elements(lista)
  loop
    peso := greatest(coalesce((pieza.value ->> 'peso')::numeric, 0), 0);
    if peso <= 0 then
      continue;
    end if;
    acumulado := acumulado + peso;
    if punto < acumulado then
      elegido := pieza.value ->> 'id';
      exit;
    end if;
  end loop;

  if elegido is null then
    select pares.elemento ->> 'id'
    into elegido
    from jsonb_array_elements(lista) with ordinality as pares(elemento, orden)
    where coalesce((pares.elemento ->> 'peso')::numeric, 0) > 0
    order by pares.orden desc
    limit 1;
  end if;

  if elegido not in ('GRINDER', 'TUBE', 'BONUS_PACK', 'CONSOLATION') then
    raise exception 'El premio no es válido.';
  end if;

  pack := p_cantidades -> elegido;
  perform public.reservar_pack_ruleta(pack);

  update public.expo_ruleta_estado
  set
    giros = siguiente,
    ultimo_resultado = elegido
  where id = 1;

  update public.expo_ruleta_partidas
  set
    resultado = elegido,
    cantidades = pack,
    elegibles = lista,
    giro = siguiente,
    estado = 'resuelta',
    updated_at = now()
  where id = fila.id
  returning * into fila;

  return jsonb_build_object(
    'premioId', fila.resultado,
    'cantidades', fila.cantidades,
    'elegibles', fila.elegibles,
    'giro', fila.giro,
    'estado', fila.estado,
    'repetido', false
  );
end;
$$;

revoke all on function public.stock_alcanza_ruleta(jsonb) from public, anon, authenticated;
revoke all on function public.bloquear_inventario_ruleta() from public, anon, authenticated;
revoke all on function public.elegibles_ruleta(integer, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.reservar_pack_ruleta(jsonb) from public, anon, authenticated;
revoke all on function public.crear_partida_ruleta(uuid, integer) from public, anon, authenticated;
revoke all on function public.leer_partida_ruleta(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fijar_pregunta_ruleta(uuid, uuid, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.responder_pregunta_ruleta(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.preview_ruleta(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.disponibilidad_premio_ruleta(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.resolver_premio_ruleta(uuid, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;

grant execute on function public.stock_alcanza_ruleta(jsonb) to service_role;
grant execute on function public.bloquear_inventario_ruleta() to service_role;
grant execute on function public.elegibles_ruleta(integer, text, jsonb, jsonb) to service_role;
grant execute on function public.reservar_pack_ruleta(jsonb) to service_role;
grant execute on function public.crear_partida_ruleta(uuid, integer) to service_role;
grant execute on function public.leer_partida_ruleta(uuid, uuid) to service_role;
grant execute on function public.fijar_pregunta_ruleta(uuid, uuid, text, text, integer, text) to service_role;
grant execute on function public.responder_pregunta_ruleta(uuid, uuid, integer) to service_role;
grant execute on function public.preview_ruleta(jsonb, jsonb) to service_role;
grant execute on function public.disponibilidad_premio_ruleta(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.resolver_premio_ruleta(uuid, uuid, text, text, jsonb, jsonb) to service_role;
