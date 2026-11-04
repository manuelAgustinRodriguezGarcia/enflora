import { MAX_FOTOS_POR_REGISTRO } from "@/lib/fotos";
import { diaArgentina, esUuid, horaArgentina } from "@/lib/historial-registros";
import { LIMITES_CHAT_FLORA } from "@/lib/flora-chat-limites";

export const MAX_FOTOS_REPORTE = MAX_FOTOS_POR_REGISTRO;
export const ALCANCES_REPORTE = Object.freeze(["unidad", "seleccion"]);
export const ORIGENES_REPORTE = Object.freeze(["inicio", "registro", "planta"]);
export const TOPE_MENSAJE_REPORTE_FLORA = Math.min(
  LIMITES_CHAT_FLORA.maxCaracteresMensaje,
  2000,
);

const CIERRE_MENSAJE =
  "Si necesitás etapas, mediciones o registros de esta unidad, consultá las herramientas. No modifiques datos. Las fotos, si las hay, son observaciones visuales: no las tomes como un diagnóstico confirmado.";

const NOTA_RECORTE = "La descripción completa quedó en el registro del cultivo.";

export function descripcionReporteValida(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) {
    return { ok: false, error: "Contale a Flora qué está pasando.", texto: "" };
  }
  if (texto.length > 4000) {
    return { ok: false, error: "La descripción es demasiado larga.", texto: "" };
  }
  return { ok: true, error: "", texto };
}

export function esAlcanceReporte(valor) {
  return ALCANCES_REPORTE.includes(valor);
}

export function alcanceRegistroDeReporte(alcance, cantidad) {
  if (alcance === "unidad") return "unidad";
  return cantidad === 1 ? "planta" : "plantas";
}

function plantasValidas(plantas) {
  return (plantas || []).filter((planta) => planta?.id && esUuid(planta.id));
}

function plantasDelMensaje(plantas) {
  return (plantas || []).filter((planta) => planta && (esUuid(planta.id) || String(planta.nombre || "").trim()));
}

/**
 * Alcance inicial editable.
 * Una sola planta queda como «todas» para no pedir una elección vacía, y el reporte sigue nombrando esa planta.
 * Una preselección parcial no se trata como si fueran las únicas posibles.
 */
export function seleccionInicialReporte({ origen = "inicio", plantaIds = [], plantasUnidad = [] } = {}) {
  const plantas = plantasValidas(plantasUnidad);
  const idsUnidad = new Set(plantas.map((planta) => planta.id));
  const validos = [...new Set((plantaIds || []).map((id) => String(id || "").trim()))].filter((id) =>
    idsUnidad.has(id),
  );

  if (plantas.length <= 1) {
    return { alcance: "unidad", ids: plantas.map((planta) => planta.id) };
  }

  const preseleccionParcial =
    (origen === "planta" || origen === "registro") && validos.length > 0 && validos.length < plantas.length;

  if (preseleccionParcial) {
    return { alcance: "seleccion", ids: validos };
  }

  return { alcance: "unidad", ids: plantas.map((planta) => planta.id) };
}

export function plantasAfectadasReporte({ alcance, plantasUnidad = [], idsSeleccionados = [] } = {}) {
  const plantas = plantasValidas(plantasUnidad);

  if (!esAlcanceReporte(alcance)) {
    return {
      ok: false,
      error: "Indicá si el problema es de todas las plantas o solo de algunas.",
      plantas: [],
    };
  }

  if (alcance === "unidad") {
    if (!plantas.length) {
      return { ok: false, error: "Esta unidad no tiene plantas para reportar.", plantas: [] };
    }
    return { ok: true, error: "", plantas };
  }

  const pedidos = [...new Set((idsSeleccionados || []).map((id) => String(id || "").trim()).filter(Boolean))];
  const porId = new Map(plantas.map((planta) => [planta.id, planta]));
  const elegidas = [];

  for (const id of pedidos) {
    const planta = porId.get(id);
    if (!planta) {
      return {
        ok: false,
        error: "Hay una planta que no pertenece a esta unidad.",
        plantas: [],
      };
    }
    elegidas.push(planta);
  }

  if (!elegidas.length) {
    return { ok: false, error: "Elegí al menos una planta.", plantas: [] };
  }

  return { ok: true, error: "", plantas: elegidas };
}

function nombrePlanta(planta) {
  const nombre = String(planta?.nombre || "").trim();
  if (nombre) return nombre;
  const numero = planta?.numero ?? planta?.numero_planta;
  return numero ? `Planta ${numero}` : "Planta";
}

function resumenPlantas(plantas) {
  const partes = plantas.map((planta) => {
    const genetica = String(planta?.genetica || planta?.genetica_planta || "").trim();
    return genetica ? `${nombrePlanta(planta)} (${genetica})` : nombrePlanta(planta);
  });
  const texto = partes.join(", ");
  if (texto.length <= 280) return texto;
  return `${plantas.length} plantas`;
}

function idsParaMensaje(plantas) {
  const ids = plantas.map((planta) => String(planta.id || "")).filter((id) => esUuid(id));
  if (!ids.length) return "";
  if (ids.length <= 12) return ids.join(",");
  return `${ids.slice(0, 12).join(",")} y ${ids.length - 12} más en el registro`;
}

function textoAlcance(alcance) {
  return alcance === "unidad" ? "todas las plantas de la unidad" : "selección específica";
}

export function armarMensajeFloraReporte({
  unidadNombre = "",
  unidadId = "",
  alcance = "unidad",
  plantas = [],
  descripcion = "",
  fechaIso = "",
  registroId = "",
} = {}) {
  const lista = plantasDelMensaje(plantas);
  const dia = fechaIso ? diaArgentina(fechaIso) : "";
  const hora = fechaIso ? horaArgentina(fechaIso) : "";
  const cuando = [dia, hora].filter(Boolean).join(" ");
  const ids = idsParaMensaje(lista);
  const encabezado = [
    "Necesito que analices un problema de mis plantas. Lo que escribo es lo que yo observo, no un diagnóstico.",
    "",
    `Unidad: ${String(unidadNombre || "Unidad").trim() || "Unidad"}`,
    `unidad_cultivo_id: ${unidadId}`,
    `Alcance: ${textoAlcance(alcance)}`,
    `Plantas: ${resumenPlantas(lista) || "sin nombre"}`,
    ids ? `planta_id: ${ids}` : "",
    cuando ? `Fecha: ${cuando}` : "",
    registroId ? `registro_id: ${registroId}` : "",
    "",
    "Qué está pasando:",
  ]
    .filter((linea) => linea !== "")
    .join("\n");

  const relato = String(descripcion || "").trim();
  const sufijo = `\n\n${CIERRE_MENSAJE}`;
  let texto = `${encabezado}\n${relato}${sufijo}`;

  if (texto.length > TOPE_MENSAJE_REPORTE_FLORA) {
    const aviso = `\n\n${NOTA_RECORTE}`;
    const disponible = TOPE_MENSAJE_REPORTE_FLORA - encabezado.length - aviso.length - sufijo.length - 1;
    const recorte = relato.slice(0, Math.max(0, disponible)).trimEnd();
    texto = `${encabezado}\n${recorte}${aviso}${sufijo}`;
  }

  if (texto.length > TOPE_MENSAJE_REPORTE_FLORA) {
    texto = texto.slice(0, TOPE_MENSAJE_REPORTE_FLORA);
  }

  return texto;
}

export function tituloChatReporte(unidadNombre) {
  const base = `Problema en ${String(unidadNombre || "tu cultivo").trim() || "tu cultivo"}`;
  return base.slice(0, 120);
}

export function claveSesionReporte(claveEnvio) {
  const limpia = String(claveEnvio || "").replace(/-/g, "");
  return `reporte-${limpia}`;
}
