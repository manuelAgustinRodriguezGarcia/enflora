export const CLAVE_CAMPANA_LANZAMIENTO = "lanzamiento-2026-11";
export const ZONA_LANZAMIENTO = "America/Argentina/Buenos_Aires";
export const CONCURRENCIA_PUSH = 8;
export const TAMANO_LOTE_PUSH = 80;
export const LIMITE_ALTAS_HORA = 8;
export const MAX_INTENTOS_PUSH = 3;

const HOSTS_PUSH = new Set([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "web.push.apple.com",
  "updates.push.services.mozilla.com",
  "notify.windows.com",
]);

const ORIGENES_OFICIALES = new Set(["https://enflora.com.ar", "https://www.enflora.com.ar"]);

export function hostPushPermitido(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (HOSTS_PUSH.has(host)) return true;
  if (host.endsWith(".notify.windows.com")) return true;
  if (host.endsWith(".push.apple.com")) return true;
  return false;
}

export function clavePublicaVapidValida(valor) {
  return typeof valor === "string" && /^[A-Za-z0-9_-]{80,120}$/.test(valor);
}

export function sujetoVapidValido(valor) {
  if (typeof valor !== "string" || valor.length < 8 || valor.length > 200) return false;
  if (valor.startsWith("mailto:")) return valor.slice(7).includes("@");
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function esUuid(valor) {
  return (
    typeof valor === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
  );
}

export function textoAvisoValido(valor, maximo) {
  if (typeof valor !== "string") return false;
  const limpio = valor.trim();
  if (!limpio || limpio.length > maximo) return false;
  return !/[\u0000-\u001F\u007F]/.test(limpio);
}

export function rutaDestino(valor, origenExtra) {
  if (typeof valor !== "string" || valor.length > 500 || valor.startsWith("//") || valor.includes("\\")) {
    return null;
  }

  const permitidos = new Set(ORIGENES_OFICIALES);
  if (typeof origenExtra === "string" && origenExtra) {
    try {
      const extra = new URL(origenExtra);
      const local = extra.hostname === "localhost" || extra.hostname === "127.0.0.1";
      if (extra.protocol === "https:" || (extra.protocol === "http:" && local)) {
        permitidos.add(extra.origin);
      }
    } catch {
      return null;
    }
  }

  try {
    const url = valor.startsWith("/")
      ? new URL(valor, "https://enflora.com.ar")
      : new URL(valor);
    if (valor.startsWith("/") && url.origin !== "https://enflora.com.ar") return null;
    if (!valor.startsWith("/") && !permitidos.has(url.origin)) return null;
    if (url.username || url.password) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function endpointPushValido(endpoint) {
  if (typeof endpoint !== "string") return null;
  const limpio = endpoint.trim();
  if (!limpio || limpio.length > 2000) return null;
  try {
    const url = new URL(limpio);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!hostPushPermitido(url.hostname)) return null;
    return limpio;
  } catch {
    return null;
  }
}

export function normalizarSuscripcion(entrada) {
  if (!entrada || typeof entrada !== "object") return null;
  const endpoint = typeof entrada.endpoint === "string" ? entrada.endpoint.trim() : "";
  const claves = entrada.claves;
  const p256dh = claves && typeof claves.p256dh === "string" ? claves.p256dh.trim() : "";
  const auth = claves && typeof claves.auth === "string" ? claves.auth.trim() : "";
  const origen = entrada.origen === "app" || entrada.origen === "landing" ? entrada.origen : null;
  const endpointValido = endpointPushValido(endpoint);
  if (!origen || !endpointValido) return null;
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(p256dh)) return null;
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(auth)) return null;

  const plataformas = new Set(["android", "ios", "escritorio", "desconocida"]);
  const plataforma = plataformas.has(entrada.plataforma) ? entrada.plataforma : "desconocida";
  let expiraEn = null;
  if (entrada.expiraEn != null) {
    const tiempo = Date.parse(entrada.expiraEn);
    if (!Number.isFinite(tiempo)) return null;
    expiraEn = new Date(tiempo).toISOString();
  }

  return { endpoint: endpointValido, p256dh, auth, origen, plataforma, expiraEn };
}

export function versionIosDesdeAgente(agente) {
  const coincidencia = /OS (\d+)[_.](\d+)/.exec(agente || "");
  if (!coincidencia) return null;
  return { mayor: Number(coincidencia[1]), menor: Number(coincidencia[2]) };
}

export function iosAceptaPush(version) {
  if (!version) return null;
  if (version.mayor > 16) return true;
  if (version.mayor === 16 && version.menor >= 4) return true;
  return false;
}

export function clasificarSoporte({
  tieneServiceWorker,
  tienePush,
  tieneNotificacion,
  esIos,
  instalada,
  versionIos,
  permiso,
}) {
  if (!tieneServiceWorker || !tienePush || !tieneNotificacion) return "no-compatible";
  if (esIos) {
    if (iosAceptaPush(versionIos) === false) return "no-compatible";
    if (!instalada) return "requiere-instalacion";
  }
  if (permiso === "denied") return "denegado";
  if (permiso === "granted") return "con-permiso";
  return "disponible";
}

export function claveAplicacionABytes(clave) {
  if (!clavePublicaVapidValida(clave)) return null;
  const limpio = clave.replace(/-/g, "+").replace(/_/g, "/");
  const pad = limpio + "=".repeat((4 - (limpio.length % 4)) % 4);
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = [];
  for (let i = 0; i < pad.length; i += 4) {
    const a = alfabeto.indexOf(pad[i]);
    const b = alfabeto.indexOf(pad[i + 1]);
    const c = pad[i + 2] === "=" ? -1 : alfabeto.indexOf(pad[i + 2]);
    const d = pad[i + 3] === "=" ? -1 : alfabeto.indexOf(pad[i + 3]);
    if (a < 0 || b < 0 || (c < 0 && pad[i + 2] !== "=") || (d < 0 && pad[i + 3] !== "=")) return null;
    bytes.push((a << 2) | (b >> 4));
    if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d >= 0) bytes.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(bytes);
}

export function decisionCampana(campana, ahoraMs, activacion) {
  if (activacion !== true) return { ejecutar: false, motivo: "activacion" };
  if (!campana) return { ejecutar: false, motivo: "ausente" };
  if (campana.habilitada !== true) return { ejecutar: false, motivo: "deshabilitada" };
  if (campana.zona_horaria !== ZONA_LANZAMIENTO) return { ejecutar: false, motivo: "zona" };
  if (campana.estado === "completada" || campana.estado === "cancelada") {
    return { ejecutar: false, motivo: campana.estado };
  }
  if (!["borrador", "programada", "en_curso"].includes(campana.estado)) {
    return { ejecutar: false, motivo: "estado" };
  }
  if (!textoAvisoValido(campana.titulo, 120) || !textoAvisoValido(campana.mensaje, 280)) {
    return { ejecutar: false, motivo: "texto" };
  }
  const cuando = Date.parse(campana.programada_para);
  if (!Number.isFinite(cuando)) return { ejecutar: false, motivo: "fecha" };
  if (ahoraMs < cuando) return { ejecutar: false, motivo: "pendiente" };
  const ruta = rutaDestino(campana.url, campana.origenExtra);
  if (!ruta) return { ejecutar: false, motivo: "destino" };
  return { ejecutar: true, motivo: "lista", ruta };
}

export function claveIdempotenciaCampana(campanaId, suscripcionId) {
  return `campana:${campanaId}:${suscripcionId}`;
}

export function clasificarResultadoPush(codigo) {
  const estadoHttp = Number(codigo);
  if (estadoHttp === 404 || estadoHttp === 410) {
    return { estado: "expirado", expirada: true, visualizado: false };
  }
  if (estadoHttp >= 200 && estadoHttp < 300) {
    return { estado: "aceptado", expirada: false, visualizado: false };
  }
  return { estado: "error", expirada: false, visualizado: false };
}

export function resumirResultados(resultados) {
  const resumen = { aceptados: 0, errores: 0, expirados: 0, omitidos: 0, repetidos: 0 };
  for (const item of resultados) {
    if (item.estado === "aceptado") resumen.aceptados += 1;
    else if (item.estado === "expirado") resumen.expirados += 1;
    else if (item.estado === "omitido") resumen.omitidos += 1;
    else if (item.estado === "ya-registrado") resumen.repetidos += 1;
    else if (item.estado === "error") resumen.errores += 1;
  }
  return resumen;
}

export async function mapaConcurrencia(items, limite, tarea) {
  const resultados = new Array(items.length);
  let cursor = 0;
  const trabajadores = Math.max(1, Math.min(limite, items.length || 1));

  async function trabajar() {
    while (cursor < items.length) {
      const indice = cursor;
      cursor += 1;
      resultados[indice] = await tarea(items[indice], indice);
    }
  }

  if (items.length === 0) return resultados;
  await Promise.all(Array.from({ length: trabajadores }, () => trabajar()));
  return resultados;
}

export function payloadAviso(titulo, mensaje, ruta) {
  return {
    titulo: titulo.trim().slice(0, 120),
    mensaje: mensaje.trim().slice(0, 280),
    url: ruta,
  };
}
