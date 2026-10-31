-- PLAN 420 — Seguridad operativa de renovaciones: auditoría por incidencia + heartbeat del cron.
--
-- NO se ejecuta automáticamente. Correr a mano en el SQL Editor de Supabase, UNA vez por proyecto
-- Supabase (ver auditorias/PLAN-420-SEGURIDAD-OPERATIVA-RENOVACIONES.md, sección "Aplicar la migración").
-- Si sandbox y producción comparten proyecto Supabase, se aplica una sola vez: las filas se separan
-- por la columna `ambiente`, no por esquema.
--
-- Es aditivo e idempotente (se puede repetir sin efectos): no borra ni reescribe filas existentes.
-- Sin esta migración el cron queda detenido (fail-closed): no hace ningún PUT a Mercado Pago.
-- Después de ejecutarla, correr plus-auditoria-renovacion-verificacion.sql (solo lectura).

begin;

-- 1) Auditoría por incidencia ------------------------------------------------------------------

alter table public.plus_cotizacion_auditoria
  add column if not exists clave_incidencia text,
  add column if not exists ambiente text,
  add column if not exists renovacion_ref timestamptz,
  add column if not exists importe_remoto_ars numeric(14, 2),
  add column if not exists intentos integer not null default 0,
  add column if not exists evaluaciones integer not null default 0,
  add column if not exists primer_intento_en timestamptz,
  add column if not exists ultimo_intento_en timestamptz,
  add column if not exists proximo_intento_en timestamptz,
  add column if not exists codigo_error text,
  add column if not exists estado_final text,
  add column if not exists alerta_nivel text,
  add column if not exists alertada_en timestamptz,
  add column if not exists resuelta_en timestamptz,
  add column if not exists actualizada_en timestamptz not null default now();

-- Las restricciones se buscan por tabla (conrelid): el nombre solo es único por tabla.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plus_cotizacion_auditoria'::regclass and conname = 'plus_cotizacion_estado_final'
  ) then
    alter table public.plus_cotizacion_auditoria
      add constraint plus_cotizacion_estado_final check (
        estado_final is null
        or estado_final in ('pendiente', 'bloqueado', 'agotado', 'resuelto', 'descartado', 'vencida', 'legado')
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plus_cotizacion_auditoria'::regclass and conname = 'plus_cotizacion_alerta_nivel'
  ) then
    alter table public.plus_cotizacion_auditoria
      add constraint plus_cotizacion_alerta_nivel check (
        alerta_nivel is null or alerta_nivel in ('aviso', 'urgente', 'critico', 'agotado')
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plus_cotizacion_auditoria'::regclass and conname = 'plus_cotizacion_intentos_no_negativos'
  ) then
    alter table public.plus_cotizacion_auditoria
      add constraint plus_cotizacion_intentos_no_negativos check (intentos >= 0 and evaluaciones >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plus_cotizacion_auditoria'::regclass and conname = 'plus_cotizacion_ambiente'
  ) then
    alter table public.plus_cotizacion_auditoria
      add constraint plus_cotizacion_ambiente check (ambiente is null or ambiente in ('prueba', 'produccion'));
  end if;
end $$;

-- Una incidencia por (suscripción, renovación). Es lo que hace atómica la reserva del primer
-- intento (INSERT → 23505 para la corrida que pierde la carrera) y evita filas duplicadas.
-- Las reservas siguientes son UPDATE ... WHERE id = ? AND intentos = ? (un solo statement, con
-- bloqueo de fila): solo una corrida concurrente ve la fila con el valor esperado. Filas legadas
-- (clave null) no participan del índice.
create unique index if not exists plus_cotizacion_incidencia_unica
  on public.plus_cotizacion_auditoria (clave_incidencia)
  where clave_incidencia is not null;

-- Usado por la carga de incidencias recientes: ambiente = ? and actualizada_en >= ?.
create index if not exists plus_cotizacion_incidencias_recientes_idx
  on public.plus_cotizacion_auditoria (ambiente, actualizada_en desc)
  where clave_incidencia is not null;

-- Monitoreo/runbook: incidencias abiertas por urgencia.
create index if not exists plus_cotizacion_incidencias_abiertas_idx
  on public.plus_cotizacion_auditoria (ambiente, estado_final, renovacion_ref)
  where clave_incidencia is not null;

-- 2) Heartbeat del cron ------------------------------------------------------------------------
-- Una fila por job y ambiente (p. ej. 'renovacion-ars:prueba'). La escribe cada corrida real;
-- GET /api/pagos/plus/heartbeat la evalúa para un monitor externo.

create table if not exists public.plus_cron_heartbeat (
  job text primary key,
  ultima_ejecucion_en timestamptz not null,
  ultimo_ok_en timestamptz,
  ultimo_estado text not null,
  resumen jsonb,
  actualizada_en timestamptz not null default now(),
  constraint plus_cron_heartbeat_estado check (ultimo_estado in ('ok', 'parcial', 'fallida'))
);

-- 3) Permisos y RLS (se reafirman; las tablas ya tenían RLS y grants solo para service_role) -----
-- Sin políticas para anon/authenticated: solo el cliente de servidor (service_role) accede.

alter table public.plus_cotizacion_auditoria enable row level security;
alter table public.plus_cron_heartbeat enable row level security;

revoke all on public.plus_cotizacion_auditoria from anon, authenticated;
revoke all on public.plus_cron_heartbeat from anon, authenticated;

grant select, insert, update, delete on public.plus_cotizacion_auditoria to service_role;
grant select, insert, update, delete on public.plus_cron_heartbeat to service_role;

commit;

-- ---------------------------------------------------------------------------
-- OPCIONAL (revisar antes; NO forma parte de la migración): filas legadas del cron anterior, que
-- insertaba una fila por corrida y por incidencia. No se borra nada: solo se las marca 'legado'.
-- ---------------------------------------------------------------------------

-- 1) Diagnóstico: duplicados históricos por suscripción + detalle + día.
-- select suscripcion_id, detalle, date_trunc('day', creada_en) as dia, count(*) as filas
-- from public.plus_cotizacion_auditoria
-- where operacion = 'actualizacion_pre_renovacion' and clave_incidencia is null
-- group by 1, 2, 3
-- having count(*) > 1
-- order by filas desc;

-- 2) Marcar legado (no destructivo; deja el historial consultable).
-- update public.plus_cotizacion_auditoria
--   set estado_final = 'legado'
-- where operacion = 'actualizacion_pre_renovacion'
--   and clave_incidencia is null
--   and estado_final is null;

-- ---------------------------------------------------------------------------
-- Operación manual (runbook): reabrir una incidencia agotada tras corregir la causa.
-- ---------------------------------------------------------------------------
-- update public.plus_cotizacion_auditoria
--   set intentos = 0, estado_final = 'pendiente', proximo_intento_en = null
-- where clave_incidencia = 'renov:<SUSCRIPCION_UUID>:<FECHA_ISO_UTC>' and estado_final = 'agotado';
