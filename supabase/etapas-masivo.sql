-- Cambio masivo de etapas.
-- Reutiliza las reglas de cambiar_etapa_planta por cada planta.
-- Omite plantas que ya tienen la etapa pedida.
-- Se puede volver a ejecutar.

create or replace function public.cambiar_etapa_plantas(
  p_planta_ids uuid[],
  p_etapa text,
  p_fecha date
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  ids uuid[];
  planta_rec record;
  abierta_id uuid;
  abierta_inicio date;
  nuevo_estado text;
  actualizadas int := 0;
  omitidas int := 0;
  total_encontradas int;
begin
  if p_etapa not in ('germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado') then
    raise exception 'Seleccioná una etapa.';
  end if;

  if p_fecha is null then
    raise exception 'La fecha de inicio no es válida.';
  end if;

  select array_agg(distinct x)
  into ids
  from unnest(coalesce(p_planta_ids, array[]::uuid[])) as t(x)
  where x is not null;

  if ids is null or cardinality(ids) = 0 then
    raise exception 'Seleccioná al menos una planta.';
  end if;

  select count(*)
  into total_encontradas
  from public.plantas
  join public.unidades_cultivo on unidades_cultivo.id = plantas.unidad_cultivo_id
  join public.espacios on espacios.id = unidades_cultivo.espacio_id
  where plantas.id = any (ids)
    and espacios.usuario_id = auth.uid();

  if total_encontradas <> cardinality(ids) then
    raise exception 'No se encontró la planta.';
  end if;

  for planta_rec in
    select plantas.id, plantas.etapa
    from public.plantas
    where plantas.id = any (ids)
    order by plantas.numero nulls last, plantas.id
  loop
    if planta_rec.etapa is not distinct from p_etapa then
      omitidas := omitidas + 1;
      continue;
    end if;

    select id, fecha_inicio
    into abierta_id, abierta_inicio
    from public.historial_etapas
    where planta_id = planta_rec.id
      and fecha_fin is null
    order by fecha_creacion desc
    limit 1;

    if abierta_id is not null and abierta_inicio > p_fecha then
      raise exception 'La fecha no puede ser anterior al inicio de la etapa actual.';
    end if;

    if abierta_id is not null then
      update public.historial_etapas
      set fecha_fin = p_fecha
      where id = abierta_id;
    end if;

    insert into public.historial_etapas (planta_id, etapa, fecha_inicio)
    values (planta_rec.id, p_etapa, p_fecha);

    if p_etapa = 'finalizado' then
      nuevo_estado := 'finalizada';
    else
      nuevo_estado := 'activa';
    end if;

    update public.plantas
    set etapa = p_etapa,
        estado = nuevo_estado
    where id = planta_rec.id;

    actualizadas := actualizadas + 1;
  end loop;

  if actualizadas = 0 then
    raise exception 'Ninguna planta necesita cambio.';
  end if;

  return jsonb_build_object(
    'actualizadas', actualizadas,
    'omitidas', omitidas
  );
end;
$$;

grant execute on function public.cambiar_etapa_plantas(uuid[], text, date) to authenticated;
