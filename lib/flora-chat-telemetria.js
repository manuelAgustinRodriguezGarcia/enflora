import "server-only";

import { randomUUID } from "node:crypto";

/** Telemetría liviana por solicitud (solo logs de servidor; sin PII). */
export function crearIdSolicitudFlora() {
  return randomUUID();
}

export function crearTelemetriaFlora(requestId) {
  const inicio = Date.now();
  const marcas = {};
  const llamadasGemini = [];
  const herramientas = [];

  return {
    marcar(etapa) {
      if (!etapa || marcas[etapa] !== undefined) return;
      marcas[etapa] = Date.now() - inicio;
    },
    registrarGemini({ indice, duracionMs, usage }) {
      llamadasGemini.push({
        indice,
        duracionMs: Math.round(duracionMs),
        ...(usage?.promptTokenCount != null ? { promptTokens: usage.promptTokenCount } : {}),
        ...(usage?.candidatesTokenCount != null ? { candidatosTokens: usage.candidatesTokenCount } : {}),
        ...(usage?.totalTokenCount != null ? { totalTokens: usage.totalTokenCount } : {}),
      });
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
  return null;
}
