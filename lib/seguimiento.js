export const TIPOS_SEGUIMIENTO = [
  {
    valor: "relajado",
    etiqueta: "Relajado",
    descripcion: "Quiero registrar lo esencial y mantener un seguimiento simple.",
    ejemplos: "Riegos · Fotos · Notas · Tareas",
  },
  {
    valor: "profesional",
    etiqueta: "Profesional",
    descripcion: "Quiero tener acceso rápido a mediciones y datos más técnicos.",
    ejemplos: "Riegos · Fotos · pH · EC · Temperatura · Humedad",
  },
  {
    valor: "personalizado",
    etiqueta: "Personalizado",
    descripcion: "Quiero elegir exactamente qué acciones y parámetros quiero registrar.",
    ejemplos: "Armás tu propia lista",
  },
];

export function esTipoSeguimiento(valor) {
  return TIPOS_SEGUIMIENTO.some((tipo) => tipo.valor === valor);
}

export function etiquetaSeguimiento(valor) {
  const tipo = TIPOS_SEGUIMIENTO.find((item) => item.valor === valor);
  return tipo ? tipo.etiqueta : "";
}

export const ACCIONES_SEGUIMIENTO = [
  { valor: "riego", etiqueta: "Riego" },
  { valor: "foto", etiqueta: "Foto" },
  { valor: "nota", etiqueta: "Nota" },
  { valor: "tarea", etiqueta: "Tarea" },
  { valor: "poda", etiqueta: "Poda" },
  { valor: "fertilizacion", etiqueta: "Fertilización" },
];

export const PARAMETROS_SEGUIMIENTO = [
  { valor: "ph", etiqueta: "pH", tipoValor: "numero", unidad: "" },
  { valor: "ec", etiqueta: "EC", tipoValor: "numero", unidad: "" },
  { valor: "ppm", etiqueta: "PPM", tipoValor: "numero", unidad: "ppm" },
  { valor: "temperatura", etiqueta: "Temperatura", tipoValor: "numero", unidad: "°C" },
  { valor: "humedad", etiqueta: "Humedad", tipoValor: "numero", unidad: "%" },
  { valor: "vpd", etiqueta: "VPD", tipoValor: "numero", unidad: "kPa" },
];

export const TIPOS_VALOR = [
  { valor: "numero", etiqueta: "Número" },
  { valor: "texto", etiqueta: "Texto" },
];

export const LIMITE_NOMBRE_OPCION = 60;
export const LIMITE_UNIDAD_OPCION = 16;

export const PRESETS_SEGUIMIENTO = {
  relajado: {
    acciones: ["riego", "foto", "nota", "tarea"],
    parametros: [],
  },
  profesional: {
    acciones: ["riego", "foto", "nota", "fertilizacion"],
    parametros: ["ph", "ec", "temperatura", "humedad"],
  },
  personalizado: {
    acciones: [],
    parametros: [],
  },
};

export function presetDe(tipo) {
  const preset = PRESETS_SEGUIMIENTO[tipo];
  if (!preset) return { acciones: [], parametros: [] };
  return {
    acciones: [...preset.acciones],
    parametros: [...preset.parametros],
  };
}

export function ordenarPreferencias(valores, catalogo) {
  const elegidos = new Set(valores || []);
  return catalogo.filter((item) => elegidos.has(item.valor)).map((item) => item.valor);
}

export function preferenciasValidas(acciones, parametros) {
  const accionesOk = (acciones || []).every((valor) =>
    ACCIONES_SEGUIMIENTO.some((item) => item.valor === valor)
  );
  const parametrosOk = (parametros || []).every((valor) =>
    PARAMETROS_SEGUIMIENTO.some((item) => item.valor === valor)
  );
  return accionesOk && parametrosOk;
}

export function esTipoValor(valor) {
  return TIPOS_VALOR.some((tipo) => tipo.valor === valor);
}

export function nombreOpcionValido(nombre) {
  const limpio = String(nombre || "").trim();
  return limpio.length >= 1 && limpio.length <= LIMITE_NOMBRE_OPCION;
}

export function unidadOpcionValida(unidad) {
  const limpia = String(unidad || "").trim();
  return limpia.length <= LIMITE_UNIDAD_OPCION;
}
