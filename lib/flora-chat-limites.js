/** Límites y cuotas del chat Flora (servidor). */

export const LIMITES_CHAT_FLORA = {
  maxCaracteresMensaje: 2000,
  maxTurnosHistorial: 8,
  maxCaracteresTurnoHistorial: 4000,
  maxLlamadasHerramientasPorMensaje: 8,
  maxCaracteresResultadoHerramienta: 14_000,
  timeoutMs: 55_000,
  solicitudesPorMinuto: 6,
  solicitudesPorHora: 40,
};

const ventanasPorUsuario = new Map();

function limpiarVentana(registro, ahora) {
  registro.minuto = registro.minuto.filter((t) => ahora - t < 60_000);
  registro.hora = registro.hora.filter((t) => ahora - t < 3_600_000);
}

/** Devuelve { ok, error, reintentarEnSegundos } */
export function verificarCuotaUsuario(usuarioId) {
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

  if (registro.minuto.length >= LIMITES_CHAT_FLORA.solicitudesPorMinuto) {
    return {
      ok: false,
      error: "Estás enviando mensajes muy seguido. Esperá un momento y probá de nuevo.",
      reintentarEnSegundos: 30,
    };
  }
  if (registro.hora.length >= LIMITES_CHAT_FLORA.solicitudesPorHora) {
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

/** Solo para pruebas. */
export function reiniciarCuotasChatFlora() {
  ventanasPorUsuario.clear();
}
