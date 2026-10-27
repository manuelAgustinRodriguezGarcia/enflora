-- ENFLORA · Sprint 1.5 · Fotografías privadas en registros y portadas de unidades.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Debe aplicarse A MANO en el SQL Editor de Supabase, DESPUÉS de supabase/registros.sql
-- y supabase/unidades-cultivo.sql. Es idempotente: se puede correr más de una vez.
--
-- Qué cambia:
--   1. Bucket privado `enflora-fotos` (JPG, PNG, WEBP · máx. 5 MB por archivo).
--   2. Políticas RLS sobre storage.objects: cada usuario solo opera dentro de `<su uuid>/`.
--   3. Tabla public.registro_fotos (una fila por foto, ligada al REGISTRO, nunca a cada planta).
--   4. Columnas portada_ruta / portada_miniatura en public.unidades_cultivo.
--   5. insertar_contenido_registro: un registro puede tener SOLO fotos.
--   6. crear_registro / editar_registro reciben fotos nuevas y fotos a quitar (misma transacción).
--   7. RPC establecer_portada_unidad / quitar_portada_unidad.
--
-- Qué NO cambia: los registros, acciones y parámetros existentes no se tocan. Las acciones
-- históricas `foto` y `nota` siguen siendo válidas en registro_acciones y en las preferencias.
-- No se desactiva RLS en ninguna tabla.

-- ---------------------------------------------------------------------------
-- 1. Bucket privado
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'enflora-fotos',
  'enflora-fotos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Políticas de Storage: solo la carpeta propia (`<auth.uid()>/...`)
--    Sin política de UPDATE: los archivos no se sobrescriben, se crean con rutas nuevas.
-- ---------------------------------------------------------------------------

drop policy if exists enflora_fotos_lee_propias on storage.objects;
create policy enflora_fotos_lee_propias
on storage.objects
for select
to authenticated
using (
  bucket_id = 'enflora-fotos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists enflora_fotos_sube_propias on storage.objects;
create policy enflora_fotos_sube_propias
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'enflora-fotos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists enflora_fotos_borra_propias on storage.objects;
create policy enflora_fotos_borra_propias
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'enflora-fotos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- 3. Tabla de fotos de registros
-- ---------------------------------------------------------------------------

create table if not exists public.registro_fotos (
  id uuid primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  registro_id uuid not null references public.registros (id) on delete cascade,
  ruta text not null,
  ruta_miniatura text not null,
  tipo_mime text not null,
  tamano_bytes integer not null,
  ancho integer,
  alto integer,
  orden integer not null default 0,
  descripcion text,
  fecha_creacion timestamptz not null default now(),
  constraint registro_fotos_ruta_unica unique (ruta),
  constraint registro_fotos_mime_valido check (
    tipo_mime in ('image/jpeg', 'image/png', 'image/webp')
  ),
  constraint registro_fotos_tamano_valido check (
    tamano_bytes > 0 and tamano_bytes <= 5242880
  ),
  constraint registro_fotos_dimensiones_validas check (
    (ancho is null or (ancho > 0 and ancho <= 10000))
    and (alto is null or (alto > 0 and alto <= 10000))
  ),
  constraint registro_fotos_descripcion_larga check (
    descripcion is null or char_length(descripcion) <= 200
  )
);

create index if not exists registro_fotos_registro_idx
on public.registro_fotos (registro_id, orden);

create index if not exists registro_fotos_usuario_idx
on public.registro_fotos (usuario_id);

alter table public.registro_fotos enable row level security;

-- Solo lectura directa. Las altas y bajas pasan por crear_registro / editar_registro,
-- que validan pertenencia, rutas y existencia del archivo.
drop policy if exists usuario_lee_fotos_de_sus_registros on public.registro_fotos;
create policy usuario_lee_fotos_de_sus_registros
on public.registro_fotos
for select
to authenticated
using (auth.uid() = usuario_id);

revoke all on table public.registro_fotos from anon, authenticated;
grant select on table public.registro_fotos to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Portada de unidades de cultivo
-- ---------------------------------------------------------------------------

alter table public.unidades_cultivo add column if not exists portada_ruta text;
alter table public.unidades_cultivo add column if not exists portada_miniatura text;

-- ---------------------------------------------------------------------------
-- 5. Validación e inserción de fotos de un registro
-- ---------------------------------------------------------------------------

create or replace function public.insertar_fotos_registro(
  p_registro_id uuid,
  p_usuario uuid,
  p_fotos jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  foto_uuid uuid;
  v_ruta text;
  v_miniatura text;
  v_orden integer;
  v_total integer;
begin
  if p_fotos is null or jsonb_typeof(p_fotos) <> 'array' then
    raise exception 'Las fotos del registro no son válidas.';
  end if;

  select coalesce(max(orden), -1) + 1
  into v_orden
  from public.registro_fotos
  where registro_id = p_registro_id;

  for item in select value from jsonb_array_elements(p_fotos)
  loop
    begin
      foto_uuid := nullif(item->>'id', '')::uuid;
    exception when others then
      raise exception 'Hay una foto con identificador inválido.';
    end;

    if foto_uuid is null then
      raise exception 'Hay una foto con identificador inválido.';
    end if;

    if exists (select 1 from public.registro_fotos where id = foto_uuid) then
      raise exception 'Las fotos ya fueron guardadas.';
    end if;

    v_ruta := item->>'ruta';
    v_miniatura := item->>'ruta_miniatura';

    -- La ruta debe ser exactamente <usuario>/registros/<foto>.<ext> (y _m para la miniatura).
    if v_ruta is null
       or v_ruta !~ ('^' || p_usuario::text || '/registros/' || foto_uuid::text || '\.(webp|jpg|png)$')
       or v_miniatura is null
       or v_miniatura !~ ('^' || p_usuario::text || '/registros/' || foto_uuid::text || '_m\.(webp|jpg|png)$')
    then
      raise exception 'La ruta de una foto no es válida.';
    end if;

    if coalesce(item->>'tipo_mime', '') not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Hay una foto con un formato no permitido.';
    end if;

    if coalesce((item->>'tamano_bytes')::integer, 0) < 1
       or (item->>'tamano_bytes')::integer > 5242880 then
      raise exception 'Hay una foto que supera el tamaño permitido.';
    end if;

    -- Los dos archivos tienen que existir de verdad en el bucket.
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'enflora-fotos' and name = v_ruta
    ) or not exists (
      select 1 from storage.objects
      where bucket_id = 'enflora-fotos' and name = v_miniatura
    ) then
      raise exception 'No se encontró el archivo de una foto.';
    end if;

    insert into public.registro_fotos (
      id, usuario_id, registro_id, ruta, ruta_miniatura,
      tipo_mime, tamano_bytes, ancho, alto, orden, descripcion
    ) values (
      foto_uuid,
      p_usuario,
      p_registro_id,
      v_ruta,
      v_miniatura,
      item->>'tipo_mime',
      (item->>'tamano_bytes')::integer,
      nullif(item->>'ancho', '')::integer,
      nullif(item->>'alto', '')::integer,
      v_orden,
      nullif(btrim(coalesce(item->>'descripcion', '')), '')
    );

    v_orden := v_orden + 1;
  end loop;

  select count(*) into v_total from public.registro_fotos where registro_id = p_registro_id;
  if v_total > 3 then
    raise exception 'Un registro admite hasta 3 fotos.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. insertar_contenido_registro: acepta registros con SOLO fotos
--    (cuerpo idéntico al de supabase/registros.sql; solo cambia la última validación)
-- ---------------------------------------------------------------------------

create or replace function public.insertar_contenido_registro(
  p_registro_id uuid,
  p_usuario uuid,
  p_aplica_a text,
  p_plantas jsonb,
  p_acciones jsonb,
  p_parametros jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  planta_uuid uuid;
  opcion_uuid uuid;
  origen text;
  tipo_valor text;
  cantidad_plantas integer := 0;
begin
  if p_plantas is null or jsonb_typeof(p_plantas) <> 'array' then
    raise exception 'Las plantas del registro no son válidas.';
  end if;

  if p_acciones is null or jsonb_typeof(p_acciones) <> 'array' then
    raise exception 'Las acciones del registro no son válidas.';
  end if;

  if p_parametros is null or jsonb_typeof(p_parametros) <> 'array' then
    raise exception 'Los parámetros del registro no son válidos.';
  end if;

  for item in select value from jsonb_array_elements(p_plantas)
  loop
    planta_uuid := nullif(item->>'id', '')::uuid;

    if planta_uuid is null then
      raise exception 'Hay una planta sin identificador.';
    end if;

    if not public.usuario_es_dueno_planta(planta_uuid, p_usuario) then
      raise exception 'No se puede asociar una planta de otro usuario.';
    end if;

    if char_length(btrim(coalesce(item->>'nombre', ''))) < 1 then
      raise exception 'El nombre de la planta es obligatorio.';
    end if;

    insert into public.registro_plantas (
      registro_id,
      planta_id,
      nombre_planta,
      numero_planta,
      genetica_planta,
      unidad_cultivo_id,
      nombre_unidad
    ) values (
      p_registro_id,
      planta_uuid,
      btrim(item->>'nombre'),
      nullif(item->>'numero', '')::integer,
      nullif(btrim(coalesce(item->>'genetica', '')), ''),
      nullif(item->>'unidad_cultivo_id', '')::uuid,
      nullif(btrim(coalesce(item->>'nombre_unidad', '')), '')
    );

    cantidad_plantas := cantidad_plantas + 1;
  end loop;

  if p_aplica_a = 'plantas' and cantidad_plantas < 1 then
    raise exception 'Seleccioná al menos una planta.';
  end if;

  if p_aplica_a = 'ambiente' and cantidad_plantas > 0 then
    raise exception 'Una medición ambiental no asocia plantas.';
  end if;

  for item in select value from jsonb_array_elements(p_acciones)
  loop
    origen := item->>'origen';

    if origen = 'nativa' then
      if coalesce(item->>'clave_nativa', '') not in (
        'riego', 'foto', 'nota', 'tarea', 'poda', 'fertilizacion'
      ) then
        raise exception 'Hay una acción que no es válida.';
      end if;

      if char_length(btrim(coalesce(item->>'nombre', ''))) < 1 then
        raise exception 'El nombre de la acción es obligatorio.';
      end if;

      insert into public.registro_acciones (
        registro_id,
        origen,
        clave_nativa,
        opcion_id,
        nombre
      ) values (
        p_registro_id,
        'nativa',
        item->>'clave_nativa',
        null,
        btrim(item->>'nombre')
      );
    elsif origen = 'personalizada' then
      opcion_uuid := nullif(item->>'opcion_id', '')::uuid;

      if opcion_uuid is null then
        raise exception 'Hay una acción personalizada sin identificador.';
      end if;

      if not exists (
        select 1
        from public.opciones_seguimiento_personalizadas
        where id = opcion_uuid
          and usuario_id = p_usuario
          and categoria = 'accion'
      ) then
        raise exception 'No se puede usar una opción de otro usuario.';
      end if;

      if char_length(btrim(coalesce(item->>'nombre', ''))) < 1 then
        raise exception 'El nombre de la acción es obligatorio.';
      end if;

      insert into public.registro_acciones (
        registro_id,
        origen,
        clave_nativa,
        opcion_id,
        nombre
      ) values (
        p_registro_id,
        'personalizada',
        null,
        opcion_uuid,
        btrim(item->>'nombre')
      );
    else
      raise exception 'Hay una acción que no es válida.';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_parametros)
  loop
    origen := item->>'origen';
    tipo_valor := item->>'tipo_valor';

    if tipo_valor is null or tipo_valor not in ('numero', 'texto') then
      raise exception 'Hay un parámetro con tipo inválido.';
    end if;

    if origen = 'nativa' then
      if coalesce(item->>'clave_nativa', '') not in (
        'ph', 'ec', 'ppm', 'temperatura', 'humedad', 'vpd'
      ) then
        raise exception 'Hay un parámetro que no es válido.';
      end if;

      if char_length(btrim(coalesce(item->>'nombre', ''))) < 1 then
        raise exception 'El nombre del parámetro es obligatorio.';
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
        item->>'clave_nativa',
        null,
        btrim(item->>'nombre'),
        tipo_valor,
        case
          when tipo_valor = 'numero' then (item->>'valor_numero')::numeric
          else null
        end,
        case
          when tipo_valor = 'texto' then nullif(btrim(coalesce(item->>'valor_texto', '')), '')
          else null
        end,
        nullif(btrim(coalesce(item->>'unidad', '')), '')
      );
    elsif origen = 'personalizada' then
      opcion_uuid := nullif(item->>'opcion_id', '')::uuid;

      if opcion_uuid is null then
        raise exception 'Hay un parámetro personalizado sin identificador.';
      end if;

      if not exists (
        select 1
        from public.opciones_seguimiento_personalizadas
        where id = opcion_uuid
          and usuario_id = p_usuario
          and categoria = 'parametro'
      ) then
        raise exception 'No se puede usar una opción de otro usuario.';
      end if;

      if char_length(btrim(coalesce(item->>'nombre', ''))) < 1 then
        raise exception 'El nombre del parámetro es obligatorio.';
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
        'personalizada',
        null,
        opcion_uuid,
        btrim(item->>'nombre'),
        tipo_valor,
        case
          when tipo_valor = 'numero' then (item->>'valor_numero')::numeric
          else null
        end,
        case
          when tipo_valor = 'texto' then nullif(btrim(coalesce(item->>'valor_texto', '')), '')
          else null
        end,
        nullif(btrim(coalesce(item->>'unidad', '')), '')
      );
    else
      raise exception 'Hay un parámetro que no es válido.';
    end if;
  end loop;

  if jsonb_array_length(p_acciones) = 0
     and jsonb_array_length(p_parametros) = 0
     and char_length(btrim(coalesce(
       (select observacion from public.registros where id = p_registro_id),
       ''
     ))) < 1
     and not exists (
       select 1 from public.registro_fotos where registro_id = p_registro_id
     ) then
    raise exception 'El registro necesita una acción, un parámetro, una observación o una foto.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. crear_registro / editar_registro con fotos
--    Se eliminan las firmas anteriores para evitar sobrecargas ambiguas en PostgREST.
-- ---------------------------------------------------------------------------

drop function if exists public.crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb);
drop function if exists public.editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb);

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
  p_fotos jsonb default '[]'::jsonb
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

  -- Primero las fotos: la validación de contenido las tiene en cuenta.
  perform public.insertar_fotos_registro(creado.id, usuario, coalesce(p_fotos, '[]'::jsonb));

  perform public.insertar_contenido_registro(
    creado.id,
    usuario,
    p_aplica_a,
    coalesce(p_plantas, '[]'::jsonb),
    coalesce(p_acciones, '[]'::jsonb),
    coalesce(p_parametros, '[]'::jsonb)
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
  p_fotos_quitar jsonb default '[]'::jsonb
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

  -- Las fotos NO se tocan salvo que se pidan explícitamente: ni quitar ni agregar
  -- borra el resto de las asociaciones fotográficas.
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

  return editado;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Portada de unidad
--    Devuelve las rutas anteriores para que la app borre los archivos DESPUÉS de
--    confirmar el guardado de la nueva portada.
-- ---------------------------------------------------------------------------

create or replace function public.establecer_portada_unidad(
  p_unidad_id uuid,
  p_ruta text,
  p_miniatura text
)
returns table (ruta_anterior text, miniatura_anterior text)
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  v_anterior_ruta text;
  v_anterior_miniatura text;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if not public.usuario_es_dueno_unidad(p_unidad_id, usuario) then
    raise exception 'No se encontró la unidad.';
  end if;

  if p_ruta is null
     or p_ruta !~ ('^' || usuario::text || '/portadas/' || p_unidad_id::text || '/[0-9a-f-]{36}\.(webp|jpg|png)$')
     or p_miniatura is null
     or p_miniatura !~ ('^' || usuario::text || '/portadas/' || p_unidad_id::text || '/[0-9a-f-]{36}_m\.(webp|jpg|png)$')
  then
    raise exception 'La ruta de la portada no es válida.';
  end if;

  if not exists (
    select 1 from storage.objects where bucket_id = 'enflora-fotos' and name = p_ruta
  ) or not exists (
    select 1 from storage.objects where bucket_id = 'enflora-fotos' and name = p_miniatura
  ) then
    raise exception 'No se encontró el archivo de la portada.';
  end if;

  select portada_ruta, portada_miniatura
  into v_anterior_ruta, v_anterior_miniatura
  from public.unidades_cultivo
  where id = p_unidad_id;

  update public.unidades_cultivo
  set portada_ruta = p_ruta,
      portada_miniatura = p_miniatura
  where id = p_unidad_id;

  return query select v_anterior_ruta, v_anterior_miniatura;
end;
$$;

create or replace function public.quitar_portada_unidad(p_unidad_id uuid)
returns table (ruta_anterior text, miniatura_anterior text)
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  v_anterior_ruta text;
  v_anterior_miniatura text;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if not public.usuario_es_dueno_unidad(p_unidad_id, usuario) then
    raise exception 'No se encontró la unidad.';
  end if;

  select portada_ruta, portada_miniatura
  into v_anterior_ruta, v_anterior_miniatura
  from public.unidades_cultivo
  where id = p_unidad_id;

  update public.unidades_cultivo
  set portada_ruta = null,
      portada_miniatura = null
  where id = p_unidad_id;

  return query select v_anterior_ruta, v_anterior_miniatura;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Permisos
-- ---------------------------------------------------------------------------

revoke all on function public.insertar_fotos_registro(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.insertar_contenido_registro(uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.establecer_portada_unidad(uuid, text, text) from public, anon;
revoke all on function public.quitar_portada_unidad(uuid) from public, anon;

grant execute on function public.crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.establecer_portada_unidad(uuid, text, text) to authenticated;
grant execute on function public.quitar_portada_unidad(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Archivos huérfanos (SOLO CONSULTA, no borra nada)
--     Archivos del bucket sin fila en registro_fotos ni portada vigente, con más de 1 día.
--     Se limpian con scripts/limpiar-fotos-huerfanas.mjs (modo --aplicar) o desde el panel.
-- ---------------------------------------------------------------------------
--
-- select o.name, o.created_at
-- from storage.objects o
-- where o.bucket_id = 'enflora-fotos'
--   and o.created_at < now() - interval '1 day'
--   and not exists (
--     select 1 from public.registro_fotos f
--     where f.ruta = o.name or f.ruta_miniatura = o.name
--   )
--   and not exists (
--     select 1 from public.unidades_cultivo u
--     where u.portada_ruta = o.name or u.portada_miniatura = o.name
--   );
