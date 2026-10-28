import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const LIMITES_FLORA_SOLUCIONES = {
  maxPorUsuario: 200,
  maxTitulo: 120,
  maxPregunta: 2000,
  maxRespuesta: 50_000,
  maxResultadosBusquedaGemini: 8,
  ttlTokenProcedenciaMs: 2 * 60 * 60 * 1000,
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hashTexto(texto) {
  return createHash("sha256").update(String(texto ?? ""), "utf8").digest("hex");
}

function secretoProcedencia() {
  return (
    process.env.FLORA_GUARDADO_SECRETO ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.GEMINI_API_KEY ||
    "dev-solo-local-flora-guardado"
  );
}

export function sugerirTituloSolucion(pregunta) {
  const limpio = String(pregunta ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!limpio) return "Consulta con Flora";
  const recorte = limpio.length > 72 ? `${limpio.slice(0, 69)}…` : limpio;
  return recorte.charAt(0).toUpperCase() + recorte.slice(1);
}

/** Agrega referencias y entidades inferidas de respuestas de herramientas (sin inventar). */
export function fusionarContextoGuardadoDesdeHerramienta(acumulado, resultadoHerramienta) {
  if (!resultadoHerramienta || typeof resultadoHerramienta !== "object") return acumulado;

  const entidades = resultadoHerramienta.entidades;
  if (entidades && typeof entidades === "object") {
    if (entidades.unidad_id && UUID_RE.test(String(entidades.unidad_id))) {
      acumulado.unidadCultivoId = String(entidades.unidad_id);
    }
    if (entidades.planta_id && UUID_RE.test(String(entidades.planta_id))) {
      acumulado.plantaId = String(entidades.planta_id);
    }
    if (entidades.unidad_cultivo_id && UUID_RE.test(String(entidades.unidad_cultivo_id))) {
      acumulado.unidadCultivoId = String(entidades.unidad_cultivo_id);
    }
  }

  const datos = resultadoHerramienta.datos;
  const refsGuia = [];

  const fragmentos = Array.isArray(datos) ? datos : datos?.fragmentos;
  if (Array.isArray(fragmentos)) {
    for (const frag of fragmentos) {
      if (!frag || typeof frag !== "object") continue;
      if (frag.documentoId || frag.seccionId) {
        refsGuia.push({
          tipo: "guia_interna",
          documentoId: frag.documentoId || undefined,
          seccionId: frag.seccionId || undefined,
          titulo: frag.titulo || frag.seccionTitulo || undefined,
        });
      }
      if (Array.isArray(frag.referencias)) {
        for (const ref of frag.referencias) {
          if (ref && typeof ref === "object") {
            refsGuia.push({ tipo: "bibliografia", ...ref });
          }
        }
      }
    }
  }

  if (refsGuia.length) {
    const claves = new Set(acumulado.referencias.map((r) => JSON.stringify(r)));
    for (const ref of refsGuia) {
      const clave = JSON.stringify(ref);
      if (!claves.has(clave)) {
        claves.add(clave);
        acumulado.referencias.push(ref);
      }
    }
  }

  return acumulado;
}

export function crearContextoGuardadoVacio() {
  return {
    unidadCultivoId: "",
    plantaId: "",
    referencias: [],
  };
}

export function referenciasJsonParaGuardado(acumulado) {
  const payload = {
    procedencia: "turno_chat_flora",
    confiable: "respuesta_generada_en_fecha",
    guia: acumulado.referencias.filter((r) => r.tipo === "guia_interna" || r.documentoId),
    bibliografia: acumulado.referencias.filter((r) => r.tipo === "bibliografia"),
  };
  if (acumulado.unidadCultivoId || acumulado.plantaId) {
    payload.cultivo = {
      unidad_cultivo_id: acumulado.unidadCultivoId || undefined,
      planta_id: acumulado.plantaId || undefined,
    };
  }
  const tieneContenido =
    payload.guia.length > 0 ||
    payload.bibliografia.length > 0 ||
    payload.cultivo ||
    false;
  return tieneContenido ? payload : null;
}

export function claveUnicaTurnoGuardado(pregunta, respuesta) {
  return `${hashTexto(pregunta).slice(0, 24)}:${hashTexto(respuesta).slice(0, 24)}`;
}

export function emitirTokenProcedenciaSolucion(usuarioId, pregunta, respuesta) {
  const exp = Date.now() + LIMITES_FLORA_SOLUCIONES.ttlTokenProcedenciaMs;
  const cuerpo = `${usuarioId}\n${exp}\n${hashTexto(pregunta)}\n${hashTexto(respuesta)}`;
  const firma = createHmac("sha256", secretoProcedencia()).update(cuerpo).digest("base64url");
  return `${exp}.${firma}`;
}

export function verificarTokenProcedenciaSolucion(token, usuarioId, pregunta, respuesta) {
  const partes = String(token ?? "").split(".");
  if (partes.length !== 2) return { ok: false, error: "Token de guardado inválido." };
  const exp = Number(partes[0]);
  if (!Number.isFinite(exp) || exp < Date.now()) {
    return { ok: false, error: "El turno de chat expiró. Volvé a preguntarle a Flora para guardar." };
  }
  const cuerpo = `${usuarioId}\n${exp}\n${hashTexto(pregunta)}\n${hashTexto(respuesta)}`;
  const esperada = createHmac("sha256", secretoProcedencia()).update(cuerpo).digest("base64url");
  const a = Buffer.from(String(partes[1]));
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "No coinciden la pregunta, la respuesta y el turno de Flora." };
  }
  return { ok: true, error: "" };
}

export function validarTituloSolucion(titulo) {
  const s = String(titulo ?? "").trim();
  if (!s) return { ok: false, error: "El título no puede estar vacío.", valor: "" };
  if (s.length > LIMITES_FLORA_SOLUCIONES.maxTitulo) {
    return { ok: false, error: "El título es demasiado largo.", valor: "" };
  }
  return { ok: true, error: "", valor: s };
}

export function validarTextosGuardado({ pregunta, respuesta }) {
  const p = String(pregunta ?? "").trim();
  const r = String(respuesta ?? "").trim();
  if (!p || p.length > LIMITES_FLORA_SOLUCIONES.maxPregunta) {
    return { ok: false, error: "La pregunta no es válida." };
  }
  if (!r || r.length > LIMITES_FLORA_SOLUCIONES.maxRespuesta) {
    return { ok: false, error: "La respuesta no es válida." };
  }
  return { ok: true, error: "", pregunta: p, respuesta: r };
}

export function uuidSolucionOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") {
    return { ok: true, valor: null };
  }
  const s = String(valor).trim();
  if (!UUID_RE.test(s)) return { ok: false, error: `${campo} no es válido.` };
  return { ok: true, valor: s };
}

export async function contarSolucionesUsuario(supabase) {
  const { count, error } = await supabase
    .from("flora_soluciones")
    .select("id", { count: "exact", head: true });
  if (error) return { ok: false, count: 0, error: "No se pudo verificar el límite de soluciones." };
  return { ok: true, count: count ?? 0, error: "" };
}

export async function buscarSolucionesGuardadasGemini(supabase, { consulta, limite = 5 }) {
  const texto = String(consulta ?? "").trim();
  if (texto.length < 2) {
    return {
      fuente: "soluciones_guardadas",
      tipoConsulta: "buscar_soluciones",
      datos: [],
      metadatos: { sinDatos: true, historico: true },
      error: "La consulta de búsqueda debe tener al menos 2 caracteres.",
    };
  }

  const lim = Math.min(
    Math.max(1, Number(limite) || 5),
    LIMITES_FLORA_SOLUCIONES.maxResultadosBusquedaGemini,
  );

  const { data, error } = await supabase.rpc("flora_buscar_soluciones_guardadas", {
    p_consulta: texto,
    p_limite: lim,
  });

  if (error) {
    return {
      fuente: "soluciones_guardadas",
      tipoConsulta: "buscar_soluciones",
      datos: null,
      metadatos: { historico: true },
      error: "No se pudieron buscar soluciones guardadas.",
    };
  }

  const filas = (data || []).map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    pregunta: fila.pregunta,
    extracto: fila.extracto,
    fecha_respuesta: fila.fecha_respuesta,
    unidad_cultivo_id: fila.unidad_cultivo_id || undefined,
    planta_id: fila.planta_id || undefined,
    aviso:
      "Contenido histórico: refleja lo que Flora respondió en esa fecha; los datos actuales del cultivo pueden haber cambiado.",
  }));

  return {
    fuente: "soluciones_guardadas",
    tipoConsulta: "buscar_soluciones",
    datos: filas,
    metadatos: {
      sinDatos: filas.length === 0,
      cantidad: filas.length,
      historico: true,
      consulta: texto,
    },
    limitaciones: [
      "Las soluciones guardadas no reemplazan registros actuales. Para fechas o mediciones recientes, usá las herramientas de cultivo.",
    ],
  };
}

export async function cargarSolucionParaContinuar(supabase, solucionId) {
  const id = uuidSolucionOpcional(solucionId, "id");
  if (!id.ok) return { ok: false, error: id.error, solucion: null };

  const { data, error } = await supabase
    .from("flora_soluciones")
    .select("id, titulo, pregunta, respuesta, fecha_respuesta, referencias, unidad_cultivo_id, planta_id")
    .eq("id", id.valor)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "No encontramos esa solución guardada.", solucion: null };
  }

  return { ok: true, error: "", solucion: data };
}

export function textoContextoContinuarSolucion(solucion) {
  const fecha = solucion.fecha_respuesta
    ? new Date(solucion.fecha_respuesta).toLocaleString("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "fecha desconocida";

  return `[Contexto de una consulta guardada el ${fecha}. Es información histórica: los datos actuales del cultivo pueden haber cambiado. No uses esta respuesta como fuente de verdad para mediciones o fechas recientes sin volver a consultar los registros.]

Pregunta original:
${solucion.pregunta}

Respuesta que Flora dio entonces:
${solucion.respuesta}`;
}
