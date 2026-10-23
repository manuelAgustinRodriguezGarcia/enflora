import { createHash, timingSafeEqual } from "node:crypto";

export function bearerCoincide(autorizacion, secreto) {
  if (typeof secreto !== "string" || secreto.length < 1) return false;
  if (typeof autorizacion !== "string") return false;
  const recibido = Buffer.from(autorizacion);
  const esperado = Buffer.from(`Bearer ${secreto}`);
  if (recibido.length !== esperado.length) return false;
  return timingSafeEqual(recibido, esperado);
}

export function cronAutorizado(autorizacion, env = process.env) {
  const secreto = env.CRON_SECRET || "";
  if (secreto) return bearerCoincide(autorizacion, secreto);
  return env.NODE_ENV !== "production";
}

export function pruebaAutorizada(autorizacion, env = process.env) {
  const secreto = env.PUSH_PRUEBA_SECRETO || "";
  if (secreto.length < 16) return false;
  return bearerCoincide(autorizacion, secreto);
}

export function salLimite(env = process.env) {
  return env.PUSH_LIMITE_SAL || env.CRON_SECRET || "enflora-push-limite";
}

export function claveLimiteIp(ip, sal) {
  return createHash("sha256").update(`${sal}\n${ip}`).digest("hex");
}

export function ipCliente(cabecera) {
  const bruto = typeof cabecera === "string" ? cabecera : "";
  const primero = bruto.split(",")[0].trim();
  if (!primero) return "desconocida";
  return primero.slice(0, 80);
}
