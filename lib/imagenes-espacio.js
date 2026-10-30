// Ilustraciones de Flora para espacios interior/exterior (public/images/app).
export const ILUSTRACIONES_ESPACIO = {
  interior: "/images/app/interior-cultivos.png",
  exterior: "/images/app/exterior-cultivos.png",
};

/** Tamaño fuente de las ilustraciones (px); la miniatura escala con max-width/height en CSS. */
export const DIMENSIONES_ILUSTRACION_ESPACIO = {
  interior: { width: 1448, height: 1086 },
  exterior: { width: 1448, height: 1086 },
};

export function ilustracionEspacio(tipo) {
  if (tipo === "interior") return ILUSTRACIONES_ESPACIO.interior;
  if (tipo === "exterior") return ILUSTRACIONES_ESPACIO.exterior;
  return null;
}

export function dimensionesIlustracionEspacio(tipo) {
  if (tipo === "interior") return DIMENSIONES_ILUSTRACION_ESPACIO.interior;
  if (tipo === "exterior") return DIMENSIONES_ILUSTRACION_ESPACIO.exterior;
  return null;
}
