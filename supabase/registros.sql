create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  alcance text not null,
  aplica_a text not null,
  espacio_id uuid references public.espacios (id) on delete set null,
  unidad_cultivo_id uuid references public.unidades_cultivo (id) on delete set null,
  genetica_clave text,
  genetica_etiqueta text,
  observacion text,
  fecha_evento timestamptz not null,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint registros_alcance_valido check (
    alcance in ('planta', 'plantas', 'genetica', 'unidad', 'espacio')
  ),
  constraint registros_aplica_a_valido check (
    aplica_a in ('plantas', 'ambiente')
  ),
  constraint registros_ambiente_solo_contexto check (
    aplica_a = 'plantas'
    or alcance in ('unidad', 'espacio')
  ),
  constraint registros_genetica_coherente check (
    (
      alcance = 'genetica'
      and genetica_clave is not null
      and char_length(btrim(genetica_clave)) > 0
      and genetica_etiqueta is not null
      and char_length(btrim(genetica_etiqueta)) > 0
    )
    or (
      alcance <> 'genetica'
      and genetica_clave is null
      and genetica_etiqueta is null
    )
  ),
  constraint registros_observacion_larga check (
    observacion is null or char_length(observacion) <= 4000
  )
);

create table if not exists public.registro_plantas (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.registros (id) on delete cascade,
  planta_id uuid references public.plantas (id) on delete set null,
  nombre_planta text not null,
  numero_planta integer,
  genetica_planta text,
  unidad_cultivo_id uuid references public.unidades_cultivo (id) on delete set null,
  nombre_unidad text,
  constraint registro_plantas_nombre_no_vacio check (char_length(btrim(nombre_planta)) > 0),
  constraint registro_plantas_numero_positivo check (numero_planta is null or numero_planta > 0)
);

create unique index if not exists registro_plantas_registro_planta_uidx
on public.registro_plantas (registro_id, planta_id)
where planta_id is not null;

create table if not exists public.registro_acciones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.registros (id) on delete cascade,
  origen text not null,
  clave_nativa text,
  opcion_id uuid references public.opciones_seguimiento_personalizadas (id) on delete set null,
  nombre text not null,
  constraint registro_acciones_origen_valido check (origen in ('nativa', 'personalizada')),
  constraint registro_acciones_nombre_no_vacio check (char_length(btrim(nombre)) > 0),
  constraint registro_acciones_forma_valida check (
    (
      origen = 'nativa'
      and clave_nativa in ('riego', 'foto', 'nota', 'tarea', 'poda', 'fertilizacion')
      and opcion_id is null
    )
    or (
      origen = 'personalizada'
      and clave_nativa is null
      and opcion_id is not null
    )
  )
);

create table if not exists public.registro_parametros (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.registros (id) on delete cascade,
  origen text not null,
  clave_nativa text,
  opcion_id uuid references public.opciones_seguimiento_personalizadas (id) on delete set null,
  nombre text not null,
  tipo_valor text not null,
  valor_numero numeric,
  valor_texto text,
  unidad text,
  constraint registro_parametros_origen_valido check (origen in ('nativa', 'personalizada')),
  constraint registro_parametros_nombre_no_vacio check (char_length(btrim(nombre)) > 0),
  constraint registro_parametros_tipo_valido check (tipo_valor in ('numero', 'texto')),
  constraint registro_parametros_unidad_larga check (
    unidad is null or char_length(btrim(unidad)) <= 16
  ),
  constraint registro_parametros_valor_coherente check (
    (
      tipo_valor = 'numero'
      and valor_numero is not null
      and valor_texto is null
    )
    or (
      tipo_valor = 'texto'
      and valor_texto is not null
      and char_length(btrim(valor_texto)) > 0
      and valor_numero is null
    )
  ),
  constraint registro_parametros_forma_valida check (
    (
      origen = 'nativa'
      and clave_nativa in ('ph', 'ec', 'ppm', 'temperatura', 'humedad', 'vpd')
      and opcion_id is null
    )
    or (
      origen = 'personalizada'
      and clave_nativa is null
      and opcion_id is not null
    )
  )
);

create index if not exists registros_usuario_fecha_idx
on public.registros (usuario_id, fecha_evento desc);

create index if not exists registros_unidad_fecha_idx
on public.registros (unidad_cultivo_id, fecha_evento desc)
where unidad_cultivo_id is not null;

create index if not exists registros_espacio_fecha_idx
on public.registros (espacio_id, fecha_evento desc)
where espacio_id is not null;

create index if not exists registros_genetica_clave_idx
on public.registros (usuario_id, genetica_clave)
where genetica_clave is not null;

create index if not exists registro_plantas_registro_id_idx
on public.registro_plantas (registro_id);

create index if not exists registro_plantas_planta_id_idx
on public.registro_plantas (planta_id)
where planta_id is not null;

create index if not exists registro_acciones_registro_id_idx
on public.registro_acciones (registro_id);

create index if not exists registro_acciones_clave_nativa_idx
on public.registro_acciones (clave_nativa)
where clave_nativa is not null;

create index if not exists registro_parametros_registro_id_idx
on public.registro_parametros (registro_id);

create index if not exists registro_parametros_clave_nativa_idx
on public.registro_parametros (clave_nativa)
where clave_nativa is not null;

alter table public.registros enable row level security;
alter table public.registro_plantas enable row level security;
alter table public.registro_acciones enable row level security;
alter table public.registro_parametros enable row level security;

drop policy if exists usuario_gestiona_sus_registros on public.registros;
create policy usuario_gestiona_sus_registros
on public.registros
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

drop policy if exists usuario_gestiona_plantas_de_sus_registros on public.registro_plantas;
create policy usuario_gestiona_plantas_de_sus_registros
on public.registro_plantas
for all
to authenticated
using (
  exists (
    select 1
    from public.registros
    where registros.id = registro_plantas.registro_id
      and registros.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.registros
    where registros.id = registro_plantas.registro_id
      and registros.usuario_id = auth.uid()
  )
);

drop policy if exists usuario_gestiona_acciones_de_sus_registros on public.registro_acciones;
create policy usuario_gestiona_acciones_de_sus_registros
on public.registro_acciones
for all
to authenticated
using (
  exists (
    select 1
    from public.registros
    where registros.id = registro_acciones.registro_id
      and registros.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.registros
    where registros.id = registro_acciones.registro_id
      and registros.usuario_id = auth.uid()
  )
);

drop policy if exists usuario_gestiona_parametros_de_sus_registros on public.registro_parametros;
create policy usuario_gestiona_parametros_de_sus_registros
on public.registro_parametros
for all
to authenticated
using (
  exists (
    select 1
    from public.registros
    where registros.id = registro_parametros.registro_id
      and registros.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.registros
    where registros.id = registro_parametros.registro_id
      and registros.usuario_id = auth.uid()
  )
);

grant select, insert, update, delete on public.registros to authenticated;
grant select, insert, update, delete on public.registro_plantas to authenticated;
grant select, insert, update, delete on public.registro_acciones to authenticated;
grant select, insert, update, delete on public.registro_parametros to authenticated;

create or replace function public.normalizar_genetica(valor text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(coalesce(valor, ''))), '');
$$;

create or replace function public.usuario_es_dueno_espacio(p_espacio_id uuid, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.espacios
    where id = p_espacio_id
      and usuario_id = p_usuario
  );
$$;

create or replace function public.usuario_es_dueno_unidad(p_unidad_id uuid, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.unidades_cultivo
    join public.espacios on espacios.id = unidades_cultivo.espacio_id
    where unidades_cultivo.id = p_unidad_id
      and espacios.usuario_id = p_usuario
  );
$$;

create or replace function public.usuario_es_dueno_planta(p_planta_id uuid, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.plantas
    join public.unidades_cultivo on unidades_cultivo.id = plantas.unidad_cultivo_id
    join public.espacios on espacios.id = unidades_cultivo.espacio_id
    where plantas.id = p_planta_id
      and espacios.usuario_id = p_usuario
  );
$$;

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
     ))) < 1 then
    raise exception 'El registro necesita una acción, un parámetro o una observación.';
  end if;
end;
$$;

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
  p_parametros jsonb
)
returns public.registros
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  creado public.registros;
  genetica_clave text;
  genetica_etiqueta text;
  observacion text;
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

  if p_espacio_id is not null and not public.usuario_es_dueno_espacio(p_espacio_id, usuario) then
    raise exception 'No se encontró el espacio.';
  end if;

  if p_alcance in ('planta', 'plantas', 'genetica', 'unidad') and p_unidad_cultivo_id is null then
    raise exception 'La unidad es obligatoria para este alcance.';
  end if;

  if p_alcance = 'espacio' and p_espacio_id is null then
    raise exception 'El espacio es obligatorio para este alcance.';
  end if;

  if p_unidad_cultivo_id is not null and p_espacio_id is null then
    select espacio_id
    into p_espacio_id
    from public.unidades_cultivo
    where id = p_unidad_cultivo_id;
  end if;

  if p_alcance = 'genetica' then
    genetica_clave := public.normalizar_genetica(p_genetica_clave);
    genetica_etiqueta := nullif(btrim(coalesce(p_genetica_etiqueta, '')), '');

    if genetica_clave is null or genetica_etiqueta is null then
      raise exception 'La genética del grupo no es válida.';
    end if;
  else
    genetica_clave := null;
    genetica_etiqueta := null;
  end if;

  observacion := nullif(btrim(coalesce(p_observacion, '')), '');

  insert into public.registros (
    usuario_id,
    alcance,
    aplica_a,
    espacio_id,
    unidad_cultivo_id,
    genetica_clave,
    genetica_etiqueta,
    observacion,
    fecha_evento
  ) values (
    usuario,
    p_alcance,
    p_aplica_a,
    p_espacio_id,
    p_unidad_cultivo_id,
    genetica_clave,
    genetica_etiqueta,
    observacion,
    p_fecha_evento
  )
  returning * into creado;

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
  p_parametros jsonb
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
  genetica_clave text;
  genetica_etiqueta text;
  observacion text;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  select *
  into actual
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

  if p_espacio_id is not null and not public.usuario_es_dueno_espacio(p_espacio_id, usuario) then
    raise exception 'No se encontró el espacio.';
  end if;

  if p_alcance in ('planta', 'plantas', 'genetica', 'unidad') and p_unidad_cultivo_id is null then
    raise exception 'La unidad es obligatoria para este alcance.';
  end if;

  if p_alcance = 'espacio' and p_espacio_id is null then
    raise exception 'El espacio es obligatorio para este alcance.';
  end if;

  if p_unidad_cultivo_id is not null and p_espacio_id is null then
    select espacio_id
    into p_espacio_id
    from public.unidades_cultivo
    where id = p_unidad_cultivo_id;
  end if;

  if p_alcance = 'genetica' then
    genetica_clave := public.normalizar_genetica(p_genetica_clave);
    genetica_etiqueta := nullif(btrim(coalesce(p_genetica_etiqueta, '')), '');

    if genetica_clave is null or genetica_etiqueta is null then
      raise exception 'La genética del grupo no es válida.';
    end if;
  else
    genetica_clave := null;
    genetica_etiqueta := null;
  end if;

  observacion := nullif(btrim(coalesce(p_observacion, '')), '');

  update public.registros
  set
    alcance = p_alcance,
    aplica_a = p_aplica_a,
    espacio_id = p_espacio_id,
    unidad_cultivo_id = p_unidad_cultivo_id,
    genetica_clave = genetica_clave,
    genetica_etiqueta = genetica_etiqueta,
    observacion = observacion,
    fecha_evento = p_fecha_evento,
    fecha_actualizacion = now()
  where id = actual.id
  returning * into editado;

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

create or replace function public.eliminar_registro(p_registro_id uuid)
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

  delete from public.registros
  where id = p_registro_id
    and usuario_id = usuario;

  if not found then
    raise exception 'No se encontró el registro.';
  end if;
end;
$$;

revoke all on function public.normalizar_genetica(text) from public, anon;
revoke all on function public.usuario_es_dueno_espacio(uuid, uuid) from public, anon, authenticated;
revoke all on function public.usuario_es_dueno_unidad(uuid, uuid) from public, anon, authenticated;
revoke all on function public.usuario_es_dueno_planta(uuid, uuid) from public, anon, authenticated;
revoke all on function public.insertar_contenido_registro(uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.eliminar_registro(uuid) from public, anon;

grant execute on function public.normalizar_genetica(text) to authenticated;
grant execute on function public.crear_registro(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.editar_registro(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.eliminar_registro(uuid) to authenticated;
