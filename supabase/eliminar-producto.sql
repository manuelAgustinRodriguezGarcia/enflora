-- Borra un producto del catálogo del usuario.
-- Los riegos ya registrados conservan el nombre (producto_id queda en null).
-- Si el producto está en una receta, no se elimina.

create or replace function public.eliminar_producto_cultivo(p_id uuid)
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

  if p_id is null then
    raise exception 'No se encontró el producto.';
  end if;

  if exists (
    select 1
    from public.receta_componentes as componente
    join public.recetas_mezcla as receta on receta.id = componente.receta_id
    where componente.producto_id = p_id
      and receta.usuario_id = usuario
  ) then
    raise exception 'Este producto está en una mezcla. Sacalo de ahí antes de eliminarlo.';
  end if;

  delete from public.productos_cultivo
  where id = p_id
    and usuario_id = usuario;

  if not found then
    raise exception 'No se encontró el producto.';
  end if;
end;
$$;

revoke all on function public.eliminar_producto_cultivo(uuid) from public, anon;
grant execute on function public.eliminar_producto_cultivo(uuid) to authenticated;
