-- Acciones nativas por defecto: riego, poda, defoliacion, trasplante,
-- entrenamiento, limpieza y problema. Fertilización, foto, nota y tarea
-- siguen siendo válidas para registros y preferencias anteriores.

alter table public.preferencias_seguimiento
  drop constraint if exists preferencias_acciones_validas;

alter table public.preferencias_seguimiento
  add constraint preferencias_acciones_validas check (
    acciones <@ array[
      'riego', 'foto', 'nota', 'tarea', 'poda', 'fertilizacion',
      'defoliacion', 'trasplante', 'entrenamiento', 'limpieza', 'problema'
    ]::text[]
  );

alter table public.registro_acciones
  drop constraint if exists registro_acciones_forma_valida;

alter table public.registro_acciones
  add constraint registro_acciones_forma_valida check (
    (
      origen = 'nativa'
      and clave_nativa in (
        'riego', 'foto', 'nota', 'tarea', 'poda', 'fertilizacion',
        'defoliacion', 'trasplante', 'entrenamiento', 'limpieza', 'problema'
      )
      and opcion_id is null
    )
    or (
      origen = 'personalizada'
      and clave_nativa is null
      and opcion_id is not null
    )
  );

do $$
declare
  firmas regprocedure[] := array[
    'public.insertar_contenido_registro(uuid, uuid, text, jsonb, jsonb, jsonb)'::regprocedure,
    'public.guardar_configuracion_seguimiento(text, text[], text[], uuid[])'::regprocedure
  ];
  firma regprocedure;
  definicion text;
  antigua text := '''riego'', ''foto'', ''nota'', ''tarea'', ''poda'', ''fertilizacion''';
  nueva text := '''riego'', ''foto'', ''nota'', ''tarea'', ''poda'', ''fertilizacion'', ''defoliacion'', ''trasplante'', ''entrenamiento'', ''limpieza'', ''problema''';
begin
  foreach firma in array firmas loop
    definicion := pg_get_functiondef(firma);
    if position(antigua in definicion) = 0 then
      raise exception 'No se encontró el catálogo de acciones en %', firma::text;
    end if;
    execute replace(definicion, antigua, nueva);
  end loop;
end $$;
