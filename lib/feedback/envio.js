import {
  clasificarErrorEnvioFeedback,
  codigoEnvioFeedback,
  conservarEntradaFeedback,
  mensajeEnvioFeedback,
  validarEnvioFeedback,
} from "./reglas.js";

/**
 * Alta de feedback. `persistir` solo recibe categoría y mensaje ya validados.
 * La identidad sale de `sesion`, nunca del cuerpo. Un fallo de guardado no es éxito.
 */
export async function enviarFeedbackUsuario({ sesion, entrada, persistir }) {
  const conservado = conservarEntradaFeedback(entrada);
  if (!sesion || typeof sesion !== "object" || typeof sesion.id !== "string" || !sesion.id) {
    return { ok: false, codigo: "sin_sesion", error: mensajeEnvioFeedback("sin_sesion"), ...conservado };
  }
  if (sesion.esAnonimo === true || sesion.is_anonymous === true) {
    return { ok: false, codigo: "anonimo", error: mensajeEnvioFeedback("anonimo"), ...conservado };
  }

  const validado = validarEnvioFeedback(conservado);
  if (!validado.ok) {
    return { ok: false, codigo: validado.codigo, error: validado.error, ...conservado };
  }

  let respuesta;
  try {
    respuesta = await persistir({ categoria: validado.categoria, mensaje: validado.mensaje });
  } catch {
    return { ok: false, codigo: "error", error: mensajeEnvioFeedback("error"), categoria: validado.categoria, mensaje: validado.mensaje };
  }

  if (!respuesta || respuesta.error) {
    const codigo = clasificarErrorEnvioFeedback(respuesta?.error);
    return {
      ok: false,
      codigo,
      error: mensajeEnvioFeedback(codigo),
      categoria: validado.categoria,
      mensaje: validado.mensaje,
    };
  }

  const codigo = codigoEnvioFeedback(respuesta.data);
  if (codigo) {
    return {
      ok: false,
      codigo,
      error: mensajeEnvioFeedback(codigo),
      categoria: validado.categoria,
      mensaje: validado.mensaje,
    };
  }

  return { ok: true };
}
