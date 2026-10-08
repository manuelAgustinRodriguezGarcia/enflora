export const MAXIMO_UNIDADES = 20;
export const MAXIMO_PLANTAS = 100;

const TIPOS_INTERIOR = ["carpa", "sala", "otro"];
const TIPOS_EXTERIOR = ["invernadero", "aire_libre", "otro"];

export function tiposDeUnidad(tipoEspacio) {
  if (tipoEspacio === "interior") {
    return [
      { valor: "carpa", etiqueta: "Carpa" },
      { valor: "sala", etiqueta: "Sala de cultivo" },
      { valor: "otro", etiqueta: "Otro" },
    ];
  }

  if (tipoEspacio === "exterior") {
    return [
      { valor: "invernadero", etiqueta: "Invernadero" },
      { valor: "aire_libre", etiqueta: "Aire libre" },
      { valor: "otro", etiqueta: "Otro" },
    ];
  }

  return [];
}

export function tipoUnidadPermitido(tipoEspacio, tipoUnidad) {
  if (tipoEspacio === "interior") return TIPOS_INTERIOR.includes(tipoUnidad);
  if (tipoEspacio === "exterior") return TIPOS_EXTERIOR.includes(tipoUnidad);
  return false;
}

export function admiteVarias(tipoUnidad) {
  return tipoUnidad === "carpa" || tipoUnidad === "invernadero" || tipoUnidad === "otro";
}

export function nombreUnidad(tipo, numero, tipoPersonalizado = "", cantidad = 1) {
  if (tipo === "carpa") return `Carpa ${numero}`;
  if (tipo === "sala") return "Sala";
  if (tipo === "invernadero") return `Invernadero ${numero}`;
  if (tipo === "aire_libre") return "Aire libre";
  if (tipo === "otro") {
    const base = String(tipoPersonalizado || "").trim() || "Unidad";
    if (cantidad <= 1) return base;
    return `${base} ${numero}`;
  }
  return `Unidad ${numero}`;
}

export function nombreSugerido(tipo, datos = {}) {
  const carpas = datos.carpas || 0;
  const invernaderos = datos.invernaderos || 0;
  const personalizado = String(datos.tipoPersonalizado || "").trim();
  if (tipo === "carpa") return `Carpa ${carpas + 1}`;
  if (tipo === "invernadero") return `Invernadero ${invernaderos + 1}`;
  if (tipo === "otro") return personalizado || "Unidad";
  return nombreUnidad(tipo, 1);
}

export function etiquetaTipoUnidad(tipo, tipoPersonalizado = "") {
  if (tipo === "carpa") return "Carpa";
  if (tipo === "sala") return "Sala";
  if (tipo === "invernadero") return "Invernadero";
  if (tipo === "aire_libre") return "Aire libre";
  if (tipo === "otro") return String(tipoPersonalizado || "").trim() || "Otro";
  return tipo || "";
}

export function datosTipoUnidad(tipoEspacio, tipoUnidad, tipoPersonalizado) {
  const tipo = String(tipoUnidad || "").trim();
  const personalizado = String(tipoPersonalizado || "").trim();

  if (!tipoUnidadPermitido(tipoEspacio, tipo)) {
    return { error: "Seleccioná un tipo de unidad." };
  }

  if (tipo === "otro") {
    if (!personalizado) return { error: "Escribí el tipo de unidad." };
    return { tipo, tipo_personalizado: personalizado };
  }

  return { tipo, tipo_personalizado: null };
}

export function etiquetaTipoEspacio(tipo) {
  if (tipo === "interior") return "Interior";
  if (tipo === "exterior") return "Exterior";
  return tipo || "";
}

export function preguntaCantidadUnidades(tipo) {
  if (tipo === "carpa") return "¿Cuántas carpas tenés?";
  if (tipo === "invernadero") return "¿Cuántos invernaderos tenés?";
  if (tipo === "otro") return "¿Cuántas unidades de este tipo tenés?";
  return "";
}

export function textoCantidad(cantidad) {
  if (cantidad === 1) return "1 planta";
  return `${cantidad} plantas`;
}

export function mensajeReduccionUnidades(tipo, nombres) {
  const lista = nombres.join(", ");
  if (tipo === "carpa") {
    return `Al reducir la cantidad de carpas se eliminará la configuración de ${lista}.`;
  }
  if (tipo === "invernadero") {
    return `Al reducir la cantidad de invernaderos se eliminará la configuración de ${lista}.`;
  }
  return `Al reducir la cantidad se eliminará la configuración de ${lista}.`;
}
