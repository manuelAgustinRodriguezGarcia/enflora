import "server-only";
import webpush from "web-push";
import { clavePublicaVapidValida, sujetoVapidValido } from "./reglas.js";
import { parVapidCoincide } from "./secreto.js";

const paresVerificados = new Map();

function parValido(publica, privada) {
  const clave = `${publica}\n${privada}`;
  if (!paresVerificados.has(clave)) {
    const valido = parVapidCoincide(publica, privada);
    if (!valido) console.error("[push] vapid_par_distinto");
    paresVerificados.set(clave, valido);
  }
  return paresVerificados.get(clave);
}

export function configuracionVapid(env = process.env) {
  const publica = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privada = env.VAPID_PRIVATE_KEY || "";
  const sujeto = env.VAPID_SUBJECT || "";
  if (!clavePublicaVapidValida(publica)) return null;
  if (typeof privada !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(privada)) return null;
  if (!sujetoVapidValido(sujeto)) return null;
  if (!parValido(publica, privada)) return null;
  return { publica, privada, sujeto };
}

export function activacionLanzamiento(env = process.env) {
  return env.PUSH_LANZAMIENTO_ACTIVA === "true";
}

export async function despacharPush(suscripcion, payload, opciones = {}) {
  const config = configuracionVapid();
  if (!config) {
    const error = new Error("vapid");
    error.statusCode = 0;
    throw error;
  }

  webpush.setVapidDetails(config.sujeto, config.publica, config.privada);
  return webpush.sendNotification(
    {
      endpoint: suscripcion.endpoint,
      keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
    },
    JSON.stringify(payload),
    {
      TTL: 86400,
      urgency: "normal",
      topic: opciones.topic,
    },
  );
}
