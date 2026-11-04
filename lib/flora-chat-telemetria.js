import "server-only";

import { randomUUID } from "node:crypto";

function tokenReportado(valor) {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= 50_000_000;
}

function copiarTokenReportado(destino, clave, valor) {
  if (tokenReportado(valor)) destino[clave] = valor;
}

/** Telemetría liviana por solicitud (solo logs de servidor; sin PII). */
export function crearIdSolicitudFlora() {
  return randomUUID();
}

export function crearTelemetriaFlora(requestId) {
  const inicio = Date.now();
  const marcas = {};
  const llamadasGemini = [];
  const herramientas = [];
  let requestBytes = null;
  const imagenes = [];

  return {
    registrarRequest({ bytesBody } = {}) {
      if (typeof bytesBody === "number" && bytesBody >= 0) requestBytes = bytesBody;
    },
    registrarImagen(meta = {}) {
      if (!meta || typeof meta !== "object") return;
      imagenes.push({
        ...(meta.origen ? { origen: meta.origen } : {}),
        ...(meta.mimeType ? { mime: meta.mimeType } : {}),
        ...(meta.bytesImagen != null ? { bytesImagen: meta.bytesImagen } : {}),
        ...(meta.ancho != null ? { ancho: meta.ancho } : {}),
        ...(meta.alto != null ? { alto: meta.alto } : {}),
      });
    },
    marcar(etapa) {
      if (!etapa || marcas[etapa] !== undefined) return;
      marcas[etapa] = Date.now() - inicio;
    },
    registrarGemini({ indice, duracionMs, usage }) {
      const fila = {
        indice,
        duracionMs: Math.round(duracionMs),
      };
      copiarTokenReportado(fila, "promptTokens", usage?.promptTokenCount);
      copiarTokenReportado(fila, "candidatosTokens", usage?.candidatesTokenCount);
      copiarTokenReportado(fila, "totalTokens", usage?.totalTokenCount);
      copiarTokenReportado(fila, "pensamientoTokens", usage?.thoughtsTokenCount);
      copiarTokenReportado(fila, "cacheTokens", usage?.cachedContentTokenCount);
      copiarTokenReportado(fila, "herramientasTokens", usage?.toolUsePromptTokenCount);
      llamadasGemini.push(fila);
    },
    registrarHerramienta({ nombre, duracionMs, cantidadRegistros }) {
      herramientas.push({
        nombre,
        duracionMs: Math.round(duracionMs),
        ...(cantidadRegistros != null ? { cantidadRegistros } : {}),
      });
    },
    resumen(extra = {}) {
      return {
        requestId,
        msTotal: Date.now() - inicio,
        ...(requestBytes != null ? { requestBytes } : {}),
        ...(imagenes.length ? { imagenes } : {}),
        marcas,
        llamadasGemini,
        herramientas,
        ...extra,
      };
    },
  };
}

export function cantidadRegistrosHerramienta(resultado) {
  if (!resultado || typeof resultado !== "object") return null;
  const meta = resultado.metadatos;
  if (meta && typeof meta.cantidad === "number") return meta.cantidad;
  const datos = resultado.datos;
  if (Array.isArray(datos)) return datos.length;
  if (datos && Array.isArray(datos.registros_recientes)) return datos.registros_recientes.length;
  if (datos && Array.isArray(datos.eventos)) return datos.eventos.length;
  if (datos && Array.isArray(datos.aplicaciones)) return datos.aplicaciones.length;
  if (datos && Array.isArray(datos.tareas)) return datos.tareas.length;
  if (datos && Array.isArray(datos.productos)) return datos.productos.length;
  if (datos && Array.isArray(datos.pronostico)) return datos.pronostico.length;
  return null;
}
