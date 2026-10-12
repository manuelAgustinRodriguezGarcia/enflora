-- Migración para una base que ya tiene perfiles.
-- No asigna un tipo a los usuarios existentes: quedan en NULL hasta el onboarding.

alter table public.perfiles
add column if not exists tipo_seguimiento text;

alter table public.perfiles
drop constraint if exists perfiles_tipo_seguimiento_valido;

alter table public.perfiles
add constraint perfiles_tipo_seguimiento_valido
check (tipo_seguimiento is null or tipo_seguimiento in ('relajado', 'profesional', 'personalizado'));

create or replace function public.guardar_tipo_seguimiento(tipo text)
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

  if tipo is null or tipo not in ('relajado', 'profesional', 'personalizado') then
    raise exception 'Seleccioná un tipo de seguimiento.';
  end if;

  update public.perfiles
  set tipo_seguimiento = tipo
  where id = usuario;

  if not found then
    raise exception 'No se encontró el perfil.';
  end if;
end;
$$;

revoke all on function public.guardar_tipo_seguimiento(text) from public, anon;
grant execute on function public.guardar_tipo_seguimiento(text) to authenticated;
