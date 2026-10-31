-- Consultas de solo lectura — verificación post-migración Plus (iteración 2).
-- Ejecutar en el SQL Editor de Supabase; no modifica datos.

-- Tablas
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plus_suscripciones',
    'plus_pagos_recurrentes',
    'plus_notificaciones',
    'plus_cotizacion_auditoria'
  )
order by 1;

-- Columnas clave (suscripciones)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'plus_suscripciones'
order by ordinal_position;

-- Índices únicos
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename like 'plus_%'
order by tablename, indexname;

-- Políticas RLS
select schemaname, tablename, policyname, permissive, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename like 'plus_%'
order by tablename, policyname;

-- RPC Plus (iteración 1 reservaba RPC; puede estar vacío)
select p.proname as funcion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like '%plus%'
order by 1;

-- Grants
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'plus_%'
order by table_name, grantee, privilege_type;
