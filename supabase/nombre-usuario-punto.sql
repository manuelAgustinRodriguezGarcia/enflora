-- Permite el punto en el nombre de usuario para sugerencias como nombre.420.
create or replace function public.normalizar_nombre_usuario(valor text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        translate(
          lower(trim(coalesce(valor, ''))),
          'áéíóúüñàèìòùâêîôûäëïöÿ',
          'aeiouunaeiouaeiouaeioy'
        ),
        '[^a-z0-9_.]',
        '',
        'g'
      ),
      '\.{2,}',
      '.',
      'g'
    ),
    '^\.+|\.+$',
    '',
    'g'
  );
$$;
