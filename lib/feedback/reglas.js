/**
 * Reglas puras de feedback de la aplicación.
 * No hablan con Supabase, no aceptan usuario_id ni campos administrativos,
 * y no guardan cultivo, chats ni fotografías.
 *
 * El cupo en memoria modela el candado de la migración (un envío a la vez por
 * usuario). La base es la que lo hace cumplir entre instancias.
 */

export const CATEGORIAS_FEEDBACK = Object.freeze([
  Object.freeze({ id: "sugerencia", etiqueta: "Sugerir una mejora" }),
  Object.freeze({ id: "error_app", etiqueta: "Reportar un error de la app" }),
  Object.freeze({ id: "opinion", etiqueta: "Dar mi opinión" }),
  Object.freeze({ id: "otro", etiqueta: "Otro comentario" }),
]);

export const ESTADOS_FEEDBACK = Object.freeze([
  Object.freeze({ id: "nuevo", etiqueta: "Nuevo" }),
  Object.freeze({ id: "en_revision", etiqueta: "En revisión" }),
  Object.freeze({ id: "planificado", etiqueta: "Planificado" }),
  Object.freeze({ id: "implementado", etiqueta: "Implementado" }),
  Object.freeze({ id: "descartado", etiqueta: "Descartado" }),
]);

export const PRIORIDADES_FEEDBACK = Object.freeze([
  Object.freeze({ id: "baja", etiqueta: "Baja" }),
  Object.freeze({ id: "normal", etiqueta: "Normal" }),
  Object.freeze({ id: "alta", etiqueta: "Alta" }),
]);

export const IDS_CATEGORIA_FEEDBACK = Object.freeze(CATEGORIAS_FEEDBACK.map((item) => item.id));
export const IDS_ESTADO_FEEDBACK = Object.freeze(ESTADOS_FEEDBACK.map((item) => item.id));
export const IDS_PRIORIDAD_FEEDBACK = Object.freeze(PRIORIDADES_FEEDBACK.map((item) => item.id));

export const MINIMO_MENSAJE_FEEDBACK = 10;
export const LIMITE_MENSAJE_FEEDBACK = 2000;
export const LIMITE_NOTA_FEEDBACK = 2000;
export const LIMITE_RESUMEN_FEEDBACK = 140;
export const LIMITE_ENVIOS_FEEDBACK = 5;
export const VENTANA_FEEDBACK_MS = 24 * 60 * 60 * 1000;
export const VENTANA_DUPLICADO_MS = 30 * 1000;

/** Texto plano. Permite escribir en español y rechaza controles que no sean espacio. */
export const TEXTO_PLANO_FEEDBACK = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}\n\r\t]*$/u;

const MENSAJES = Object.freeze({
  sin_sesion: "Tenés que iniciar sesión para enviar feedback.",
  anonimo: "Esta acción está disponible para cuentas registradas.",
  categoria_invalida: "Elegí una categoría.",
  mensaje_invalido: "El mensaje tiene que tener entre 10 y 2000 caracteres.",
  mensaje_caracteres: "El mensaje tiene caracteres que no podemos guardar.",
  limite: "Alcanzaste el límite de 5 envíos cada 24 horas. Podés volver a escribir más tarde.",
  duplicado: "Este mensaje ya se envió hace un momento. Si querés agregar algo, cambialo y volvé a intentar.",
  migracion: "Todavía no podemos guardar feedback. Falta aplicar supabase/feedback-usuarios.sql.",
  permiso: "No se pudo enviar el feedback: esta cuenta no tiene permiso. Tu mensaje sigue acá: volvé a intentar.",
  error: "No se pudo enviar el feedback. Tu mensaje sigue acá: volvé a intentar.",
});

const CODIGOS_RESPUESTA = Object.freeze([
  "sin_sesion",
  "anonimo",
  "categoria_invalida",
  "mensaje_invalido",
  "limite",
  "duplicado",
]);

export function etiquetaCategoriaFeedback(id) {
  return CATEGORIAS_FEEDBACK.find((item) => item.id === id)?.etiqueta || "";
}

export function etiquetaEstadoFeedback(id) {
  return ESTADOS_FEEDBACK.find((item) => item.id === id)?.etiqueta || "";
}

export function etiquetaPrioridadFeedback(id) {
  return PRIORIDADES_FEEDBACK.find((item) => item.id === id)?.etiqueta || "";
}

export function mensajeEnvioFeedback(codigo) {
  return MENSAJES[codigo] || MENSAJES.error;
}

export function conservarEntradaFeedback(entrada) {
  const fuente = entrada && typeof entrada === "object" ? entrada : {};
  return {
    categoria: typeof fuente.categoria === "string" ? fuente.categoria : "",
    mensaje: typeof fuente.mensaje === "string" ? fuente.mensaje : "",
  };
}

export function textoPlanoFeedback(valor, maximo) {
  if (typeof valor !== "string" || valor.length > maximo) return false;
  return TEXTO_PLANO_FEEDBACK.test(valor) && !valor.includes("\0");
}

export function validarEnvioFeedback(entrada) {
  const conservado = conservarEntradaFeedback(entrada);
  if (!IDS_CATEGORIA_FEEDBACK.includes(conservado.categoria)) {
    return { ok: false, codigo: "categoria_invalida", error: MENSAJES.categoria_invalida };
  }
  const mensaje = conservado.mensaje.trim();
  if (mensaje.length < MINIMO_MENSAJE_FEEDBACK || mensaje.length > LIMITE_MENSAJE_FEEDBACK) {
    return { ok: false, codigo: "mensaje_invalido", error: MENSAJES.mensaje_invalido };
  }
  if (!textoPlanoFeedback(mensaje, LIMITE_MENSAJE_FEEDBACK)) {
    return { ok: false, codigo: "mensaje_invalido", error: MENSAJES.mensaje_caracteres };
  }
  return { ok: true, categoria: conservado.categoria, mensaje };
}

/**
 * Cupo de una sola cuenta. `marcas` son envíos ya aceptados: { en, clave }.
 * `ahoraMs` es el reloj del servidor. No mira datos de otras cuentas.
 */
export function evaluarCupoFeedback(marcas, ahoraMs, clave) {
  const lista = Array.isArray(marcas) ? marcas : [];
  const vigentes = lista.filter((marca) => {
    if (!marca || typeof marca.en !== "number") return false;
    const edad = ahoraMs - marca.en;
    return edad >= 0 && edad <= VENTANA_FEEDBACK_MS;
  });
  if (vigentes.length >= LIMITE_ENVIOS_FEEDBACK) return { permitido: false, codigo: "limite" };
  const repetido = vigentes.some((marca) => marca.clave === clave && ahoraMs - marca.en <= VENTANA_DUPLICADO_MS);
  if (repetido) return { permitido: false, codigo: "duplicado" };
  return { permitido: true };
}

/** Serializa los intentos de una cuenta, igual que el advisory lock de la migración. */
export function crearCupoSerializable(marcas = []) {
  let cola = Promise.resolve();
  const registro = marcas.map((marca) => ({ en: marca.en, clave: marca.clave }));
  return {
    async intentar(ahoraMs, clave) {
      const turno = cola;
      let soltar = () => {};
      cola = new Promise((resolver) => {
        soltar = resolver;
      });
      await turno;
      try {
        const decision = evaluarCupoFeedback(registro, ahoraMs, clave);
        if (!decision.permitido) return decision;
        registro.push({ en: ahoraMs, clave });
        return { permitido: true };
      } finally {
        soltar();
      }
    },
    registro,
  };
}

export function aceptarEnvio({ pendiente, enCurso }) {
  return pendiente !== true && enCurso !== true;
}

function limpiarTecnico(valor, maximo) {
  return String(valor ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[correo]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]")
    .replace(/bearer\s+\S+/gi, "bearer [token]")
    .slice(0, maximo);
}

/** Código y mensaje de PostgREST, sin correo, token ni cuerpo del feedback. */
export function resumenTecnicoSupabase(error) {
  const fuente = error && typeof error === "object" ? error : {};
  return {
    codigo: limpiarTecnico(fuente.code, 32),
    mensaje: limpiarTecnico(fuente.message, 240),
  };
}

const oyentesFalloFeedback = new Set();

export function escucharFallosFeedback(oyente) {
  oyentesFalloFeedback.add(oyente);
  return () => oyentesFalloFeedback.delete(oyente);
}

export function registrarFalloFeedback(ambito, error) {
  const resumen = resumenTecnicoSupabase(error);
  const linea = { ambito, codigo: resumen.codigo || "sin_codigo", mensaje: resumen.mensaje };
  console.error("[feedback]", linea.ambito, linea.codigo, linea.mensaje);
  for (const oyente of oyentesFalloFeedback) oyente(linea);
}

/**
 * migracion: la función no está en el schema cache.
 * permiso: el rol no puede ejecutarla.
 * error: fallo interno. Las validaciones no llegan acá: vuelven como jsonb.
 */
export function clasificarErrorEnvioFeedback(error) {
  const codigo = String(error?.code || "");
  const mensaje = String(error?.message || "");
  if (codigo === "PGRST202" || /could not find the function|schema cache/i.test(mensaje)) return "migracion";
  if (codigo === "42501" || /permission denied/i.test(mensaje)) return "permiso";
  return "error";
}

/** La función de alta solo puede decir ok, o ok:false con un código conocido. */
export function codigoEnvioFeedback(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "error";
  const claves = Object.keys(data);
  if (data.ok === true) {
    return claves.length === 1 && claves[0] === "ok" ? "" : "error";
  }
  if (data.ok !== false || claves.length !== 2 || !Object.hasOwn(data, "codigo")) return "error";
  return CODIGOS_RESPUESTA.includes(data.codigo) ? data.codigo : "error";
}
