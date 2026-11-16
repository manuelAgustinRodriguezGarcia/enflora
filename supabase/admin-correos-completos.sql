-- Correo completo para quien ya tiene acceso al panel.
-- CREATE OR REPLACE sobre las funciones que el listado y el detalle ya llaman.
-- No toca tablas, permisos ni datos de cultivo.

create or replace function public.usuarios_admin_enmascarar(p_correo text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_correo is null
      or pg_catalog.strpos(pg_catalog.btrim(p_correo), '@') < 2
      or pg_catalog.split_part(pg_catalog.btrim(p_correo), '@', 2) = ''
      then null
    else pg_catalog.btrim(p_correo)
  end;
$$;

create or replace function public.feedback_admin_enmascarar(p_correo text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_correo is null
      or pg_catalog.strpos(pg_catalog.btrim(p_correo), '@') < 2
      or pg_catalog.split_part(pg_catalog.btrim(p_correo), '@', 2) = ''
      then null
    else pg_catalog.btrim(p_correo)
  end;
$$;
