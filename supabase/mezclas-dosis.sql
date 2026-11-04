-- ENFLORA · Dosis de mezclas.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase, DESPUÉS de supabase/mezclas.sql.
-- Es idempotente. No borra tablas, filas ni usa DROP CASCADE.
--
-- Qué agrega:
--   1. Unidades gotas y gotas/L, sin convertir gotas a mililitros.
--   2. Volumen de agua opcional en el snapshot del riego.
--      Si no hay litros, la dosis queda guardada con la unidad que eligió el usuario.
--   3. Las recetas siguen exigiendo volumen. Los riegos viejos no se reescriben.
--
-- Editar una receta sigue tocando solo recetas_mezcla y receta_componentes.

alter table public.receta_componentes drop constraint if exists receta_componentes_unidad_valida;
alter table public.receta_componentes
  add constraint receta_componentes_unidad_valida
  check (unidad in ('ml', 'g', 'L', 'gotas', 'ml/L', 'g/L', 'gotas/L'));

alter table public.registro_mezclas alter column volumen_agua drop not null;

alter table public.registro_mezclas drop constraint if exists registro_mezclas_volumen_valido;
alter table public.registro_mezclas
  add constraint registro_mezclas_volumen_valido
  check (volumen_agua is null or (volumen_agua > 0 and volumen_agua <= 1000000));

alter table public.registro_mezcla_componentes drop constraint if exists registro_mezcla_componentes_unidad_aplicada_valida;
alter table public.registro_mezcla_componentes
  add constraint registro_mezcla_componentes_unidad_aplicada_valida
  check (unidad_aplicada in ('ml', 'g', 'L', 'gotas', 'ml/L', 'g/L', 'gotas/L'));

alter table public.registro_mezcla_componentes drop constraint if exists registro_mezcla_componentes_unidad_receta_valida;
alter table public.registro_mezcla_componentes
  add constraint registro_mezcla_componentes_unidad_receta_valida
  check (unidad_receta in ('ml', 'g', 'L', 'gotas', 'ml/L', 'g/L', 'gotas/L'));

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

  v_unidad_volumen := coalesce(nullif(btrim(coalesce(p_mezcla->>'unidad_volumen', '')), ''), 'L');
  if v_unidad_volumen not in ('L', 'ml') then
    raise exception 'El volumen de la mezcla no es válido.';
  end if;

  if p_mezcla->'volumen_agua' is null or jsonb_typeof(p_mezcla->'volumen_agua') = 'null' then
    v_volumen := null;
    v_litros := null;
  else
    v_volumen := public.mezclas_numero(p_mezcla->'volumen_agua');
    if v_volumen is null
       or v_volumen <= 0
       or v_volumen > 1000000 then
      raise exception 'El volumen de la mezcla no es válido.';
    end if;
    v_volumen := round(v_volumen, 4);
    v_litros := case when v_unidad_volumen = 'L' then v_volumen else v_volumen / 1000 end;
  end if;

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
      raise exception 'No se puede usar una mezcla de otro usuario.';
    end if;
  end if;

  v_componentes := coalesce(p_mezcla->'componentes', '[]'::jsonb);
  if jsonb_typeof(v_componentes) <> 'array' or jsonb_array_length(v_componentes) > 24 then
    raise exception 'Hay un componente de mezcla que no es válido.';
  end if;

  if v_volumen is null and jsonb_array_length(v_componentes) < 1 then
    raise exception 'El volumen de la mezcla no es válido.';
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
      if coalesce(item->>'unidad', '') not in ('ml', 'g', 'L', 'gotas', 'ml/L', 'g/L', 'gotas/L')
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

    if v_unidad = 'ml/L' and v_litros is not null then
      v_aplicada := round(v_cantidad * v_litros, 4);
      v_unidad_aplicada := 'ml';
    elsif v_unidad = 'g/L' and v_litros is not null then
      v_aplicada := round(v_cantidad * v_litros, 4);
      v_unidad_aplicada := 'g';
    elsif v_unidad = 'gotas/L' and v_litros is not null then
      v_aplicada := round(v_cantidad * v_litros, 4);
      v_unidad_aplicada := 'gotas';
    elsif v_unidad in ('ml', 'g', 'L', 'gotas', 'ml/L', 'g/L', 'gotas/L') then
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
    raise exception 'El nombre de la mezcla es obligatorio.';
  end if;

  v_volumen := public.mezclas_numero(p_datos->'volumen_agua');
  v_unidad := p_datos->>'unidad_volumen';
  if v_volumen is null or v_volumen <= 0 or v_volumen > 1000000 or v_unidad not in ('L', 'ml') then
    raise exception 'La mezcla necesita un volumen de agua.';
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
    raise exception 'Las observaciones de la mezcla son demasiado largas.';
  end if;

  v_componentes := p_datos->'componentes';
  if v_componentes is null
     or jsonb_typeof(v_componentes) <> 'array'
     or jsonb_array_length(v_componentes) < 1
     or jsonb_array_length(v_componentes) > 24 then
    raise exception 'La mezcla necesita al menos un componente.';
  end if;

  if v_id is not null then
    select usuario_id into v_dueno
    from public.recetas_mezcla
    where id = v_id;

    if v_dueno is null or v_dueno <> usuario then
      raise exception 'No se encontró la mezcla.';
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

    if coalesce(item->>'unidad', '') not in ('ml', 'g', 'L', 'gotas', 'ml/L', 'g/L', 'gotas/L') then
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
