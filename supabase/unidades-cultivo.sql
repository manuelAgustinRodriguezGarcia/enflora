-- Migración del modelo espacio → planta al modelo espacio → unidad → planta.
-- Ejecutar una vez en el SQL Editor si las tablas ya existen.
-- No vuelve a correr esquema.sql.
--
-- Las plantas que apuntaban a un espacio pasan a una sola unidad de ese espacio:
-- Sala si el espacio es interior, Aire libre si es exterior.
-- No se inventan carpas ni una etapa inicial.

create table if not exists public.unidades_cultivo (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios (id) on delete cascade,
  nombre text not null,
  tipo text not null,
  numero integer not null,
  fecha_creacion timestamptz not null default now(),
  constraint unidades_cultivo_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint unidades_cultivo_tipo_valido check (tipo in ('carpa', 'sala', 'invernadero', 'aire_libre')),
  constraint unidades_cultivo_numero_positivo check (numero > 0),
  constraint unidades_cultivo_espacio_numero_unico unique (espacio_id, numero)
);

create index if not exists unidades_cultivo_espacio_id_idx
on public.unidades_cultivo (espacio_id);

alter table public.unidades_cultivo enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'unidades_cultivo'
      and policyname = 'usuario_gestiona_sus_unidades'
  ) then
    create policy usuario_gestiona_sus_unidades
    on public.unidades_cultivo
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.espacios
        where espacios.id = unidades_cultivo.espacio_id
          and espacios.usuario_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.espacios
        where espacios.id = unidades_cultivo.espacio_id
          and espacios.usuario_id = auth.uid()
      )
    );
  end if;
end $$;

grant select, insert, update, delete on public.unidades_cultivo to authenticated;

alter table public.plantas add column if not exists numero integer;
alter table public.plantas add column if not exists metodo text;
alter table public.plantas add column if not exists sustrato text;
alter table public.plantas add column if not exists etapa text;
alter table public.plantas add column if not exists unidad_cultivo_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plantas_numero_positivo'
      and conrelid = 'public.plantas'::regclass
  ) then
    alter table public.plantas
      add constraint plantas_numero_positivo check (numero is null or numero > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plantas_etapa_valida'
      and conrelid = 'public.plantas'::regclass
  ) then
    alter table public.plantas
      add constraint plantas_etapa_valida check (
        etapa is null or etapa in ('germinacion', 'plantula', 'vegetativo', 'floracion', 'cosecha')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plantas_unidad_cultivo_id_fkey'
      and conrelid = 'public.plantas'::regclass
  ) then
    alter table public.plantas
      add constraint plantas_unidad_cultivo_id_fkey
      foreign key (unidad_cultivo_id) references public.unidades_cultivo (id) on delete cascade;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plantas'
      and column_name = 'espacio_id'
  ) then
    insert into public.unidades_cultivo (espacio_id, nombre, tipo, numero)
    select
      e.id,
      case when e.tipo = 'exterior' then 'Aire libre' else 'Sala' end,
      case when e.tipo = 'exterior' then 'aire_libre' else 'sala' end,
      1
    from public.espacios e
    where exists (
      select 1 from public.plantas p where p.espacio_id = e.id
    )
    and not exists (
      select 1 from public.unidades_cultivo u where u.espacio_id = e.id
    );

    update public.plantas p
    set unidad_cultivo_id = u.id
    from public.unidades_cultivo u
    where p.unidad_cultivo_id is null
      and u.espacio_id = p.espacio_id
      and u.numero = 1;

    if exists (select 1 from public.plantas where unidad_cultivo_id is null) then
      raise exception 'Hay plantas sin unidad de cultivo. No se eliminó espacio_id.';
    end if;

    drop policy if exists usuario_gestiona_plantas_de_sus_espacios on public.plantas;
    drop index if exists public.plantas_espacio_numero_idx;
    drop index if exists public.plantas_espacio_id_idx;
    alter table public.plantas drop column espacio_id;
  end if;
end $$;

alter table public.plantas alter column unidad_cultivo_id set not null;

create index if not exists plantas_unidad_cultivo_id_idx
on public.plantas (unidad_cultivo_id);

create unique index if not exists plantas_unidad_numero_idx
on public.plantas (unidad_cultivo_id, numero)
where numero is not null;

drop policy if exists usuario_gestiona_plantas_de_sus_espacios on public.plantas;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'plantas'
      and policyname = 'usuario_gestiona_plantas_de_sus_unidades'
  ) then
    create policy usuario_gestiona_plantas_de_sus_unidades
    on public.plantas
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.unidades_cultivo
        join public.espacios on espacios.id = unidades_cultivo.espacio_id
        where unidades_cultivo.id = plantas.unidad_cultivo_id
          and espacios.usuario_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.unidades_cultivo
        join public.espacios on espacios.id = unidades_cultivo.espacio_id
        where unidades_cultivo.id = plantas.unidad_cultivo_id
          and espacios.usuario_id = auth.uid()
      )
    );
  end if;
end $$;

create or replace function public.unidad_coherente_con_espacio()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  tipo_espacio text;
begin
  select tipo into tipo_espacio from public.espacios where id = new.espacio_id;

  if tipo_espacio = 'interior' and new.tipo not in ('carpa', 'sala', 'otro') then
    raise exception 'Tipo de unidad no válido para un espacio interior.';
  end if;

  if tipo_espacio = 'exterior' and new.tipo not in ('invernadero', 'aire_libre', 'otro') then
    raise exception 'Tipo de unidad no válido para un espacio exterior.';
  end if;

  return new;
end;
$$;

drop trigger if exists unidades_cultivo_tipo_espacio on public.unidades_cultivo;

create trigger unidades_cultivo_tipo_espacio
before insert or update on public.unidades_cultivo
for each row execute function public.unidad_coherente_con_espacio();
