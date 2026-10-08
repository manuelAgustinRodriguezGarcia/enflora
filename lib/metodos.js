export const METODOS_BASE = ["TIERRA", "COCO", "DWC", "RDWC", "HIDROPONIA", "AEROPONIA"];

export function esMetodoBase(nombre) {
  return METODOS_BASE.includes(nombre);
}

export function metodoConSustratoFijo(metodo) {
  return metodo === "TIERRA" || metodo === "COCO";
}

export function metodoPreguntaSustrato(metodo) {
  if (!metodo || metodoConSustratoFijo(metodo)) return false;
  return metodo === "otro" || !esMetodoBase(metodo);
}

export function muestraSustrato(metodo, usaSustrato) {
  if (metodoConSustratoFijo(metodo)) return true;
  if (metodoPreguntaSustrato(metodo)) return usaSustrato === "si";
  return false;
}

export function estadoTrasMetodo(item, metodo) {
  const metodoNombre = metodo === "otro" ? String(item?.metodoNombre || "") : "";

  if (metodoConSustratoFijo(metodo)) {
    return { ...item, metodo, metodoNombre, usaSustrato: "si" };
  }

  if (metodoPreguntaSustrato(metodo)) {
    const conserva = item?.metodo === metodo;
    const usa = conserva ? item.usaSustrato || "" : "";
    return {
      ...item,
      metodo,
      metodoNombre,
      usaSustrato: usa,
      sustrato: usa === "si" ? item.sustrato || "" : "",
    };
  }

  return { ...item, metodo, metodoNombre: "", usaSustrato: "", sustrato: "" };
}
