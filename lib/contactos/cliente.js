import { MENSAJES_CONTACTOS } from "./reglas.js";

export async function enviarContacto(datos) {
  let respuesta;
  try {
    respuesta = await fetch("/api/contactos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: MENSAJES_CONTACTOS.generico };
  }

  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null;
  }

  if (respuesta.ok && cuerpo?.ok === true) return { ok: true };
  if (respuesta.status === 429) {
    return { ok: false, error: MENSAJES_CONTACTOS.limite, limite: true, reintentarEn: cuerpo?.reintentarEn || null };
  }
  return {
    ok: false,
    error: typeof cuerpo?.error === "string" ? cuerpo.error : MENSAJES_CONTACTOS.generico,
    campo: typeof cuerpo?.campo === "string" ? cuerpo.campo : null,
  };
}
