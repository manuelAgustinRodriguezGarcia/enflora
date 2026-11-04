-- Permite las categorías nuevas de producto y un nombre propio de hasta 80 caracteres.
-- Los tipos anteriores (fertilizante, nutriente, aditivo) siguen siendo válidos.

alter table public.productos_cultivo drop constraint if exists productos_cultivo_tipo_valido;
alter table public.productos_cultivo
  add constraint productos_cultivo_tipo_valido
  check (char_length(btrim(tipo)) between 1 and 80);

alter table public.registro_mezcla_componentes drop constraint if exists registro_mezcla_componentes_tipo_valido;
alter table public.registro_mezcla_componentes
  add constraint registro_mezcla_componentes_tipo_valido
  check (char_length(btrim(tipo_producto)) between 1 and 80);

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
  v_tipo text := btrim(coalesce(p_tipo, ''));
  v_caracteristicas text := nullif(btrim(coalesce(p_caracteristicas, '')), '');
begin
  if usuario is null then
    raise exception 'No hay sesión.';
  end if;

  if char_length(v_nombre) < 1 or char_length(v_nombre) > 80 then
    raise exception 'El nombre del producto es obligatorio.';
  end if;

  if char_length(v_tipo) < 1 or char_length(v_tipo) > 80 then
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
      usuario, v_nombre, v_fabricante, v_tipo, v_caracteristicas, true
    )
    returning * into guardado;
    return guardado;
  end if;

  update public.productos_cultivo
  set
    nombre = v_nombre,
    fabricante = v_fabricante,
    tipo = v_tipo,
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
