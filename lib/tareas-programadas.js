import { fechaHoy } from "@/lib/etapas";

export const LIMITE_DESCRIPCION_TAREA = 500;

const ZONA = "America/Argentina/Buenos_Aires";

export function fechaMananaLocal(fecha = new Date()) {
  const manana = new Date(fecha);
  manana.setDate(manana.getDate() + 1);
  const mes = String(manana.getMonth() + 1).padStart(2, "0");
  const dia = String(manana.getDate()).padStart(2, "0");
  return `${manana.getFullYear()}-${mes}-${dia}`;
}

export function fechaValidaTarea(texto) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(texto || "").trim());
}

export function tareaNoEsPasada(fechaTexto, hoy = fechaHoy()) {
  if (!fechaValidaTarea(fechaTexto)) return false;
  return fechaTexto >= hoy;
}

export function normalizarDescripcionTarea(valor) {
  const limpia = String(valor || "").trim();
  if (!limpia) return { error: "Escribí la tarea." };
  if (limpia.length > LIMITE_DESCRIPCION_TAREA) {
    return { error: `La tarea admite hasta ${LIMITE_DESCRIPCION_TAREA} caracteres.` };
  }
  return { descripcion: limpia };
}

// Si hay un subconjunto manual de plantas, se guardan ids; si es toda la unidad o ambiente, array vacío.
export function plantasIdsParaTarea({ aplicaA, plantasSeleccionadas, plantasUnidad, modoSeleccion }) {
  if (aplicaA === "ambiente") return [];
  const unidad = plantasUnidad || [];
  const elegidas = plantasSeleccionadas || [];
  if (!elegidas.length) return [];
  if (modoSeleccion === "unidad" || elegidas.length >= unidad.length) return [];
  return elegidas.map((planta) => planta.id).filter(Boolean);
}

export function etiquetaZonaTarea() {
  return ZONA;
}
