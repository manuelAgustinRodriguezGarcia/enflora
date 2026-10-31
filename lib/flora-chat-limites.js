/** Límites y cuotas del chat Flora (servidor). */

/** Margen bajo `maxDuration` de `app/api/flora/chat/route.js` (60s en Vercel Pro). */
const FLORA_CHAT_PRESUPUESTO_VERCEL_MS = 58_000;
const FLORA_CHAT_PRESUPUESTO_LOCAL_MS = 55_000;
const FLORA_CHAT_LLAMADA_GEMINI_VERCEL_MS = 45_000;
const FLORA_CHAT_LLAMADA_GEMINI_LOCAL_MS = 45_000;

function leerTimeoutEnv(nombre, fallback) {
  const crudo = Number(process.env[nombre]);
  return crudo > 0 ? crudo : fallback;
}

function presupuestoTimeoutMs() {
  const base =
    process.env.VERCEL === "1" ? FLORA_CHAT_PRESUPUESTO_VERCEL_MS : FLORA_CHAT_PRESUPUESTO_LOCAL_MS;
  return leerTimeoutEnv("FLORA_CHAT_TIMEOUT_PRESUPUESTO_MS", base);
}

function timeoutLlamadaGeminiMs() {
  const base =
    process.env.VERCEL === "1"
      ? FLORA_CHAT_LLAMADA_GEMINI_VERCEL_MS
      : FLORA_CHAT_LLAMADA_GEMINI_LOCAL_MS;
  return leerTimeoutEnv("FLORA_CHAT_TIMEOUT_LLAMADA_GEMINI_MS", base);
}

/** Límites operativos anti-abuso del chat (aplican a todos los planes hasta definir cuotas comerciales). */
export const LIMITES_OPERATIVOS_CHAT_FLORA = {
  solicitudesPorMinuto: 6,
  solicitudesPorHora: 40,
};

export const LIMITES_CHAT_FLORA = {
  maxCaracteresMensaje: 2000,
  maxTurnosHistorial: 8,
  maxCaracteresTurnoHistorial: 4000,
  maxLlamadasHerramientasPorMensaje: 8,
  maxCaracteresResultadoHerramienta: 14_000,
  /** Tiempo máximo de la solicitud completa (auth, herramientas y Gemini). */
  get timeoutPresupuestoMs() {
    return presupuestoTimeoutMs();
  },
  /** Tope por llamada a Gemini dentro del presupuesto. */
  get timeoutLlamadaGeminiMs() {
    return timeoutLlamadaGeminiMs();
  },
  /** Alias histórico: presupuesto total. */
  get timeoutMs() {
    return presupuestoTimeoutMs();
  },
  get solicitudesPorMinuto() {
    return LIMITES_OPERATIVOS_CHAT_FLORA.solicitudesPorMinuto;
  },
  get solicitudesPorHora() {
    return LIMITES_OPERATIVOS_CHAT_FLORA.solicitudesPorHora;
  },
};

/** Resumen de timeouts efectivos (telemetría / logs). */
export function resumenTimeoutsChatFlora() {
  return {
    presupuestoMs: presupuestoTimeoutMs(),
    llamadaGeminiMs: timeoutLlamadaGeminiMs(),
    entornoVercel: process.env.VERCEL === "1",
  };
}

const ventanasPorUsuario = new Map();

function limpiarVentana(registro, ahora) {
  registro.minuto = registro.minuto.filter((t) => ahora - t < 60_000);
  registro.hora = registro.hora.filter((t) => ahora - t < 3_600_000);
}

/** Cuota operativa (anti-abuso). La diferenciación comercial Gratuito vs Plus en IA aún no tiene reglas numéricas aprobadas. */
export function verificarCuotaOperativaUsuario(usuarioId) {
  if (!usuarioId) {
    return { ok: false, error: "Sesión inválida.", reintentarEnSegundos: 0 };
  }

  const ahora = Date.now();
  let registro = ventanasPorUsuario.get(usuarioId);
  if (!registro) {
    registro = { minuto: [], hora: [] };
    ventanasPorUsuario.set(usuarioId, registro);
  }
  limpiarVentana(registro, ahora);

  if (registro.minuto.length >= LIMITES_OPERATIVOS_CHAT_FLORA.solicitudesPorMinuto) {
    return {
      ok: false,
      error: "Estás enviando mensajes muy seguido. Esperá un momento y probá de nuevo.",
      reintentarEnSegundos: 30,
    };
  }
  if (registro.hora.length >= LIMITES_OPERATIVOS_CHAT_FLORA.solicitudesPorHora) {
    return {
      ok: false,
      error: "Alcanzaste el límite de consultas por hora. Probá más tarde.",
      reintentarEnSegundos: 300,
    };
  }

  registro.minuto.push(ahora);
  registro.hora.push(ahora);
  return { ok: true, error: "", reintentarEnSegundos: 0 };
}

/** Alias histórico del route handler. */
export function verificarCuotaUsuario(usuarioId) {
  return verificarCuotaOperativaUsuario(usuarioId);
}

/** Solo para pruebas. */
export function reiniciarCuotasChatFlora() {
  ventanasPorUsuario.clear();
}
