import "server-only";

import { GoogleGenAI } from "@google/genai";
import { obtenerContextoCultivo } from "@/lib/flora-contexto";
import { LIMITES_CHAT_FLORA } from "@/lib/flora-chat-limites";
import {
  DECLARACIONES_HERRAMIENTAS_GEMINI,
  ejecutarHerramientaFlora,
} from "@/lib/flora-herramientas-gemini";
import { geminiConfigurado, modeloFloraGeminiPublico } from "@/lib/flora-chat-config";
import { leerPersonalidadFloraUsuario } from "@/lib/flora-personalidad";
import { construirInstruccionSistemaFlora } from "@/lib/flora-sistema-instrucciones";
import {
  cargarSolucionParaContinuar,
  claveUnicaTurnoGuardado,
  crearContextoGuardadoVacio,
  emitirTokenProcedenciaSolucion,
  fusionarContextoGuardadoDesdeHerramienta,
  fusionarEntidadesImagenEnGuardado,
  referenciasJsonParaGuardado,
  sugerirTituloSolucion,
  textoContextoContinuarSolucion,
} from "@/lib/flora-soluciones";
import {
  construirPartesUsuarioGemini,
  resolverAdjuntosParaGemini,
} from "@/lib/flora-imagen-servidor";
import { normalizarPreguntaConImagen } from "@/lib/flora-imagen-chat";

export { geminiConfigurado };

export function modeloFloraGemini() {
  return modeloFloraGeminiPublico();
}

function crearClienteGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, cliente: null, error: "Flora no está configurada en el servidor (falta GEMINI_API_KEY)." };
  }
  return { ok: true, cliente: new GoogleGenAI({ apiKey }), error: "" };
}

export function validarMensajeUsuario(mensaje, opciones = {}) {
  const texto = String(mensaje ?? "").trim();
  const conImagen = Boolean(opciones.conImagen);
  if (!texto && !conImagen) {
    return { ok: false, error: "Escribí un mensaje o adjuntá una foto para Flora.", texto: "" };
  }
  if (texto.length > LIMITES_CHAT_FLORA.maxCaracteresMensaje) {
    return { ok: false, error: "El mensaje es demasiado largo.", texto: "" };
  }
  return { ok: true, error: "", texto };
}

export function normalizarHistorialCliente(historial) {
  if (!Array.isArray(historial)) return [];
  const salida = [];
  for (const turno of historial) {
    if (!turno || typeof turno !== "object") continue;
    const rol = turno.rol === "flora" || turno.rol === "model" ? "model" : turno.rol === "usuario" || turno.rol === "user" ? "user" : "";
    const texto = String(turno.texto ?? turno.contenido ?? "").trim();
    if (!rol || !texto) continue;
    if (texto.length > LIMITES_CHAT_FLORA.maxCaracteresTurnoHistorial) continue;
    salida.push({ rol, texto });
    if (salida.length >= LIMITES_CHAT_FLORA.maxTurnosHistorial) break;
  }
  return salida;
}

function historialAGemini(historial) {
  return historial.map((t) => ({
    role: t.rol === "model" ? "model" : "user",
    parts: [{ text: t.texto }],
  }));
}

async function indiceCompactoInicial(supabase) {
  try {
    const respuesta = await obtenerContextoCultivo(supabase, {});
    if (respuesta.error || !respuesta.datos) return "";
    if (respuesta.datos.modo !== "indice") {
      return JSON.stringify({
        modo: respuesta.datos.modo,
        entidades: respuesta.entidades,
        resumen: respuesta.datos.resumen_reciente,
      }).slice(0, 6000);
    }
    return JSON.stringify({ modo: "indice", espacios: respuesta.datos.espacios }).slice(0, 6000);
  } catch {
    return "";
  }
}

function sanitizarMensajeErrorGemini(texto) {
  let mensaje = String(texto ?? "");
  mensaje = mensaje.replace(/AIza[0-9A-Za-z_-]{10,}/gi, "[REDACTED]");
  mensaje = mensaje.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
  if (mensaje.length > 400) {
    return `${mensaje.slice(0, 400)}…`;
  }
  return mensaje;
}

/** Solo para logs de servidor; no incluir prompts ni datos de cultivo. */
export function extraerDiagnosticoGemini(error, modelo) {
  const tipo = error?.name || "Error";
  const httpStatus = error?.status ?? null;
  let codigo = "";
  let mensaje = sanitizarMensajeErrorGemini(error?.message);

  if (mensaje.startsWith("{")) {
    try {
      const parsed = JSON.parse(mensaje);
      const detalle = parsed?.error ?? parsed;
      codigo = String(detalle?.status ?? detalle?.code ?? "");
      if (detalle?.message) {
        mensaje = sanitizarMensajeErrorGemini(detalle.message);
      }
    } catch {
      /* mantener mensaje crudo ya sanitizado */
    }
  }

  return {
    tipo,
    httpStatus,
    codigo,
    modelo: modelo || modeloFloraGeminiPublico(),
    mensaje,
  };
}

function registrarDiagnosticoGemini(diagnostico) {
  console.error("[flora-gemini] diagnostico", JSON.stringify(diagnostico));
}

function mensajeErrorGemini(error) {
  const nombre = error?.name || "";
  const status = error?.status || error?.code || error?.error?.code;
  const mensaje = String(error?.message || error?.error?.message || "");

  if (status === 429 || /quota|rate/i.test(mensaje)) {
    return "Flora está con mucha demanda ahora. Probá en unos minutos.";
  }
  if (status === 401 || status === 403 || /api key/i.test(mensaje)) {
    return "No pudimos conectar con el servicio de IA. El equipo tiene que revisar la configuración.";
  }
  if (/blocked|safety|SAFETY/i.test(mensaje)) {
    return "No pude responder a eso por políticas de seguridad del proveedor.";
  }
  if (nombre === "AbortError" || /timeout/i.test(mensaje)) {
    return "La consulta tardó demasiado. Probá con una pregunta más acotada.";
  }
  return "Flora no pudo responder en este momento. Intentá de nuevo.";
}

function extraerTextoRespuesta(response) {
  const texto = String(response?.text || "").trim();
  if (texto) return texto;
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

export async function conversarConFlora(
  supabase,
  { mensaje, historial = [], contextoSolucionId = "", adjuntosImagen = [] },
) {
  const adjuntos = Array.isArray(adjuntosImagen) ? adjuntosImagen : [];
  const validacion = validarMensajeUsuario(mensaje, { conImagen: adjuntos.length > 0 });
  if (!validacion.ok) return { ok: false, error: validacion.error, texto: "" };

  const clienteInfo = crearClienteGemini();
  if (!clienteInfo.ok) return { ok: false, error: clienteInfo.error, texto: "" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const usuarioId = user?.id || "";
  if (!usuarioId) {
    return { ok: false, error: "Tenés que iniciar sesión para hablar con Flora.", texto: "" };
  }

  const imagenResuelta = await resolverAdjuntosParaGemini(supabase, usuarioId, adjuntos);
  if (!imagenResuelta.ok) {
    return { ok: false, error: imagenResuelta.error || "No se pudo usar la imagen.", texto: "" };
  }

  const historialNorm = normalizarHistorialCliente(historial);

  const preguntaVisible = validacion.texto || normalizarPreguntaConImagen("");
  let textoUsuario = preguntaVisible;
  if (imagenResuelta.contextos?.length) {
    textoUsuario = `${imagenResuelta.contextos.join("\n\n")}\n\nConsulta del usuario:\n${preguntaVisible}`;
  } else if (imagenResuelta.partesImagen?.length) {
    textoUsuario = `El usuario envió ${imagenResuelta.partesImagen.length === 1 ? "una fotografía" : `${imagenResuelta.partesImagen.length} fotografías`} desde su dispositivo (procesadas por el proveedor de IA; no quedan guardadas en ENFLORA).\n\nConsulta del usuario:\n${preguntaVisible}`;
  }
  if (contextoSolucionId && historialNorm.length === 0) {
    const continuar = await cargarSolucionParaContinuar(supabase, contextoSolucionId);
    if (continuar.ok && continuar.solucion) {
      textoUsuario = `${textoContextoContinuarSolucion(continuar.solucion)}\n\n---\n\nNueva consulta del usuario:\n${textoUsuario}`;
    }
  }
  // En Vercel Hobby (~10s de función) el índice inicial + Gemini + tools suele exceder el límite.
  const indice =
    historialNorm.length === 0 && process.env.VERCEL !== "1"
      ? await indiceCompactoInicial(supabase)
      : "";

  const personalidad = await leerPersonalidadFloraUsuario(supabase);
  const instruccionBase = construirInstruccionSistemaFlora(personalidad);

  const systemInstruction = indice
    ? `${instruccionBase}\n\nÍndice compacto del cultivo del usuario (solo referencia; usá herramientas para detalle):\n${indice}`
    : instruccionBase;

  const contents = [
    ...historialAGemini(historialNorm),
    {
      role: "user",
      parts: construirPartesUsuarioGemini(textoUsuario, imagenResuelta.partesImagen),
    },
  ];

  const contextoGuardado = crearContextoGuardadoVacio();
  fusionarEntidadesImagenEnGuardado(contextoGuardado, imagenResuelta.entidades);

  const modelo = modeloFloraGemini();
  const configBase = {
    systemInstruction,
    tools: [{ functionDeclarations: DECLARACIONES_HERRAMIENTAS_GEMINI }],
    // allowedFunctionNames solo es válido con mode ANY en la API de Gemini; la lista
    // permitida se aplica en ejecutarHerramientaFlora (servidor).
    toolConfig: {
      functionCallingConfig: {
        mode: "AUTO",
      },
    },
    automaticFunctionCalling: { disable: true },
  };

  let llamadas = 0;
  let contenidoAcumulado = contents;

  const ejecutar = async () => {
    return clienteInfo.cliente.models.generateContent({
      model: modelo,
      contents: contenidoAcumulado,
      config: configBase,
    });
  };

  const conTimeout = () =>
    Promise.race([
      ejecutar(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), LIMITES_CHAT_FLORA.timeoutMs);
      }),
    ]);

  try {
    let response = await conTimeout();

    while (response.functionCalls?.length && llamadas < LIMITES_CHAT_FLORA.maxLlamadasHerramientasPorMensaje) {
      const modelContent = response.candidates?.[0]?.content;
      if (!modelContent) break;

      const partesRespuesta = [];
      for (const llamada of response.functionCalls) {
        llamadas += 1;
        const nombre = llamada?.name;
        const resultado = await ejecutarHerramientaFlora(supabase, nombre, llamada?.args || {});
        fusionarContextoGuardadoDesdeHerramienta(contextoGuardado, resultado);
        partesRespuesta.push({
          functionResponse: {
            name: nombre,
            response: resultado,
          },
        });
        if (llamadas >= LIMITES_CHAT_FLORA.maxLlamadasHerramientasPorMensaje) break;
      }

      contenidoAcumulado = [
        ...contenidoAcumulado,
        modelContent,
        { role: "user", parts: partesRespuesta },
      ];

      response = await conTimeout();
    }

    const textoFinal = extraerTextoRespuesta(response);
    if (!textoFinal) {
      return {
        ok: false,
        error: "Flora no generó una respuesta. Probá reformular la pregunta.",
        texto: "",
      };
    }

    const textoParaGuardado = preguntaVisible;
    const guardado =
      usuarioId && (validacion.texto || adjuntos.length)
        ? {
            token: emitirTokenProcedenciaSolucion(usuarioId, textoParaGuardado, textoFinal),
            tituloSugerido: sugerirTituloSolucion(textoParaGuardado),
            fechaRespuesta: new Date().toISOString(),
            referencias: referenciasJsonParaGuardado(contextoGuardado),
            unidadCultivoId: contextoGuardado.unidadCultivoId || undefined,
            plantaId: contextoGuardado.plantaId || undefined,
            claveUnicaTurno: claveUnicaTurnoGuardado(textoParaGuardado, textoFinal),
            imagenTransitoria: contextoGuardado.imagenTransitoria || undefined,
          }
        : undefined;

    return {
      ok: true,
      error: "",
      texto: textoFinal,
      meta: {
        llamadasHerramientas: llamadas,
        modelo,
        guardado,
        imagen: adjuntos.length
          ? {
              cantidad: adjuntos.length,
              transitoria: adjuntos.some((a) => a.origen === "transitoria"),
            }
          : undefined,
      },
    };
  } catch (error) {
    const diagnostico = extraerDiagnosticoGemini(error, modelo);
    registrarDiagnosticoGemini(diagnostico);
    return {
      ok: false,
      error: mensajeErrorGemini(error),
      texto: "",
      diagnostico,
    };
  }
}
