import {
  fusionarReferenciasDesdeMensajesChat,
  sugerirTituloChat,
} from "@/lib/flora-chats-guardados";

const ESPERA_REINTENTO_MS = [0, 400, 900];

function esperar(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function persistirChatFloraEnApi(
  { titulo, claveSesion, chatGuardadoId, mensajes },
  { reintentos = 3 } = {},
) {
  const intentos = Math.max(1, Math.min(reintentos, ESPERA_REINTENTO_MS.length));
  let ultimoError = "No se pudo guardar.";

  for (let i = 0; i < intentos; i += 1) {
    if (ESPERA_REINTENTO_MS[i]) await esperar(ESPERA_REINTENTO_MS[i]);
    try {
      const res = await fetch("/api/flora/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo || sugerirTituloChat(mensajes),
          claveSesion,
          chatGuardadoId: chatGuardadoId || null,
          mensajes,
          referencias: fusionarReferenciasDesdeMensajesChat(mensajes),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.id) {
        return {
          ok: true,
          id: data.id,
          actualizado: Boolean(data.actualizado),
          duplicado: Boolean(data.duplicado),
        };
      }
      ultimoError = data.error || ultimoError;
    } catch {
      ultimoError = "Falló la conexión.";
    }
  }

  return { ok: false, error: ultimoError };
}

/** Serializa escrituras para que un guardado antiguo no pise uno más nuevo. */
export function crearColaPersistenciaChat() {
  let cadena = Promise.resolve();
  let generacion = 0;

  function encolar(ejecutar) {
    const turno = ++generacion;
    const promesa = cadena.then(async () => {
      const res = await ejecutar(turno);
      return { res, turno };
    });
    cadena = promesa.then(
      () => {},
      () => {},
    );
    return promesa;
  }

  return { encolar, obtenerGeneracion: () => generacion };
}
