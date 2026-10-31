import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Heartbeat del cron de renovaciones: cada corrida real registra su paso en
 * `plus_cron_heartbeat`. Un monitor EXTERNO consulta /api/pagos/plus/heartbeat y recibe 503 si
 * el cron dejó de correr o su última corrida falló. No depende de correos del propio cron.
 */

export const TABLA_HEARTBEAT = "plus_cron_heartbeat";
export const JOB_RENOVACION = "renovacion-ars";
/** Con cron horario, 3 h sin corridas = 2 corridas perdidas. */
export const EDAD_MAXIMA_MIN_DEFECTO = 180;

export function nombreJob(ambiente) {
  return `${JOB_RENOVACION}:${ambiente}`;
}

/** Registra la corrida. Nunca lanza: el monitoreo no puede romper el cron. */
export async function registrarHeartbeat(supabase, { ambiente, ahora, estado, resumen }) {
  try {
    const marca = ahora.toISOString();
    const fila = {
      job: nombreJob(ambiente),
      ultima_ejecucion_en: marca,
      ultimo_estado: estado,
      resumen,
      actualizada_en: marca,
    };
    if (estado === "ok") fila.ultimo_ok_en = marca;
    const { error } = await supabase.from(TABLA_HEARTBEAT).upsert(fila, { onConflict: "job" });
    if (error) {
      console.error("[plus-renovacion] heartbeat_no_registrado");
      return false;
    }
    return true;
  } catch {
    console.error("[plus-renovacion] heartbeat_no_registrado");
    return false;
  }
}

export async function leerHeartbeat(supabase, ambiente) {
  const { data, error } = await supabase
    .from(TABLA_HEARTBEAT)
    .select("job, ultima_ejecucion_en, ultimo_ok_en, ultimo_estado, resumen")
    .eq("job", nombreJob(ambiente))
    .maybeSingle();
  if (error) return { ok: false };
  return { ok: true, fila: data || null };
}

/**
 * Decide la salud del cron. `ok` es lo que el monitor externo interpreta (200/503).
 * estado: ok | parcial (corrió con advertencias) | fallida (fail-closed o error).
 */
export function evaluarHeartbeat(fila, { ahora = new Date(), edadMaximaMin = EDAD_MAXIMA_MIN_DEFECTO } = {}) {
  if (!fila?.ultima_ejecucion_en) return { ok: false, motivo: "nunca_ejecutado" };
  const ultima = new Date(fila.ultima_ejecucion_en);
  if (Number.isNaN(ultima.getTime())) return { ok: false, motivo: "heartbeat_invalido" };
  const edadMin = (ahora.getTime() - ultima.getTime()) / 60000;
  if (edadMin > edadMaximaMin) return { ok: false, motivo: "ejecucion_faltante", edadMin: Math.round(edadMin) };
  if (fila.ultimo_estado === "fallida") return { ok: false, motivo: "ultima_corrida_fallida", edadMin: Math.round(edadMin) };
  return {
    ok: true,
    motivo: fila.ultimo_estado === "parcial" ? "corrida_parcial" : "al_dia",
    edadMin: Math.round(edadMin),
  };
}

/** Secreto propio del monitor (distinto de CRON_SECRET). Sin él la ruta queda deshabilitada. */
export function monitorAutorizado(authorization, env = process.env) {
  const secreto = String(env.PLUS_MONITOR_SECRET || "").trim();
  if (!secreto) return false;
  const recibido = String(authorization || "");
  if (!recibido.startsWith("Bearer ")) return false;
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const real = Buffer.from(recibido);
  return real.length === esperado.length && timingSafeEqual(real, esperado);
}
