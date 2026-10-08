create table public.espacios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null,
  fecha_creacion timestamptz not null default now(),
  constraint espacios_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint espacios_tipo_valido check (tipo in ('interior', 'exterior'))
);

create table public.unidades_cultivo (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios (id) on delete cascade,
  nombre text not null,
  tipo text not null,
  tipo_personalizado text,
  numero integer not null,
  fecha_creacion timestamptz not null default now(),
  constraint unidades_cultivo_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint unidades_cultivo_tipo_valido check (tipo in ('carpa', 'sala', 'invernadero', 'aire_libre', 'otro')),
  constraint unidades_cultivo_tipo_personalizado check (
    (tipo = 'otro' and tipo_personalizado is not null and char_length(trim(tipo_personalizado)) > 0)
    or (tipo <> 'otro' and tipo_personalizado is null)
  ),
  constraint unidades_cultivo_numero_positivo check (numero > 0),
  constraint unidades_cultivo_espacio_numero_unico unique (espacio_id, numero)
);

create table public.plantas (
  id uuid primary key default gen_random_uuid(),
  unidad_cultivo_id uuid not null references public.unidades_cultivo (id) on delete cascade,
  numero integer,
  nombre text not null,
  genetica text,
  metodo text,
  sustrato text,
  etapa text,
  fecha_inicio date,
  estado text not null default 'activa',
  fecha_creacion timestamptz not null default now(),
  constraint plantas_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint plantas_estado_valido check (estado in ('activa', 'finalizada')),
  constraint plantas_numero_positivo check (numero is null or numero > 0),
  constraint plantas_etapa_valida check (
    etapa is null or etapa in ('germinacion', 'plantula', 'vegetativo', 'floracion', 'cosecha')
  )
);

create index espacios_usuario_id_idx on public.espacios (usuario_id);
create index unidades_cultivo_espacio_id_idx on public.unidades_cultivo (espacio_id);
create index plantas_unidad_cultivo_id_idx on public.plantas (unidad_cultivo_id);
create unique index plantas_unidad_numero_idx
on public.plantas (unidad_cultivo_id, numero)
where numero is not null;

alter table public.espacios enable row level security;
alter table public.unidades_cultivo enable row level security;
alter table public.plantas enable row level security;

create policy usuario_gestiona_sus_espacios
on public.espacios
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

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

create trigger unidades_cultivo_tipo_espacio
before insert or update on public.unidades_cultivo
for each row execute function public.unidad_coherente_con_espacio();

create table public.metodos_personalizados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  fecha_creacion timestamptz not null default now(),
  constraint metodos_personalizados_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint metodos_personalizados_usuario_nombre_unico unique (usuario_id, nombre)
);

create index metodos_personalizados_usuario_id_idx
on public.metodos_personalizados (usuario_id);

alter table public.metodos_personalizados enable row level security;

create policy usuario_gestiona_sus_metodos
on public.metodos_personalizados
for all
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

grant select, insert, update, delete on public.espacios to authenticated;
grant select, insert, update, delete on public.unidades_cultivo to authenticated;
grant select, insert, update, delete on public.plantas to authenticated;
grant select, insert, update, delete on public.metodos_personalizados to authenticated;
