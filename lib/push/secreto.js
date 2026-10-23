import { createECDH, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function reciboValido(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function hashRecibo(token) {
  return createHash("sha256").update(`enflora-recibo\n${token}`).digest("hex");
}

export function nuevoRecibo() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRecibo(token) };
}

export function parVapidCoincide(publica, privada) {
  if (typeof publica !== "string" || typeof privada !== "string") return false;
  try {
    const curva = createECDH("prime256v1");
    curva.setPrivateKey(Buffer.from(privada, "base64url"));
    return curva.getPublicKey().equals(Buffer.from(publica, "base64url"));
  } catch {
    return false;
  }
}

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
