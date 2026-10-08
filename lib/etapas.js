export const ETAPAS = [
  { valor: "germinacion", etiqueta: "Germinación" },
  { valor: "plantula", etiqueta: "Plántula" },
  { valor: "vegetativo", etiqueta: "Vegetativo" },
  { valor: "floracion", etiqueta: "Floración" },
  { valor: "cosecha", etiqueta: "Cosecha" },
];

export function esEtapa(valor) {
  return ETAPAS.some((etapa) => etapa.valor === valor);
}

export function etiquetaEtapa(valor) {
  if (!valor) return "—";
  const etapa = ETAPAS.find((item) => item.valor === valor);
  return etapa ? etapa.etiqueta : valor;
}
