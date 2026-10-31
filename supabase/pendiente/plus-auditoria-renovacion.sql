-- PLAN 420 — Seguridad operativa de renovaciones: auditoría por incidencia.
-- NO se ejecuta automáticamente. Revisar y correr a mano en el SQL Editor (primero sandbox).
-- Es aditivo e idempotente: no borra ni reescribe filas existentes de plus_cotizacion_auditoria.
-- El cron de renovación NO debe habilitarse en Vercel antes de aplicar esto.

begin;

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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plus_cotizacion_estado_final'
  ) then
    alter table public.plus_cotizacion_auditoria
      add constraint plus_cotizacion_estado_final check (
        estado_final is null
        or estado_final in ('pendiente', 'bloqueado', 'agotado', 'resuelto', 'descartado', 'vencida', 'legado')
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'plus_cotizacion_alerta_nivel'
  ) then
    alter table public.plus_cotizacion_auditoria
      add constraint plus_cotizacion_alerta_nivel check (
        alerta_nivel is null or alerta_nivel in ('aviso', 'urgente', 'critico', 'agotado')
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'plus_cotizacion_intentos_no_negativos'
  ) then
    alter table public.plus_cotizacion_auditoria
      add constraint plus_cotizacion_intentos_no_negativos check (intentos >= 0 and evaluaciones >= 0);
  end if;
end $$;

-- Una incidencia por (suscripción, renovación). Es lo que hace atómica la reserva del intento
-- y evita filas duplicadas por la misma incidencia. Filas legadas (clave null) no participan.
create unique index if not exists plus_cotizacion_incidencia_unica
  on public.plus_cotizacion_auditoria (clave_incidencia)
  where clave_incidencia is not null;

create index if not exists plus_cotizacion_incidencias_abiertas_idx
  on public.plus_cotizacion_auditoria (ambiente, estado_final, renovacion_ref)
  where clave_incidencia is not null;

create index if not exists plus_cotizacion_incidencias_recientes_idx
  on public.plus_cotizacion_auditoria (ambiente, actualizada_en desc)
  where clave_incidencia is not null;

commit;

-- ---------------------------------------------------------------------------
-- OPCIONAL (revisar antes): filas legadas generadas por el cron anterior, que insertaba una
-- fila por corrida y por incidencia. No se borra nada: solo se las marca como 'legado'.
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
-- where clave_incidencia = '<renov:SUSCRIPCION_UUID:FECHA_ISO>' and estado_final = 'agotado';

-- ---------------------------------------------------------------------------
-- Consulta de monitoreo: incidencias abiertas, más urgentes primero.
-- ---------------------------------------------------------------------------
-- select suscripcion_id, renovacion_ref, estado_final, codigo_error, intentos,
--        importe_ars_nuevo as esperado, importe_remoto_ars as remoto,
--        ultimo_intento_en, proximo_intento_en, alerta_nivel
-- from public.plus_cotizacion_auditoria
-- where clave_incidencia is not null and estado_final in ('pendiente', 'bloqueado', 'agotado')
-- order by renovacion_ref asc;
