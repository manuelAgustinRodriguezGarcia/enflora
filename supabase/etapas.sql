-- Historial de etapas.
-- Adapta floracion → enflora y cosecha → secado.
-- No crea filas de historial para plantas que ya existían: no se inventan fechas.
-- Se puede volver a ejecutar.

alter table public.plantas drop constraint if exists plantas_etapa_valida;

update public.plantas
set etapa = case
  when lower(trim(etapa)) in ('floracion', 'floración') then 'enflora'
  when lower(trim(etapa)) = 'cosecha' then 'secado'
  when lower(trim(etapa)) = 'germinación' then 'germinacion'
  when lower(trim(etapa)) in ('plántula', 'plantúla') then 'plantula'
  else etapa
end
where etapa is not null
  and etapa not in ('germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado');

alter table public.plantas
  add constraint plantas_etapa_valida check (
    etapa is null or etapa in ('germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado')
  );

create table if not exists public.historial_etapas (
  id uuid primary key default gen_random_uuid(),
  planta_id uuid not null references public.plantas (id) on delete cascade,
  etapa text not null,
  fecha_inicio date not null,
  fecha_fin date,
  fecha_creacion timestamptz not null default now(),
  constraint historial_etapas_etapa_valida check (
    etapa in ('germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado')
  ),
  constraint historial_etapas_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index if not exists historial_etapas_planta_id_idx
on public.historial_etapas (planta_id);

create unique index if not exists historial_etapas_una_actual
on public.historial_etapas (planta_id)
where fecha_fin is null;

alter table public.historial_etapas enable row level security;

drop policy if exists usuario_gestiona_historial_de_sus_plantas on public.historial_etapas;

create policy usuario_gestiona_historial_de_sus_plantas
on public.historial_etapas
for all
to authenticated
using (
  exists (
    select 1
    from public.plantas
    join public.unidades_cultivo on unidades_cultivo.id = plantas.unidad_cultivo_id
    join public.espacios on espacios.id = unidades_cultivo.espacio_id
    where plantas.id = historial_etapas.planta_id
      and espacios.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.plantas
    join public.unidades_cultivo on unidades_cultivo.id = plantas.unidad_cultivo_id
    join public.espacios on espacios.id = unidades_cultivo.espacio_id
    where plantas.id = historial_etapas.planta_id
      and espacios.usuario_id = auth.uid()
  )
);

grant select, insert, update, delete on public.historial_etapas to authenticated;

create or replace function public.cambiar_etapa_planta(
  p_planta_id uuid,
  p_etapa text,
  p_fecha date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  abierta_id uuid;
  abierta_inicio date;
  nuevo_estado text;
begin
  if p_etapa not in ('germinacion', 'plantula', 'vegetativo', 'enflora', 'secado', 'finalizado') then
    raise exception 'Seleccioná una etapa.';
  end if;

  if p_fecha is null then
    raise exception 'La fecha de inicio no es válida.';
  end if;

  if not exists (select 1 from public.plantas where id = p_planta_id) then
    raise exception 'No se encontró la planta.';
  end if;

  select id, fecha_inicio
  into abierta_id, abierta_inicio
  from public.historial_etapas
  where planta_id = p_planta_id
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
  values (p_planta_id, p_etapa, p_fecha);

  if p_etapa = 'finalizado' then
    nuevo_estado := 'finalizada';
  else
    nuevo_estado := 'activa';
  end if;

  update public.plantas
  set etapa = p_etapa,
      estado = nuevo_estado
  where id = p_planta_id;
end;
$$;

grant execute on function public.cambiar_etapa_planta(uuid, text, date) to authenticated;
