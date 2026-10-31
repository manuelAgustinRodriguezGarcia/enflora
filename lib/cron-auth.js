import { timingSafeEqual } from "node:crypto";

/**
 * Autorización común de crons: siempre `Authorization: Bearer <CRON_SECRET>`.
 * Sin bypass por entorno ni por encabezados falsificables (p. ej. x-vercel-cron).
 * Vercel envía ese Bearer automáticamente cuando CRON_SECRET está definido en el proyecto.
 */
export function cronAutorizado(authorization, env = process.env) {
  const secreto = String(env.CRON_SECRET || "").trim();
  if (!secreto) return false;
  const recibido = String(authorization || "");
  if (!recibido.startsWith("Bearer ")) return false;
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const real = Buffer.from(recibido);
  return real.length === esperado.length && timingSafeEqual(real, esperado);
}
