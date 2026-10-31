/**
 * Política comercial MVP (sprint 2.1). Pago único ≡ Plus funcional, acotado al ciclo/unidad licenciada.
 * No sustituye cuotas operativas de chat (`lib/flora-chat-limites.js`).
 */

/** @typedef {"gratuito" | "plus"} NivelBeneficiosFlora */

/**
 * Consulta acotada a una unidad (p. ej. herramientas Flora con `unidad_id`): usar permisos de esa unidad.
 *
 * @param {NivelBeneficiosFlora} nivelUnidad
 */
export function nivelComercialConsultaUnidad(nivelUnidad) {
  return nivelUnidad === "plus" ? "plus" : "gratuito";
}

/**
 * Consulta que abarca varias unidades o un índice sin unidad explícita:
 * aplicar el nivel **más restrictivo** (gratuito) salvo que todas las unidades del alcance sean plus.
 *
 * @param {NivelBeneficiosFlora[]} niveles
 */
export function nivelComercialConsultaMultiplesUnidades(niveles) {
  const lista = (niveles || []).filter(Boolean);
  if (lista.length === 0) return "gratuito";
  if (lista.length === 1) return nivelComercialConsultaUnidad(lista[0]);
  return lista.every((n) => n === "plus") ? "plus" : "gratuito";
}

export const POLITICA_FLORA_IA = {
  equivalenciaPagoUnicoPlus:
    "El pago único otorga los mismos beneficios funcionales que Plus, solo dentro del ciclo licenciado y su unidad ancla.",
  cuotasComerciales: "Pendientes de definición; no se aplican topes comerciales inventados en chat.",
  operativo: "Los límites 6/min y 40/h son anti-abuso y aplican a todos los planes.",
  alcanceUnidadExplicita:
    "Si la consulta o herramienta fija una unidad de cultivo, los beneficios comerciales se resuelven con resolverBeneficiosFlora para esa unidad.",
  alcanceMultiplesUnidades:
    "Si el alcance incluye varias unidades con distintos permisos, se usa nivelComercialConsultaMultiplesUnidades (restrictivo salvo que todas sean plus).",
  alcanceCuentaSinUnidad:
    "Vista global o chat sin unidad: nivel gratuito para beneficios comerciales; la galería global mantiene tanda de 12.",
  plusSuscripcion: "La suscripción Plus aún no está implementada; no reservar beneficios exclusivos de Plus que el pago único ya debe recibir en su ciclo.",
};
