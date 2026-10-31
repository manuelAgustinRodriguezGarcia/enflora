import { MAXIMO_PLANTAS } from "@/lib/unidades";

/**
 * Fuente: `lib/planes.js` — «Hasta 9 plantas por cultivo» (Gratuito).
 *
 * Alcance técnico adoptado para enforcement: **unidad de cultivo** (`unidades_cultivo`),
 * coherente con la demo (`plantasPorUnidad`, máx. 9) y con la licencia de pago único
 * (beneficios Plus en la unidad ancla mientras el ciclo activo tenga licencia válida).
 *
 * Ambigüedad resuelta para MVP: el copy comercial dice «unidad de cultivo» (`lib/planes.js`).
 * La licencia de pago único sigue atada al ciclo activo en esa unidad ancla.
 */
export const ALCANCE_PLANTAS_GRATUITO = "unidad_cultivo";

/** Mismo valor que el copy del plan Gratuito en `lib/planes.js`. */
export const PLANTAS_GRATUITO_POR_UNIDAD = 9;

/**
 * Comercial (`lib/planes.js`):
 * - Gratuito: cupo de plantas y galería acotados por unidad
 * - Plus / pago único: mismos beneficios funcionales; pago único solo en ciclo licenciado
 *
 * Operativo (`lib/flora-chat-limites.js`): rate limits anti-abuso para todos los planes.
 * Cuotas comerciales de IA: pendientes de definición (no inventar topes).
 */
export const FLORA_CHAT_COMERCIAL = {
  diferenciacionImplementada: false,
  equivalenciaPagoUnicoPlus: true,
  alcanceOperativo: "cuenta",
  politicaMultiplesUnidades:
    "Ver lib/flora-beneficios-politica.js — nivel restrictivo salvo unidad explícita licenciada o todas plus.",
};

export function limitePlantasComercial(nivel, maximoTecnico = MAXIMO_PLANTAS) {
  if (nivel === "plus") return maximoTecnico;
  return PLANTAS_GRATUITO_POR_UNIDAD;
}

export function evaluarAltaPlantas({ plantasExistentes, cantidadAAgregar, limitePermitido }) {
  const existentes = Number.isFinite(plantasExistentes) ? Math.max(0, Math.trunc(plantasExistentes)) : 0;
  const agregar = Number.isFinite(cantidadAAgregar) ? Math.max(0, Math.trunc(cantidadAAgregar)) : 0;
  const limite = Number.isFinite(limitePermitido)
    ? Math.max(1, Math.trunc(limitePermitido))
    : PLANTAS_GRATUITO_POR_UNIDAD;
  const totalDespues = existentes + agregar;

  if (totalDespues <= limite) {
    return { ok: true, limite, existentes, agregar, totalDespues };
  }

  const mensaje =
    limite <= PLANTAS_GRATUITO_POR_UNIDAD
      ? `El plan gratuito permite hasta ${limite} plantas en esta unidad de cultivo. Tenés ${existentes}; no podés sumar ${agregar} más.`
      : `Alcanzaste el límite técnico de ${limite} plantas en esta unidad. Tenés ${existentes}; no podés sumar ${agregar} más.`;

  return {
    ok: false,
    codigo: "limite_plantas_unidad",
    limite,
    existentes,
    agregar,
    totalDespues,
    mensaje,
  };
}
