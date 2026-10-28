export const IMPORT_ID = "rdwc1-casa-delfi-v1";

export const ESPACIO_NOMBRE = "Casa delfi";
export const ESPACIO_TIPO = "interior";

export const UNIDAD_NOMBRE = "Carpa hidro";
export const UNIDAD_TIPO = "carpa";

export const METODO_CULTIVO = "RDWC";
export const GENETICA = "Gorila glue #4";
export const FECHA_INICIO = "2026-07-26";
export const FECHA_CORTE = "2026-10-23";
export const FECHA_ENFLORA = "2026-09-19";
export const ETAPA_INICIAL = "vegetativo";
export const ETAPA_ACTUAL = "enflora";

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
export const HORA_TECNICA = { hora: 12, minuto: 0 };

/** Nombres de opciones personalizadas de acción (categoría accion). */
export const OPCIONES_ACCION_IMPORT = [
  "Defoliación",
  "Cambio de solución",
  "Entrenamiento",
  "Otra acción",
];

export const TIPO_DEMO_A_OPCION = {
  defoliacion: "Defoliación",
  cambio_solucion: "Cambio de solución",
  entrenamiento: "Entrenamiento",
  otra: "Otra acción",
};

export const CONTEOS_ESPERADOS = {
  dias: 63,
  mediciones: 310,
  acciones: 12,
  fotosRegistro: 100,
  diasConNota: 14,
  etapas: 2,
};

export const RUTA_ESTADO_LOCAL = "private/importaciones/rdwc1-casa-delfi-v1.json";

export const CONFIRM_ENV = "ENFLORA_IMPORT_CONFIRM";
