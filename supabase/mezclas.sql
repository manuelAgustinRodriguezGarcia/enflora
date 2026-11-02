-- ENFLORA · Nutrientes, productos y recetas de mezcla.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase, DESPUÉS de supabase/registro-fotos.sql.
-- Es idempotente. No borra tablas, filas ni usa DROP CASCADE.
--
-- Qué agrega:
--   1. Catálogo privado: productos_cultivo, recetas_mezcla, receta_componentes.
--   2. Un snapshot por registro: registro_mezclas, registro_mezcla_componentes.
--   3. p_mezcla al final de crear_registro y editar_registro.
--      null conserva la mezcla al editar y no crea nada en el alta.
--      { "aplicar": false } la elimina.
--      Un objeto la reemplaza en la misma transacción.
--
-- Qué no hace:
--   No crea un historial de mezclas aparte.
--   No migra registros viejos: siguen sin mezcla.
--   No modifica fotos, plantas, acciones ni la forma de los parámetros.
--   No hay RPC de borrado. Archivar deja la fila para las referencias.
--
-- Firma anterior que se reemplaza, solo para evitar una RPC ambigua:
--   crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb)
--   editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb)
-- Esas funciones no las llama otra función SQL. PostgREST las invoca por nombre.

-- ---------------------------------------------------------------------------
-- 1. Catálogo
-- ---------------------------------------------------------------------------

create table if not exists public.productos_cultivo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  fabricante text,
  tipo text not null,
  caracteristicas text,
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint productos_cultivo_nombre_valido check (char_length(btrim(nombre)) between 1 and 80),
  constraint productos_cultivo_fabricante_valido check (
    fabricante is null or char_length(btrim(fabricante)) between 1 and 80
  ),
  constraint productos_cultivo_tipo_valido check (tipo in ('fertilizante', 'nutriente', 'aditivo')),
  constraint productos_cultivo_caracteristicas_validas check (
    caracteristicas is null or char_length(caracteristicas) <= 2000
  )
);

create table if not exists public.recetas_mezcla (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  volumen_agua numeric not null,
  unidad_volumen text not null,
  ph numeric,
  ec numeric,
  ppm numeric,
  metodo text,
  etapa text,
  notas text,
  activa boolean not null default true,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint recetas_mezcla_nombre_valido check (char_length(btrim(nombre)) between 1 and 80),
  constraint recetas_mezcla_volumen_valido check (volumen_agua > 0 and volumen_agua <= 1000000),
  constraint recetas_mezcla_unidad_volumen_valida check (unidad_volumen in ('L', 'ml')),
  constraint recetas_mezcla_ph_valido check (ph is null or (ph >= 0 and ph <= 14)),
  constraint recetas_mezcla_ec_valida check (ec is null or (ec >= 0 and ec <= 100)),
  constraint recetas_mezcla_ppm_validos check (ppm is null or (ppm >= 0 and ppm <= 100000)),
  constraint recetas_mezcla_metodo_valido check (
    metodo is null or char_length(btrim(metodo)) between 1 and 40
  ),
  constraint recetas_mezcla_etapa_valida check (
    etapa is null or etapa in (
      'germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado'
    )
  ),
  constraint recetas_mezcla_notas_validas check (notas is null or char_length(notas) <= 2000)
);

create table if not exists public.receta_componentes (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas_mezcla (id) on delete cascade,
  producto_id uuid not null references public.productos_cultivo (id) on delete restrict,
  orden integer not null,
  cantidad numeric not null,
  unidad text not null,
  constraint receta_componentes_orden_valido check (orden >= 0),
  constraint receta_componentes_cantidad_valida check (cantidad > 0 and cantidad <= 1000000),
  constraint receta_componentes_unidad_valida check (unidad in ('ml', 'g', 'L', 'ml/L', 'g/L'))
);

create unique index if not exists receta_componentes_receta_producto_uidx
on public.receta_componentes (receta_id, producto_id);

create index if not exists productos_cultivo_usuario_nombre_idx
on public.productos_cultivo (usuario_id, lower(nombre));

create index if not exists productos_cultivo_usuario_activos_idx
on public.productos_cultivo (usuario_id)
where activo;

create index if not exists recetas_mezcla_usuario_nombre_idx
on public.recetas_mezcla (usuario_id, lower(nombre));

create index if not exists receta_componentes_receta_orden_idx
on public.receta_componentes (receta_id, orden);

create index if not exists receta_componentes_producto_idx
on public.receta_componentes (producto_id);

-- ---------------------------------------------------------------------------
-- 2. Snapshot. Como máximo una mezcla por registro.
--    origen guarda la receta tal como se eligió, para saber si hubo un ajuste real.
-- ---------------------------------------------------------------------------

create table if not exists public.registro_mezclas (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null unique references public.registros (id) on delete cascade,
  receta_id uuid references public.recetas_mezcla (id) on delete set null,
  nombre_receta text,
  volumen_agua numeric not null,
  unidad_volumen text not null,
  ph numeric,
  ec numeric,
  ppm numeric,
  metodo text,
  etapa text,
  ajustada boolean not null default false,
  origen jsonb,
  constraint registro_mezclas_nombre_valido check (
    nombre_receta is null or char_length(btrim(nombre_receta)) between 1 and 80
  ),
  constraint registro_mezclas_volumen_valido check (volumen_agua > 0 and volumen_agua <= 1000000),
  constraint registro_mezclas_unidad_volumen_valida check (unidad_volumen in ('L', 'ml')),
  constraint registro_mezclas_ph_valido check (ph is null or (ph >= 0 and ph <= 14)),
  constraint registro_mezclas_ec_valida check (ec is null or (ec >= 0 and ec <= 100)),
  constraint registro_mezclas_ppm_validos check (ppm is null or (ppm >= 0 and ppm <= 100000)),
  constraint registro_mezclas_metodo_valido check (
    metodo is null or char_length(btrim(metodo)) between 1 and 40
  ),
  constraint registro_mezclas_etapa_valida check (
    etapa is null or etapa in (
      'germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado'
    )
  ),
  constraint registro_mezclas_origen_objeto check (
    origen is null or jsonb_typeof(origen) = 'object'
  )
);

create table if not exists public.registro_mezcla_componentes (
  id uuid primary key default gen_random_uuid(),
  registro_mezcla_id uuid not null references public.registro_mezclas (id) on delete cascade,
  producto_id uuid references public.productos_cultivo (id) on delete set null,
  orden integer not null,
  nombre_producto text not null,
  fabricante text,
  tipo_producto text not null,
  cantidad_aplicada numeric not null,
  unidad_aplicada text not null,
  cantidad_receta numeric not null,
  unidad_receta text not null,
  constraint registro_mezcla_componentes_orden_valido check (orden >= 0),
  constraint registro_mezcla_componentes_nombre_valido check (char_length(btrim(nombre_producto)) between 1 and 80),
  constraint registro_mezcla_componentes_tipo_valido check (
    tipo_producto in ('fertilizante', 'nutriente', 'aditivo')
  ),
  constraint registro_mezcla_componentes_aplicada_valida check (cantidad_aplicada > 0),
  constraint registro_mezcla_componentes_unidad_aplicada_valida check (unidad_aplicada in ('ml', 'g', 'L')),
  constraint registro_mezcla_componentes_receta_valida check (cantidad_receta > 0),
  constraint registro_mezcla_componentes_unidad_receta_valida check (
    unidad_receta in ('ml', 'g', 'L', 'ml/L', 'g/L')
  )
);

create unique index if not exists registro_mezclas_registro_uidx
on public.registro_mezclas (registro_id);

create index if not exists registro_mezclas_receta_idx
on public.registro_mezclas (receta_id)
where receta_id is not null;

create index if not exists registro_mezcla_componentes_mezcla_orden_idx
on public.registro_mezcla_componentes (registro_mezcla_id, orden);

create unique index if not exists registro_mezcla_componentes_producto_uidx
on public.registro_mezcla_componentes (registro_mezcla_id, producto_id)
where producto_id is not null;

create index if not exists registro_mezcla_componentes_producto_idx
on public.registro_mezcla_componentes (producto_id)
where producto_id is not null;

-- ---------------------------------------------------------------------------
-- 3. RLS. Lectura del dueño. Las escrituras pasan por RPC security definer.
-- ---------------------------------------------------------------------------

alter table public.productos_cultivo enable row level security;
alter table public.recetas_mezcla enable row level security;
alter table public.receta_componentes enable row level security;
alter table public.registro_mezclas enable row level security;
alter table public.registro_mezcla_componentes enable row level security;

drop policy if exists productos_cultivo_lee_propios on public.productos_cultivo;
create policy productos_cultivo_lee_propios
on public.productos_cultivo
for select
to authenticated
using (auth.uid() = usuario_id);

drop policy if exists recetas_mezcla_lee_propias on public.recetas_mezcla;
create policy recetas_mezcla_lee_propias
on public.recetas_mezcla
for select
to authenticated
using (auth.uid() = usuario_id);

drop policy if exists receta_componentes_lee_propios on public.receta_componentes;
create policy receta_componentes_lee_propios
on public.receta_componentes
for select
to authenticated
using (
  exists (
    select 1
    from public.recetas_mezcla
    where recetas_mezcla.id = receta_componentes.receta_id
      and recetas_mezcla.usuario_id = auth.uid()
  )
);

drop policy if exists registro_mezclas_lee_propias on public.registro_mezclas;
create policy registro_mezclas_lee_propias
on public.registro_mezclas
for select
to authenticated
using (
  exists (
    select 1
    from public.registros
    where registros.id = registro_mezclas.registro_id
      and registros.usuario_id = auth.uid()
  )
);

drop policy if exists registro_mezcla_componentes_lee_propios on public.registro_mezcla_componentes;
create policy registro_mezcla_componentes_lee_propios
on public.registro_mezcla_componentes
for select
to authenticated
using (
  exists (
    select 1
    from public.registro_mezclas
    join public.registros on registros.id = registro_mezclas.registro_id
    where registro_mezclas.id = registro_mezcla_componentes.registro_mezcla_id
      and registros.usuario_id = auth.uid()
  )
);

revoke all on public.productos_cultivo from public, anon, authenticated;
revoke all on public.recetas_mezcla from public, anon, authenticated;
revoke all on public.receta_componentes from public, anon, authenticated;
revoke all on public.registro_mezclas from public, anon, authenticated;
revoke all on public.registro_mezcla_componentes from public, anon, authenticated;

grant select on public.productos_cultivo to authenticated;
grant select on public.recetas_mezcla to authenticated;
grant select on public.receta_componentes to authenticated;
grant select on public.registro_mezclas to authenticated;
grant select on public.registro_mezcla_componentes to authenticated;

create or replace function public.mezclas_marcar_actualizacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists productos_cultivo_actualizacion on public.productos_cultivo;
create trigger productos_cultivo_actualizacion
before update on public.productos_cultivo
for each row execute function public.mezclas_marcar_actualizacion();

drop trigger if exists recetas_mezcla_actualizacion on public.recetas_mezcla;
create trigger recetas_mezcla_actualizacion
before update on public.recetas_mezcla
for each row execute function public.mezclas_marcar_actualizacion();

-- ---------------------------------------------------------------------------
-- 4. Helpers internos. No se exponen a la API.
-- ---------------------------------------------------------------------------

create or replace function public.mezclas_numero(p_valor jsonb)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  texto text;
begin
  if p_valor is null or jsonb_typeof(p_valor) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_valor) = 'number' then
    return p_valor::text::numeric;
  end if;
  if jsonb_typeof(p_valor) = 'string' then
    texto := replace(btrim(p_valor #>> '{}'), ',', '.');
    if texto = '' or texto !~ '^\d+(\.\d+)?$' then
      return null;
    end if;
    return texto::numeric;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

create or replace function public.mezcla_difiere_de_origen(
  p_origen jsonb,
  p_componentes jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  item jsonb;
  base jsonb;
  v_total integer;
begin
  if p_origen is null or jsonb_typeof(p_origen) = 'null' then
    return false;
  end if;
  if jsonb_typeof(p_origen) <> 'object'
     or p_origen->'componentes' is null
     or jsonb_typeof(p_origen->'componentes') = 'null' then
    return false;
  end if;
  if jsonb_typeof(p_origen->'componentes') <> 'array'
     or jsonb_typeof(p_componentes) <> 'array' then
    return true;
  end if;

  v_total := jsonb_array_length(p_origen->'componentes');
  if v_total <> jsonb_array_length(p_componentes) then
    return true;
  end if;

  for item in select value from jsonb_array_elements(p_componentes)
  loop
    select componente into base
    from jsonb_array_elements(p_origen->'componentes') as origen_item(componente)
    where componente->>'producto_id' = item->>'producto_id'
    limit 1;

    if base is null
       or coalesce(base->>'unidad', '') <> coalesce(item->>'unidad', '')
       or abs((base->>'cantidad')::numeric - (item->>'cantidad')::numeric) > 0.0001 then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.sincronizar_medicion_mezcla(
  p_registro_id uuid,
  p_clave text,
  p_nombre text,
  p_valor numeric,
  p_unidad text,
  p_conflicto text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_valor is null then
    return;
  end if;

  if exists (
    select 1
    from public.registro_parametros
    where registro_id = p_registro_id
      and origen = 'nativa'
      and clave_nativa = p_clave
      and valor_numero is distinct from p_valor
  ) then
    raise exception '%', p_conflicto;
  end if;

  if exists (
    select 1
    from public.registro_parametros
    where registro_id = p_registro_id
      and origen = 'nativa'
      and clave_nativa = p_clave
  ) then
    return;
  end if;

  insert into public.registro_parametros (
    registro_id,
    origen,
    clave_nativa,
    opcion_id,
    nombre,
    tipo_valor,
    valor_numero,
    valor_texto,
    unidad
  ) values (
    p_registro_id,
    'nativa',
    p_clave,
    null,
    p_nombre,
    'numero',
    p_valor,
    null,
    nullif(btrim(coalesce(p_unidad, '')), '')
  );
end;
$$;

create or replace function public.aplicar_mezcla_registro(
  p_registro_id uuid,
  p_usuario uuid,
  p_aplica_a text,
  p_acciones jsonb,
  p_mezcla jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riego boolean;
  item jsonb;
  base jsonb;
  v_receta_id uuid;
  v_nombre_receta text;
  v_volumen numeric;
  v_unidad_volumen text;
  v_litros numeric;
  v_ph numeric;
  v_ec numeric;
  v_ppm numeric;
  v_metodo text;
  v_etapa text;
  v_origen jsonb;
  v_componentes jsonb;
  v_ajustada boolean;
  v_mezcla_id uuid;
  v_producto_id uuid;
  v_orden integer;
  v_cantidad numeric;
  v_unidad text;
  v_aplicada numeric;
  v_unidad_aplicada text;
  v_cantidad_receta numeric;
  v_unidad_receta text;
  v_nombre text;
  v_fabricante text;
  v_tipo text;
  v_indice integer := 0;
  v_vistos uuid[] := '{}'::uuid[];
  v_origen_vistos text[] := '{}'::text[];
begin
  v_riego := exists (
    select 1
    from jsonb_array_elements(coalesce(p_acciones, '[]'::jsonb)) as accion(elemento)
    where elemento->>'origen' = 'nativa'
      and elemento->>'clave_nativa' in ('riego', 'fertilizacion')
  );

  -- null: el alta no crea mezcla. La edición conserva la que ya está,
  -- salvo que el registro ya no tenga riego ni fertilización.
  if p_mezcla is null or jsonb_typeof(p_mezcla) = 'null' then
    if not v_riego then
      delete from public.registro_mezclas where registro_id = p_registro_id;
    end if;
    return;
  end if;

  if jsonb_typeof(p_mezcla) <> 'object' then
    raise exception 'La mezcla no es válida.';
  end if;

  if p_mezcla ? 'aplicar' and (p_mezcla->'aplicar') = 'false'::jsonb then
    delete from public.registro_mezclas where registro_id = p_registro_id;
    return;
  end if;

  if p_aplica_a is distinct from 'plantas' then
    raise exception 'Una medición ambiental no lleva mezcla.';
  end if;

  if not v_riego then
    raise exception 'La mezcla requiere un riego o una fertilización.';
  end if;

  v_volumen := public.mezclas_numero(p_mezcla->'volumen_agua');
  v_unidad_volumen := p_mezcla->>'unidad_volumen';
  if v_volumen is null
     or v_volumen <= 0
     or v_volumen > 1000000
     or v_unidad_volumen not in ('L', 'ml') then
    raise exception 'El volumen de la mezcla no es válido.';
  end if;
  v_volumen := round(v_volumen, 4);
  v_litros := case when v_unidad_volumen = 'L' then v_volumen else v_volumen / 1000 end;

  if p_mezcla ? 'ph' and jsonb_typeof(p_mezcla->'ph') <> 'null' then
    v_ph := public.mezclas_numero(p_mezcla->'ph');
    if v_ph is null or v_ph < 0 or v_ph > 14 then
      raise exception 'El pH de la mezcla no es válido.';
    end if;
    v_ph := round(v_ph, 2);
  end if;

  if p_mezcla ? 'ec' and jsonb_typeof(p_mezcla->'ec') <> 'null' then
    v_ec := public.mezclas_numero(p_mezcla->'ec');
    if v_ec is null or v_ec < 0 or v_ec > 100 then
      raise exception 'La EC de la mezcla no es válida.';
    end if;
    v_ec := round(v_ec, 3);
  end if;

  if p_mezcla ? 'ppm' and jsonb_typeof(p_mezcla->'ppm') <> 'null' then
    v_ppm := public.mezclas_numero(p_mezcla->'ppm');
    if v_ppm is null or v_ppm < 0 or v_ppm > 100000 then
      raise exception 'Los PPM de la mezcla no son válidos.';
    end if;
    v_ppm := round(v_ppm, 2);
  end if;

  v_metodo := nullif(btrim(coalesce(p_mezcla->>'metodo', '')), '');
  if v_metodo is not null and char_length(v_metodo) > 40 then
    raise exception 'La mezcla no es válida.';
  end if;

  v_etapa := nullif(btrim(coalesce(p_mezcla->>'etapa', '')), '');
  if v_etapa is not null and v_etapa not in (
    'germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado'
  ) then
    raise exception 'La mezcla no es válida.';
  end if;

  if coalesce(p_mezcla->>'receta_id', '') <> '' then
    begin
      v_receta_id := (p_mezcla->>'receta_id')::uuid;
    exception when others then
      raise exception 'La mezcla no es válida.';
    end;

    select nombre into v_nombre_receta
    from public.recetas_mezcla
    where id = v_receta_id
      and usuario_id = p_usuario;

    if not found then
      raise exception 'No se puede usar una receta de otro usuario.';
    end if;
  end if;

  v_componentes := coalesce(p_mezcla->'componentes', '[]'::jsonb);
  if jsonb_typeof(v_componentes) <> 'array' or jsonb_array_length(v_componentes) > 24 then
    raise exception 'Hay un componente de mezcla que no es válido.';
  end if;

  if not (p_mezcla ? 'origen') or jsonb_typeof(p_mezcla->'origen') = 'null' then
    v_origen := null;
  elsif jsonb_typeof(p_mezcla->'origen') <> 'object'
        or jsonb_typeof(p_mezcla->'origen'->'componentes') is distinct from 'array' then
    raise exception 'La mezcla no es válida.';
  else
    v_origen := p_mezcla->'origen';
    if v_receta_id is null then
      raise exception 'La mezcla no es válida.';
    end if;
  end if;

  if v_origen is not null then
    for item in select value from jsonb_array_elements(v_origen->'componentes')
    loop
      if item->>'producto_id' is null or item->>'producto_id' = any (v_origen_vistos) then
        raise exception 'La mezcla no es válida.';
      end if;
      v_origen_vistos := array_append(v_origen_vistos, item->>'producto_id');
      if coalesce(item->>'unidad', '') not in ('ml', 'g', 'L', 'ml/L', 'g/L')
         or public.mezclas_numero(item->'cantidad') is null
         or public.mezclas_numero(item->'cantidad') <= 0 then
        raise exception 'La mezcla no es válida.';
      end if;
    end loop;
  end if;

  v_ajustada := public.mezcla_difiere_de_origen(v_origen, v_componentes);

  delete from public.registro_mezclas where registro_id = p_registro_id;

  insert into public.registro_mezclas (
    registro_id,
    receta_id,
    nombre_receta,
    volumen_agua,
    unidad_volumen,
    ph,
    ec,
    ppm,
    metodo,
    etapa,
    ajustada,
    origen
  ) values (
    p_registro_id,
    v_receta_id,
    v_nombre_receta,
    v_volumen,
    v_unidad_volumen,
    v_ph,
    v_ec,
    v_ppm,
    v_metodo,
    v_etapa,
    v_ajustada,
    v_origen
  )
  returning id into v_mezcla_id;

  for item in select value from jsonb_array_elements(v_componentes)
  loop
    begin
      v_producto_id := nullif(item->>'producto_id', '')::uuid;
      v_orden := coalesce(nullif(item->>'orden', '')::integer, v_indice);
    exception when others then
      raise exception 'Hay un componente de mezcla que no es válido.';
    end;

    if v_producto_id is null or v_orden < 0 then
      raise exception 'Hay un componente de mezcla que no es válido.';
    end if;

    if v_producto_id = any (v_vistos) then
      raise exception 'Hay un componente duplicado.';
    end if;
    v_vistos := array_append(v_vistos, v_producto_id);

    v_cantidad := public.mezclas_numero(item->'cantidad');
    v_unidad := item->>'unidad';
    if v_cantidad is null or v_cantidad <= 0 or v_cantidad > 1000000 then
      raise exception 'La cantidad del componente no es válida.';
    end if;
    v_cantidad := round(v_cantidad, 4);

    if v_unidad = 'ml/L' then
      v_aplicada := round(v_cantidad * v_litros, 4);
      v_unidad_aplicada := 'ml';
    elsif v_unidad = 'g/L' then
      v_aplicada := round(v_cantidad * v_litros, 4);
      v_unidad_aplicada := 'g';
    elsif v_unidad in ('ml', 'g', 'L') then
      v_aplicada := round(v_cantidad, 4);
      v_unidad_aplicada := v_unidad;
    else
      raise exception 'La unidad del componente no es válida.';
    end if;

    if v_aplicada is null or v_aplicada <= 0 then
      raise exception 'La cantidad del componente no es válida.';
    end if;

    select nombre, fabricante, tipo
    into v_nombre, v_fabricante, v_tipo
    from public.productos_cultivo
    where id = v_producto_id
      and usuario_id = p_usuario;

    if not found then
      raise exception 'No se puede usar un producto de otro usuario.';
    end if;

    v_cantidad_receta := v_cantidad;
    v_unidad_receta := v_unidad;
    if v_origen is not null then
      select componente into base
      from jsonb_array_elements(v_origen->'componentes') as origen_item(componente)
      where componente->>'producto_id' = v_producto_id::text
      limit 1;
      if base is not null then
        v_cantidad_receta := round(public.mezclas_numero(base->'cantidad'), 4);
        v_unidad_receta := base->>'unidad';
      end if;
    end if;

    insert into public.registro_mezcla_componentes (
      registro_mezcla_id,
      producto_id,
      orden,
      nombre_producto,
      fabricante,
      tipo_producto,
      cantidad_aplicada,
      unidad_aplicada,
      cantidad_receta,
      unidad_receta
    ) values (
      v_mezcla_id,
      v_producto_id,
      v_orden,
      v_nombre,
      v_fabricante,
      v_tipo,
      v_aplicada,
      v_unidad_aplicada,
      v_cantidad_receta,
      v_unidad_receta
    );

    v_indice := v_indice + 1;
  end loop;

  perform public.sincronizar_medicion_mezcla(
    p_registro_id, 'ph', 'pH', v_ph, null,
    'El pH de la mezcla no coincide con el parámetro.'
  );
  perform public.sincronizar_medicion_mezcla(
    p_registro_id, 'ec', 'EC', v_ec, null,
    'La EC de la mezcla no coincide con el parámetro.'
  );
  perform public.sincronizar_medicion_mezcla(
    p_registro_id, 'ppm', 'PPM', v_ppm, 'ppm',
    'Los PPM de la mezcla no coinciden con el parámetro.'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Catálogo. Archivar no borra la fila.
-- ---------------------------------------------------------------------------

create or replace function public.guardar_producto_cultivo(
  p_id uuid,
  p_nombre text,
  p_fabricante text,
  p_tipo text,
  p_caracteristicas text
)
returns public.productos_cultivo
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  guardado public.productos_cultivo;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_fabricante text := nullif(btrim(coalesce(p_fabricante, '')), '');
  v_caracteristicas text := nullif(btrim(coalesce(p_caracteristicas, '')), '');
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if char_length(v_nombre) < 1 or char_length(v_nombre) > 80 then
    raise exception 'El nombre del producto es obligatorio.';
  end if;

  if p_tipo is null or p_tipo not in ('fertilizante', 'nutriente', 'aditivo') then
    raise exception 'El tipo de producto no es válido.';
  end if;

  if v_fabricante is not null and char_length(v_fabricante) > 80 then
    raise exception 'El fabricante del producto es demasiado largo.';
  end if;

  if v_caracteristicas is not null and char_length(v_caracteristicas) > 2000 then
    raise exception 'Las características del producto son demasiado largas.';
  end if;

  if p_id is null then
    insert into public.productos_cultivo (
      usuario_id, nombre, fabricante, tipo, caracteristicas, activo
    ) values (
      usuario, v_nombre, v_fabricante, p_tipo, v_caracteristicas, true
    )
    returning * into guardado;
    return guardado;
  end if;

  update public.productos_cultivo
  set
    nombre = v_nombre,
    fabricante = v_fabricante,
    tipo = p_tipo,
    caracteristicas = v_caracteristicas
  where id = p_id
    and usuario_id = usuario
  returning * into guardado;

  if not found then
    raise exception 'No se encontró el producto.';
  end if;

  return guardado;
end;
$$;

create or replace function public.establecer_producto_cultivo_activo(
  p_id uuid,
  p_activo boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if p_activo is null then
    raise exception 'No se encontró el producto.';
  end if;

  update public.productos_cultivo
  set activo = p_activo
  where id = p_id
    and usuario_id = usuario;

  if not found then
    raise exception 'No se encontró el producto.';
  end if;
end;
$$;

create or replace function public.guardar_receta_mezcla(
  p_id uuid,
  p_datos jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  v_id uuid := p_id;
  item jsonb;
  v_nombre text;
  v_volumen numeric;
  v_unidad text;
  v_ph numeric;
  v_ec numeric;
  v_ppm numeric;
  v_metodo text;
  v_etapa text;
  v_notas text;
  v_componentes jsonb;
  v_producto_id uuid;
  v_cantidad numeric;
  v_orden integer;
  v_indice integer := 0;
  v_vistos uuid[] := '{}'::uuid[];
  v_dueno uuid;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'La mezcla no es válida.';
  end if;

  v_nombre := btrim(coalesce(p_datos->>'nombre', ''));
  if char_length(v_nombre) < 1 or char_length(v_nombre) > 80 then
    raise exception 'El nombre de la receta es obligatorio.';
  end if;

  v_volumen := public.mezclas_numero(p_datos->'volumen_agua');
  v_unidad := p_datos->>'unidad_volumen';
  if v_volumen is null or v_volumen <= 0 or v_volumen > 1000000 or v_unidad not in ('L', 'ml') then
    raise exception 'La receta necesita un volumen de agua.';
  end if;
  v_volumen := round(v_volumen, 4);

  if p_datos ? 'ph' and jsonb_typeof(p_datos->'ph') <> 'null' then
    v_ph := public.mezclas_numero(p_datos->'ph');
    if v_ph is null or v_ph < 0 or v_ph > 14 then
      raise exception 'El pH de la mezcla no es válido.';
    end if;
    v_ph := round(v_ph, 2);
  end if;

  if p_datos ? 'ec' and jsonb_typeof(p_datos->'ec') <> 'null' then
    v_ec := public.mezclas_numero(p_datos->'ec');
    if v_ec is null or v_ec < 0 or v_ec > 100 then
      raise exception 'La EC de la mezcla no es válida.';
    end if;
    v_ec := round(v_ec, 3);
  end if;

  if p_datos ? 'ppm' and jsonb_typeof(p_datos->'ppm') <> 'null' then
    v_ppm := public.mezclas_numero(p_datos->'ppm');
    if v_ppm is null or v_ppm < 0 or v_ppm > 100000 then
      raise exception 'Los PPM de la mezcla no son válidos.';
    end if;
    v_ppm := round(v_ppm, 2);
  end if;

  v_metodo := nullif(btrim(coalesce(p_datos->>'metodo', '')), '');
  if v_metodo is not null and char_length(v_metodo) > 40 then
    raise exception 'La mezcla no es válida.';
  end if;

  v_etapa := nullif(btrim(coalesce(p_datos->>'etapa', '')), '');
  if v_etapa is not null and v_etapa not in (
    'germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado'
  ) then
    raise exception 'La mezcla no es válida.';
  end if;

  v_notas := nullif(btrim(coalesce(p_datos->>'notas', '')), '');
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'Las observaciones de la receta son demasiado largas.';
  end if;

  v_componentes := p_datos->'componentes';
  if v_componentes is null
     or jsonb_typeof(v_componentes) <> 'array'
     or jsonb_array_length(v_componentes) < 1
     or jsonb_array_length(v_componentes) > 24 then
    raise exception 'La receta necesita al menos un componente.';
  end if;

  if v_id is not null then
    select usuario_id into v_dueno
    from public.recetas_mezcla
    where id = v_id;

    if v_dueno is null or v_dueno <> usuario then
      raise exception 'No se encontró la receta.';
    end if;

    update public.recetas_mezcla
    set
      nombre = v_nombre,
      volumen_agua = v_volumen,
      unidad_volumen = v_unidad,
      ph = v_ph,
      ec = v_ec,
      ppm = v_ppm,
      metodo = v_metodo,
      etapa = v_etapa,
      notas = v_notas
    where id = v_id
      and usuario_id = usuario;

    delete from public.receta_componentes where receta_id = v_id;
  else
    insert into public.recetas_mezcla (
      usuario_id, nombre, volumen_agua, unidad_volumen,
      ph, ec, ppm, metodo, etapa, notas, activa
    ) values (
      usuario, v_nombre, v_volumen, v_unidad,
      v_ph, v_ec, v_ppm, v_metodo, v_etapa, v_notas, true
    )
    returning id into v_id;
  end if;

  for item in select value from jsonb_array_elements(v_componentes)
  loop
    begin
      v_producto_id := nullif(item->>'producto_id', '')::uuid;
      v_orden := coalesce(nullif(item->>'orden', '')::integer, v_indice);
    exception when others then
      raise exception 'Hay un componente de mezcla que no es válido.';
    end;

    if v_producto_id is null or v_orden < 0 then
      raise exception 'Hay un componente de mezcla que no es válido.';
    end if;

    if v_producto_id = any (v_vistos) then
      raise exception 'Hay un componente duplicado.';
    end if;
    v_vistos := array_append(v_vistos, v_producto_id);

    v_cantidad := public.mezclas_numero(item->'cantidad');
    if v_cantidad is null or v_cantidad <= 0 or v_cantidad > 1000000 then
      raise exception 'La cantidad del componente no es válida.';
    end if;

    if coalesce(item->>'unidad', '') not in ('ml', 'g', 'L', 'ml/L', 'g/L') then
      raise exception 'La unidad del componente no es válida.';
    end if;

    if not exists (
      select 1
      from public.productos_cultivo
      where id = v_producto_id
        and usuario_id = usuario
    ) then
      raise exception 'No se puede usar un producto de otro usuario.';
    end if;

    insert into public.receta_componentes (
      receta_id, producto_id, orden, cantidad, unidad
    ) values (
      v_id,
      v_producto_id,
      v_orden,
      round(v_cantidad, 4),
      item->>'unidad'
    );

    v_indice := v_indice + 1;
  end loop;

  return v_id;
end;
$$;

create or replace function public.duplicar_receta_mezcla(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  origen public.recetas_mezcla;
  copia uuid;
  v_nombre text;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  select * into origen
  from public.recetas_mezcla
  where id = p_id
    and usuario_id = usuario;

  if not found then
    raise exception 'No se encontró la receta.';
  end if;

  v_nombre := left(btrim('Copia de ' || origen.nombre), 80);

  insert into public.recetas_mezcla (
    usuario_id, nombre, volumen_agua, unidad_volumen,
    ph, ec, ppm, metodo, etapa, notas, activa
  ) values (
    usuario, v_nombre, origen.volumen_agua, origen.unidad_volumen,
    origen.ph, origen.ec, origen.ppm, origen.metodo, origen.etapa, origen.notas, true
  )
  returning id into copia;

  insert into public.receta_componentes (receta_id, producto_id, orden, cantidad, unidad)
  select copia, producto_id, orden, cantidad, unidad
  from public.receta_componentes
  where receta_id = origen.id;

  return copia;
end;
$$;

create or replace function public.establecer_receta_mezcla_activa(
  p_id uuid,
  p_activa boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if p_activa is null then
    raise exception 'No se encontró la receta.';
  end if;

  update public.recetas_mezcla
  set activa = p_activa
  where id = p_id
    and usuario_id = usuario;

  if not found then
    raise exception 'No se encontró la receta.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. crear_registro / editar_registro
--    Misma firma que registro-fotos.sql, con p_mezcla al final y default null.
--    Se eliminan las firmas anteriores para que PostgREST no las confunda.
-- ---------------------------------------------------------------------------

drop function if exists public.crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb);
drop function if exists public.crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb);
drop function if exists public.editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb);
drop function if exists public.editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb);

create or replace function public.crear_registro(
  p_alcance text,
  p_aplica_a text,
  p_espacio_id uuid,
  p_unidad_cultivo_id uuid,
  p_genetica_clave text,
  p_genetica_etiqueta text,
  p_observacion text,
  p_fecha_evento timestamptz,
  p_plantas jsonb,
  p_acciones jsonb,
  p_parametros jsonb,
  p_fotos jsonb default '[]'::jsonb,
  p_mezcla jsonb default null
)
returns public.registros
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  creado public.registros;
  v_genetica_clave text;
  v_genetica_etiqueta text;
  v_observacion text;
  v_espacio_id uuid := p_espacio_id;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if p_alcance is null or p_alcance not in ('planta', 'plantas', 'genetica', 'unidad', 'espacio') then
    raise exception 'El alcance del registro no es válido.';
  end if;

  if p_aplica_a is null or p_aplica_a not in ('plantas', 'ambiente') then
    raise exception 'El tipo de aplicación no es válido.';
  end if;

  if p_aplica_a = 'ambiente' and p_alcance not in ('unidad', 'espacio') then
    raise exception 'Una medición ambiental requiere unidad o espacio.';
  end if;

  if p_fecha_evento is null then
    raise exception 'La fecha del evento no es válida.';
  end if;

  if p_unidad_cultivo_id is not null and not public.usuario_es_dueno_unidad(p_unidad_cultivo_id, usuario) then
    raise exception 'No se encontró la unidad.';
  end if;

  if v_espacio_id is not null and not public.usuario_es_dueno_espacio(v_espacio_id, usuario) then
    raise exception 'No se encontró el espacio.';
  end if;

  if p_alcance in ('planta', 'plantas', 'genetica', 'unidad') and p_unidad_cultivo_id is null then
    raise exception 'La unidad es obligatoria para este alcance.';
  end if;

  if p_alcance = 'espacio' and v_espacio_id is null then
    raise exception 'El espacio es obligatorio para este alcance.';
  end if;

  if p_unidad_cultivo_id is not null and v_espacio_id is null then
    select espacio_id into v_espacio_id
    from public.unidades_cultivo
    where id = p_unidad_cultivo_id;
  end if;

  if p_alcance = 'genetica' then
    v_genetica_clave := public.normalizar_genetica(p_genetica_clave);
    v_genetica_etiqueta := nullif(btrim(coalesce(p_genetica_etiqueta, '')), '');

    if v_genetica_clave is null or v_genetica_etiqueta is null then
      raise exception 'La genética del grupo no es válida.';
    end if;
  else
    v_genetica_clave := null;
    v_genetica_etiqueta := null;
  end if;

  v_observacion := nullif(btrim(coalesce(p_observacion, '')), '');

  insert into public.registros (
    usuario_id, alcance, aplica_a, espacio_id, unidad_cultivo_id,
    genetica_clave, genetica_etiqueta, observacion, fecha_evento
  ) values (
    usuario, p_alcance, p_aplica_a, v_espacio_id, p_unidad_cultivo_id,
    v_genetica_clave, v_genetica_etiqueta, v_observacion, p_fecha_evento
  )
  returning * into creado;

  perform public.insertar_fotos_registro(creado.id, usuario, coalesce(p_fotos, '[]'::jsonb));

  perform public.insertar_contenido_registro(
    creado.id,
    usuario,
    p_aplica_a,
    coalesce(p_plantas, '[]'::jsonb),
    coalesce(p_acciones, '[]'::jsonb),
    coalesce(p_parametros, '[]'::jsonb)
  );

  perform public.aplicar_mezcla_registro(
    creado.id,
    usuario,
    p_aplica_a,
    coalesce(p_acciones, '[]'::jsonb),
    p_mezcla
  );

  return creado;
end;
$$;

create or replace function public.editar_registro(
  p_registro_id uuid,
  p_alcance text,
  p_aplica_a text,
  p_espacio_id uuid,
  p_unidad_cultivo_id uuid,
  p_genetica_clave text,
  p_genetica_etiqueta text,
  p_observacion text,
  p_fecha_evento timestamptz,
  p_plantas jsonb,
  p_acciones jsonb,
  p_parametros jsonb,
  p_fotos jsonb default '[]'::jsonb,
  p_fotos_quitar jsonb default '[]'::jsonb,
  p_mezcla jsonb default null
)
returns public.registros
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  actual public.registros;
  editado public.registros;
  v_genetica_clave text;
  v_genetica_etiqueta text;
  v_observacion text;
  v_espacio_id uuid := p_espacio_id;
  v_quitar uuid[];
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  select * into actual
  from public.registros
  where id = p_registro_id
    and usuario_id = usuario;

  if not found then
    raise exception 'No se encontró el registro.';
  end if;

  if p_alcance is null or p_alcance not in ('planta', 'plantas', 'genetica', 'unidad', 'espacio') then
    raise exception 'El alcance del registro no es válido.';
  end if;

  if p_aplica_a is null or p_aplica_a not in ('plantas', 'ambiente') then
    raise exception 'El tipo de aplicación no es válido.';
  end if;

  if p_aplica_a = 'ambiente' and p_alcance not in ('unidad', 'espacio') then
    raise exception 'Una medición ambiental requiere unidad o espacio.';
  end if;

  if p_fecha_evento is null then
    raise exception 'La fecha del evento no es válida.';
  end if;

  if p_unidad_cultivo_id is not null and not public.usuario_es_dueno_unidad(p_unidad_cultivo_id, usuario) then
    raise exception 'No se encontró la unidad.';
  end if;

  if v_espacio_id is not null and not public.usuario_es_dueno_espacio(v_espacio_id, usuario) then
    raise exception 'No se encontró el espacio.';
  end if;

  if p_alcance in ('planta', 'plantas', 'genetica', 'unidad') and p_unidad_cultivo_id is null then
    raise exception 'La unidad es obligatoria para este alcance.';
  end if;

  if p_alcance = 'espacio' and v_espacio_id is null then
    raise exception 'El espacio es obligatorio para este alcance.';
  end if;

  if p_unidad_cultivo_id is not null and v_espacio_id is null then
    select espacio_id into v_espacio_id
    from public.unidades_cultivo
    where id = p_unidad_cultivo_id;
  end if;

  if p_alcance = 'genetica' then
    v_genetica_clave := public.normalizar_genetica(p_genetica_clave);
    v_genetica_etiqueta := nullif(btrim(coalesce(p_genetica_etiqueta, '')), '');

    if v_genetica_clave is null or v_genetica_etiqueta is null then
      raise exception 'La genética del grupo no es válida.';
    end if;
  else
    v_genetica_clave := null;
    v_genetica_etiqueta := null;
  end if;

  v_observacion := nullif(btrim(coalesce(p_observacion, '')), '');

  if p_fotos_quitar is null or jsonb_typeof(p_fotos_quitar) <> 'array' then
    raise exception 'Las fotos a quitar no son válidas.';
  end if;

  begin
    select coalesce(array_agg(value::uuid), '{}'::uuid[])
    into v_quitar
    from jsonb_array_elements_text(p_fotos_quitar);
  exception when others then
    raise exception 'Las fotos a quitar no son válidas.';
  end;

  update public.registros
  set
    alcance = p_alcance,
    aplica_a = p_aplica_a,
    espacio_id = v_espacio_id,
    unidad_cultivo_id = p_unidad_cultivo_id,
    genetica_clave = v_genetica_clave,
    genetica_etiqueta = v_genetica_etiqueta,
    observacion = v_observacion,
    fecha_evento = p_fecha_evento,
    fecha_actualizacion = now()
  where id = actual.id
  returning * into editado;

  if array_length(v_quitar, 1) is not null then
    delete from public.registro_fotos
    where registro_id = editado.id
      and usuario_id = usuario
      and id = any (v_quitar);
  end if;

  perform public.insertar_fotos_registro(editado.id, usuario, coalesce(p_fotos, '[]'::jsonb));

  delete from public.registro_plantas where registro_id = editado.id;
  delete from public.registro_acciones where registro_id = editado.id;
  delete from public.registro_parametros where registro_id = editado.id;

  perform public.insertar_contenido_registro(
    editado.id,
    usuario,
    p_aplica_a,
    coalesce(p_plantas, '[]'::jsonb),
    coalesce(p_acciones, '[]'::jsonb),
    coalesce(p_parametros, '[]'::jsonb)
  );

  perform public.aplicar_mezcla_registro(
    editado.id,
    usuario,
    p_aplica_a,
    coalesce(p_acciones, '[]'::jsonb),
    p_mezcla
  );

  return editado;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Permisos
-- ---------------------------------------------------------------------------

revoke all on function public.mezclas_marcar_actualizacion() from public, anon, authenticated;
revoke all on function public.mezclas_numero(jsonb) from public, anon, authenticated;
revoke all on function public.mezcla_difiere_de_origen(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.sincronizar_medicion_mezcla(uuid, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.aplicar_mezcla_registro(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;

revoke all on function public.guardar_producto_cultivo(uuid, text, text, text, text) from public, anon;
revoke all on function public.establecer_producto_cultivo_activo(uuid, boolean) from public, anon;
revoke all on function public.guardar_receta_mezcla(uuid, jsonb) from public, anon;
revoke all on function public.duplicar_receta_mezcla(uuid) from public, anon;
revoke all on function public.establecer_receta_mezcla_activa(uuid, boolean) from public, anon;
revoke all on function public.crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;

grant execute on function public.guardar_producto_cultivo(uuid, text, text, text, text) to authenticated;
grant execute on function public.establecer_producto_cultivo_activo(uuid, boolean) to authenticated;
grant execute on function public.guardar_receta_mezcla(uuid, jsonb) to authenticated;
grant execute on function public.duplicar_receta_mezcla(uuid) to authenticated;
grant execute on function public.establecer_receta_mezcla_activa(uuid, boolean) to authenticated;
grant execute on function public.crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
