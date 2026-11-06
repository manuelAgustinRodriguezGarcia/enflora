-- Borra una receta del catálogo del usuario.
-- Los componentes se van en cascada.
-- Los riegos ya registrados conservan el snapshot (receta_id queda en null).

create or replace function public.eliminar_receta_mezcla(p_id uuid)
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
    raise exception 'No se encontró la mezcla.';
  end if;

  delete from public.recetas_mezcla
  where id = p_id
    and usuario_id = usuario;

  if not found then
    raise exception 'No se encontró la mezcla.';
  end if;
end;
$$;

revoke all on function public.eliminar_receta_mezcla(uuid) from public, anon;
grant execute on function public.eliminar_receta_mezcla(uuid) to authenticated;
