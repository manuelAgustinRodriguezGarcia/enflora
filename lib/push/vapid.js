import "server-only";
import webpush from "web-push";
import { MAX_INTENTOS_PUSH, clasificarResultadoPush, clavePublicaVapidValida, sujetoVapidValido } from "./reglas.js";
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

function esperar(ms) {
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

export async function despacharPush(suscripcion, payload, opciones = {}) {
  const config = configuracionVapid();
  if (!config) {
    const error = new Error("vapid");
    error.statusCode = 0;
    throw error;
  }

  webpush.setVapidDetails(config.sujeto, config.publica, config.privada);
  const cuerpo = JSON.stringify(payload);
  const destino = {
    endpoint: suscripcion.endpoint,
    keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
  };
  const envio = {
    TTL: 86400,
    urgency: "normal",
    topic: opciones.topic,
  };
  let ultimo = null;
  for (let intento = 0; intento < MAX_INTENTOS_PUSH; intento += 1) {
    try {
      return await webpush.sendNotification(destino, cuerpo, envio);
    } catch (error) {
      ultimo = error;
      const codigo = Number(error?.statusCode) || 0;
      const clase = clasificarResultadoPush(codigo || 500);
      const queda = intento < MAX_INTENTOS_PUSH - 1;
      if (!clase.temporal || !queda) throw error;
      await esperar(400 * 3 ** intento);
    }
  }
  throw ultimo;
}
