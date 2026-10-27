-- ENFLORA · Tareas programadas (independientes de registros y acciones de cultivo).
-- Aplicar manualmente en el SQL Editor. No ejecutar desde la app.

create table if not exists public.tareas_programadas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  unidad_cultivo_id uuid not null references public.unidades_cultivo (id) on delete cascade,
  descripcion text not null,
  fecha_programada date not null,
  completada boolean not null default false,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint tareas_descripcion_longitud check (
    char_length(trim(descripcion)) >= 1
    and char_length(descripcion) <= 500
  )
);

create table if not exists public.tarea_plantas (
  tarea_id uuid not null references public.tareas_programadas (id) on delete cascade,
  planta_id uuid not null references public.plantas (id) on delete cascade,
  primary key (tarea_id, planta_id)
);

create index if not exists tareas_programadas_unidad_fecha_idx
  on public.tareas_programadas (unidad_cultivo_id, fecha_programada)
  where completada = false;

alter table public.tareas_programadas enable row level security;
alter table public.tarea_plantas enable row level security;

create policy tareas_propias on public.tareas_programadas
  for all
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy tarea_plantas_propias on public.tarea_plantas
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.tareas_programadas t
      where t.id = tarea_id
        and t.usuario_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tareas_programadas t
      where t.id = tarea_id
        and t.usuario_id = auth.uid()
    )
  );

create or replace function public.crear_tarea_programada(
  p_unidad_id uuid,
  p_descripcion text,
  p_fecha date,
  p_planta_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario uuid := auth.uid();
  hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  nueva_id uuid;
  planta_uuid uuid;
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if not public.usuario_es_dueno_unidad(p_unidad_id, usuario) then
    raise exception 'No se encontró la unidad.';
  end if;

  if trim(coalesce(p_descripcion, '')) = '' then
    raise exception 'Escribí la tarea.';
  end if;

  if char_length(trim(p_descripcion)) > 500 then
    raise exception 'La tarea es demasiado larga.';
  end if;

  if p_fecha is null or p_fecha < hoy then
    raise exception 'La fecha no puede ser anterior a hoy.';
  end if;

  insert into public.tareas_programadas (usuario_id, unidad_cultivo_id, descripcion, fecha_programada)
  values (usuario, p_unidad_id, trim(p_descripcion), p_fecha)
  returning id into nueva_id;

  if p_planta_ids is not null then
    foreach planta_uuid in array p_planta_ids loop
      if planta_uuid is null then
        continue;
      end if;
      if not public.usuario_es_dueno_planta(planta_uuid, usuario) then
        raise exception 'Una planta no pertenece a tu cuenta.';
      end if;
      if not exists (
        select 1 from public.plantas p
        where p.id = planta_uuid and p.unidad_cultivo_id = p_unidad_id
      ) then
        raise exception 'Una planta no pertenece a la unidad.';
      end if;
      insert into public.tarea_plantas (tarea_id, planta_id)
      values (nueva_id, planta_uuid)
      on conflict do nothing;
    end loop;
  end if;

  return nueva_id;
end;
$$;

revoke all on function public.crear_tarea_programada(uuid, text, date, uuid[]) from public, anon;
grant execute on function public.crear_tarea_programada(uuid, text, date, uuid[]) to authenticated;

grant select, insert, update, delete on public.tareas_programadas to authenticated;
grant select, insert, delete on public.tarea_plantas to authenticated;
