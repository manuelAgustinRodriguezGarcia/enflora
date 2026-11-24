import { decisionVinculo } from "./vinculo.js";

function bytesABase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function leerSuscripcionNavegador() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const registro = await navigator.serviceWorker.getRegistration("/");
  if (!registro?.pushManager) return null;
  return registro.pushManager.getSubscription();
}

async function estadoPorEndpoint(endpoint) {
  const respuesta = await fetch("/api/push/estado", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
    cache: "no-store",
  });
  if (!respuesta.ok) return null;
  const datos = await respuesta.json().catch(() => null);
  if (typeof datos?.activa !== "boolean") return null;
  return { activa: datos.activa, vinculada: datos.vinculada === true, sesion: datos.sesion === true };
}

async function guardarSuscripcionNavegador(suscripcion) {
  const llaveP256 = suscripcion.getKey?.("p256dh");
  const llaveAuth = suscripcion.getKey?.("auth");
  if (!llaveP256 || !llaveAuth) return false;
  const respuesta = await fetch("/api/push/suscripcion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: suscripcion.endpoint,
      claves: { p256dh: bytesABase64Url(llaveP256), auth: bytesABase64Url(llaveAuth) },
      origen: "app",
      plataforma: "desconocida",
      expiraEn: suscripcion.expirationTime ? new Date(suscripcion.expirationTime).toISOString() : null,
    }),
  });
  return respuesta.ok;
}

let sincronizacion = null;

export async function sincronizarVinculoInstalacion(deps = {}) {
  if (!deps.leerSuscripcion && sincronizacion) return sincronizacion;
  const trabajo = ejecutarSincronizacion(deps).finally(() => {
    if (!deps.leerSuscripcion && sincronizacion === trabajo) sincronizacion = null;
  });
  if (!deps.leerSuscripcion) sincronizacion = trabajo;
  return trabajo;
}

async function ejecutarSincronizacion(deps) {
  const leer = deps.leerSuscripcion || leerSuscripcionNavegador;
  const estado = deps.estado || estadoPorEndpoint;
  const guardar = deps.guardar || guardarSuscripcionNavegador;
  const suscripcion = await leer();
  if (!suscripcion?.endpoint) return { accion: "ausente" };
  const info = await estado(suscripcion.endpoint);
  if (!info) return { accion: "temporal" };
  const decision = decisionVinculo({
    sesion: info.sesion === true,
    activa: info.activa === true,
    vinculada: info.vinculada === true,
  });
  if (decision.accion !== "vincular") return decision;
  const guardado = await guardar(suscripcion);
  if (!guardado) return { accion: "temporal" };
  const despues = await estado(suscripcion.endpoint);
  if (despues?.sesion === true && despues.activa === true && despues.vinculada === true) {
    return { accion: "vinculada" };
  }
  return { accion: "temporal" };
}

export async function desvincularInstalacionActual() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const registro = await navigator.serviceWorker.getRegistration("/");
    const suscripcion = registro ? await registro.pushManager.getSubscription() : null;
    if (!suscripcion?.endpoint) return;
    await fetch("/api/push/desvincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: suscripcion.endpoint }),
      keepalive: true,
      cache: "no-store",
    });
  } catch {
    return;
  }
}
