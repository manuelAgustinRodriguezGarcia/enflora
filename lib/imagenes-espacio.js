// Ilustraciones opcionales de Flora para espacios interior/exterior.
// Si agregás archivos en public/, asigná la ruta acá. Hoy no existen en el repo.
export const ILUSTRACIONES_ESPACIO = {
  interior: null,
  exterior: null,
};

export function ilustracionEspacio(tipo) {
  if (tipo === "interior") return ILUSTRACIONES_ESPACIO.interior;
  if (tipo === "exterior") return ILUSTRACIONES_ESPACIO.exterior;
  return null;
}
