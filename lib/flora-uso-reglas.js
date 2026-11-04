/**
 * Arma el registro de uso de Flora a partir de la telemetría ya medida.
 * No estima tokens, no calcula tarifas y no acepta texto de la conversación.
 * El costo lo resuelve la base con el precio vigente al momento de guardar.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODELO = /^[0-9A-Za-z._:+-]{1,64}$/;
const OPERACIONES = Object.freeze(["chat", "chat_imagen"]);
const RESULTADOS = Object.freeze(["exito", "error", "cancelacion"]);
const CATEGORIAS = Object.freeze([
  "cuota",
  "validacion",
  "imagen",
  "timeout",
  "sin_respuesta",
  "proveedor",
  "configuracion",
  "cancelacion",
  "desconocido",
]);
const CAMPOS_LLAMADA = Object.freeze([
  ["promptTokens", "entrada"],
  ["candidatosTokens", "salida"],
  ["totalTokens", "total"],
  ["pensamientoTokens", "pensamiento"],
  ["cacheTokens", "cache"],
  ["herramientasTokens", "herramientas"],
]);

function uuid(valor) {
  return typeof valor === "string" && UUID.test(valor) ? valor.toLowerCase() : null;
}

function entero(valor) {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= 50_000_000;
}

function sumarCampo(llamadas) {
  let suma = 0;
  let alguno = false;
  let completo = llamadas.length > 0;
  for (const llamada of llamadas) {
    if (!entero(llamada)) {
      completo = false;
      continue;
    }
    alguno = true;
    suma += llamada;
  }
  if (!alguno) return { valor: null, completo: false };
  return { valor: suma, completo };
}

/**
 * Suma solo enteros informados por el proveedor.
 * Si falta una ronda o un campo, el total de ese campo queda incompleto y no se inventa.
 */
export function resumirTokensFlora(llamadas, rondas) {
  const lista = Array.isArray(llamadas) ? llamadas.filter((item) => item && typeof item === "object") : [];
  const rondasMedidas = Number.isInteger(rondas) && rondas >= 0 && rondas <= 20 ? rondas : lista.length;
  const faltanRondas = rondasMedidas !== lista.length;
  const resumen = {};
  for (const [origen, destino] of CAMPOS_LLAMADA) {
    const suma = sumarCampo(lista.map((llamada) => llamada[origen]));
    resumen[destino] = suma.valor;
    resumen[`${destino}Completo`] = !faltanRondas && suma.completo;
  }
  return resumen;
}

export function clasificarResultadoFlora(resultado) {
  if (resultado?.ok === true) return { resultado: "exito", categoria: null };
  const codigo = String(resultado?.diagnostico?.codigo || "");
  const tipo = String(resultado?.diagnostico?.tipo || "");
  const etapa = String(resultado?.telemetria?.timeoutEtapa || "");
  const error = String(resultado?.error || "");
  if (tipo === "AbortError" || /\babort\b/i.test(error)) {
    return { resultado: "cancelacion", categoria: "cancelacion" };
  }
  if (codigo === "TIMEOUT" || etapa || /tardó más de lo habitual/i.test(error)) {
    return { resultado: "error", categoria: "timeout" };
  }
  if (/no generó una respuesta/i.test(error)) return { resultado: "error", categoria: "sin_respuesta" };
  if (/imagen|fotograf/i.test(error)) return { resultado: "error", categoria: "imagen" };
  if (/escribí un mensaje|demasiado largo|no es válido/i.test(error)) {
    return { resultado: "error", categoria: "validacion" };
  }
  if (/configuración|conectar con el servicio/i.test(error)) {
    return { resultado: "error", categoria: "configuracion" };
  }
  if (/mucha demanda/i.test(error)) return { resultado: "error", categoria: "proveedor" };
  return { resultado: "error", categoria: "desconocido" };
}

function duracion(valor) {
  if (valor == null) return null;
  if (!Number.isInteger(valor) || valor < 0 || valor > 600_000) return undefined;
  return valor;
}

/**
 * Argumentos de registrar_uso_flora. null si la entrada no se puede guardar sin inventar datos.
 * Ignora cualquier texto de conversación que venga de más.
 */
export function argumentosUsoFlora(entrada) {
  if (!entrada || typeof entrada !== "object") return null;
  const solicitudId = uuid(entrada.solicitudId);
  const usuarioId = uuid(entrada.usuarioId);
  const modelo = typeof entrada.modelo === "string" && MODELO.test(entrada.modelo) ? entrada.modelo : null;
  const operacion = OPERACIONES.includes(entrada.operacion) ? entrada.operacion : null;
  const resultado = RESULTADOS.includes(entrada.resultado) ? entrada.resultado : null;
  const categoria = entrada.categoria == null ? null : entrada.categoria;
  if (!solicitudId || !usuarioId || !modelo || !operacion || !resultado) return null;
  if (resultado === "exito" && categoria != null) return null;
  if (resultado !== "exito" && !CATEGORIAS.includes(categoria)) return null;
  const ms = duracion(entrada.duracionMs);
  if (ms === undefined) return null;
  const rondas = Number.isInteger(entrada.rondas) && entrada.rondas >= 0 && entrada.rondas <= 20 ? entrada.rondas : null;
  if (rondas == null) return null;
  const tokens = resumirTokensFlora(entrada.llamadas, rondas);
  return {
    p_solicitud: solicitudId,
    p_usuario: usuarioId,
    p_proveedor: "google",
    p_modelo: modelo,
    p_operacion: operacion,
    p_resultado: resultado,
    p_categoria: categoria,
    p_duracion_ms: ms,
    p_rondas: rondas,
    p_tokens_entrada: tokens.entrada,
    p_tokens_salida: tokens.salida,
    p_tokens_total: tokens.total,
    p_tokens_pensamiento: tokens.pensamiento,
    p_tokens_cache: tokens.cache,
    p_tokens_herramientas: tokens.herramientas,
    p_entrada_completa: tokens.entradaCompleto,
    p_salida_completa: tokens.salidaCompleto,
    p_total_completo: tokens.totalCompleto,
  };
}

export function eventoDesdeResultadoFlora({ solicitudId, usuarioId, resultado, inicioMs = null, modelo = "" }) {
  const clasificacion = clasificarResultadoFlora(resultado);
  const telemetria = resultado?.telemetria;
  const conImagen = (telemetria?.imagenes?.length || 0) > 0 || Boolean(resultado?.meta?.imagen);
  const duracionMedida = Number.isInteger(telemetria?.msTotal) ? telemetria.msTotal : inicioMs;
  return argumentosUsoFlora({
    solicitudId,
    usuarioId,
    modelo: telemetria?.modelo || modelo,
    operacion: conImagen ? "chat_imagen" : "chat",
    resultado: clasificacion.resultado,
    categoria: clasificacion.categoria,
    duracionMs: duracionMedida,
    rondas: Number.isInteger(telemetria?.rondasGemini) ? telemetria.rondasGemini : 0,
    llamadas: telemetria?.llamadasGemini || [],
  });
}
