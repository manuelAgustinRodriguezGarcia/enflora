import { normalizarPersonalidadFlora } from "@/lib/flora-personalidad";

function conNombre(plantilla, nombre) {
  const quien = String(nombre || "").trim();
  return quien ? plantilla.replace("{nombre}", quien) : plantilla.replace(/,?\s*\{nombre\}/, "").replace(/\s{2,}/g, " ").trim();
}

export function saludoInicio(personalidad, nombre) {
  const { valor } = normalizarPersonalidadFlora(personalidad);

  switch (valor) {
    case "cercana_divertida":
      return conNombre("¿Qué hacés {nombre}, todo bien?", nombre);
    case "cercana_natural":
      return conNombre("Qué bueno verte, {nombre}", nombre);
    case "tecnica_profesional":
      return conNombre("A la espera de sus órdenes {nombre}!", nombre);
    default:
      return conNombre("Qué bueno verte, {nombre}", nombre);
  }
}
