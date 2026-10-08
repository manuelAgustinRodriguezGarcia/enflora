-- Tipos de unidad personalizados y alta posterior de unidades.
-- Ejecutar una vez en el SQL Editor si la base ya tiene unidades_cultivo.
-- No borra unidades ni plantas.
-- carpa, sala, invernadero y aire_libre siguen valiendo.

alter table public.unidades_cultivo
add column if not exists tipo_personalizado text;

alter table public.unidades_cultivo
drop constraint if exists unidades_cultivo_tipo_valido;

alter table public.unidades_cultivo
add constraint unidades_cultivo_tipo_valido
check (tipo in ('carpa', 'sala', 'invernadero', 'aire_libre', 'otro'));

alter table public.unidades_cultivo
drop constraint if exists unidades_cultivo_tipo_personalizado;

alter table public.unidades_cultivo
add constraint unidades_cultivo_tipo_personalizado
check (
  (tipo = 'otro' and tipo_personalizado is not null and char_length(trim(tipo_personalizado)) > 0)
  or (tipo <> 'otro' and tipo_personalizado is null)
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
