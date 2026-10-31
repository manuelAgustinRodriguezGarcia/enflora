-- Verificación POSTERIOR a plus-auditoria-renovacion.sql. Solo lectura: no modifica datos.
-- Ejecutar en el SQL Editor. Cada bloque indica el resultado esperado.

-- 1) Columnas requeridas por el cron (esperado: 25 filas; ninguna faltante en el bloque 1b).
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'plus_cotizacion_auditoria'
  and column_name in (
    'id', 'clave_incidencia', 'suscripcion_id', 'ambiente', 'operacion', 'renovacion_ref',
    'importe_ars_anterior', 'importe_ars_nuevo', 'importe_remoto_ars', 'cotizacion_valor',
    'cotizacion_fuente', 'cotizacion_publicada_en', 'preapproval_put_ok', 'detalle', 'codigo_error',
    'intentos', 'evaluaciones', 'primer_intento_en', 'ultimo_intento_en', 'proximo_intento_en',
    'estado_final', 'alerta_nivel', 'alertada_en', 'resuelta_en', 'actualizada_en'
  )
order by column_name;

-- 1b) Columnas que FALTAN (esperado: 0 filas).
select requerida as columna_faltante
from unnest(array[
    'id', 'clave_incidencia', 'suscripcion_id', 'ambiente', 'operacion', 'renovacion_ref',
    'importe_ars_anterior', 'importe_ars_nuevo', 'importe_remoto_ars', 'cotizacion_valor',
    'cotizacion_fuente', 'cotizacion_publicada_en', 'preapproval_put_ok', 'detalle', 'codigo_error',
    'intentos', 'evaluaciones', 'primer_intento_en', 'ultimo_intento_en', 'proximo_intento_en',
    'estado_final', 'alerta_nivel', 'alertada_en', 'resuelta_en', 'actualizada_en'
  ]) as requerida
where not exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'plus_cotizacion_auditoria' and c.column_name = requerida
);

-- 2) Índice único parcial de incidencias (esperado: 1 fila, indexdef con "UNIQUE" y "WHERE (clave_incidencia IS NOT NULL)").
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'plus_cotizacion_auditoria'
  and indexname in (
    'plus_cotizacion_incidencia_unica',
    'plus_cotizacion_incidencias_recientes_idx',
    'plus_cotizacion_incidencias_abiertas_idx'
  )
order by indexname;

-- 3) Restricciones nuevas (esperado: 4 filas: estado_final, alerta_nivel, intentos_no_negativos, ambiente).
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'public.plus_cotizacion_auditoria'::regclass
  and conname in (
    'plus_cotizacion_estado_final', 'plus_cotizacion_alerta_nivel',
    'plus_cotizacion_intentos_no_negativos', 'plus_cotizacion_ambiente'
  )
order by conname;

-- 4) Tabla de heartbeat (esperado: 1 fila; columnas job, ultima_ejecucion_en, ultimo_ok_en, ultimo_estado, resumen, actualizada_en).
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'plus_cron_heartbeat'
order by ordinal_position;

-- 5) RLS activo en ambas tablas (esperado: rls_activo = true en las dos).
select c.relname as tabla, c.relrowsecurity as rls_activo
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('plus_cotizacion_auditoria', 'plus_cron_heartbeat')
order by 1;

-- 6) Políticas (esperado: 0 filas para estas dos tablas: solo service_role accede).
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in ('plus_cotizacion_auditoria', 'plus_cron_heartbeat');

-- 7) Permisos (esperado: SOLO service_role con SELECT/INSERT/UPDATE/DELETE; sin anon ni authenticated).
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('plus_cotizacion_auditoria', 'plus_cron_heartbeat')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- 8) Integridad de filas existentes (esperado: 0 filas en cada consulta).
select id from public.plus_cotizacion_auditoria where intentos < 0 or evaluaciones < 0;
select clave_incidencia, count(*) from public.plus_cotizacion_auditoria
where clave_incidencia is not null group by 1 having count(*) > 1;

-- 9) Prueba de la restricción única SIN dejar datos: se hace en una transacción que se revierte.
--    (Opcional. Requiere una suscripción real: reemplazar el UUID. Esperado: el segundo INSERT falla con 23505.)
-- begin;
--   insert into public.plus_cotizacion_auditoria (suscripcion_id, operacion, clave_incidencia, ambiente)
--     values ('<SUSCRIPCION_UUID>', 'actualizacion_pre_renovacion', 'renov:verificacion:x', 'prueba');
--   insert into public.plus_cotizacion_auditoria (suscripcion_id, operacion, clave_incidencia, ambiente)
--     values ('<SUSCRIPCION_UUID>', 'actualizacion_pre_renovacion', 'renov:verificacion:x', 'prueba');
-- rollback;
