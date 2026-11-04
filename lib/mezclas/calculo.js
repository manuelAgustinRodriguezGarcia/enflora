export const UNIDADES_VOLUMEN = ["L", "ml"];
export const UNIDADES_COMPONENTE = ["ml", "g", "L", "gotas", "ml/L", "g/L", "gotas/L"];
export const UNIDADES_DOSIS = ["ml/L", "g/L", "gotas/L", "ml", "g", "gotas"];
export const UNIDADES_APLICADAS = ["ml", "g", "L", "gotas", "ml/L", "g/L", "gotas/L"];
export const UNIDADES_POR_LITRO = ["ml/L", "g/L", "gotas/L"];

const UNIDAD_APLICADA_POR_LITRO = {
  "ml/L": "ml",
  "g/L": "g",
  "gotas/L": "gotas",
};

export function unidadesDosisVisibles(actual) {
  if (actual && !UNIDADES_DOSIS.includes(actual) && UNIDADES_COMPONENTE.includes(actual)) {
    return [...UNIDADES_DOSIS, actual];
  }
  return UNIDADES_DOSIS;
}

export const LIMITE_COMPONENTES = 24;
export const LIMITE_NOMBRE = 80;
export const LIMITE_FABRICANTE = 80;
export const LIMITE_CARACTERISTICAS = 2000;
export const LIMITE_NOTAS = 2000;
export const LIMITE_METODO = 40;
export const VOLUMEN_MAXIMO = 1000000;
export const TOLERANCIA_CANTIDAD = 0.0001;

export const TIPO_PRODUCTO_OTRO = "otro";
export const LIMITE_TIPO_PRODUCTO = 80;

export const TIPOS_PRODUCTO = [
  { valor: "fertilizantes_nutrientes", etiqueta: "Fertilizantes y/o nutrientes" },
  { valor: "estimulantes", etiqueta: "Estimulantes" },
  { valor: "reguladores_ph", etiqueta: "Reguladores de pH" },
  { valor: "potenciadores", etiqueta: "Potenciadores" },
  { valor: "correctores", etiqueta: "Correctores" },
  { valor: "microorganismos", etiqueta: "Microorganismos" },
  { valor: "proteccion_vegetal", etiqueta: "Protección vegetal" },
  { valor: "enmiendas", etiqueta: "Enmiendas" },
  { valor: "enzimas", etiqueta: "Enzimas" },
  { valor: TIPO_PRODUCTO_OTRO, etiqueta: "Otro producto" },
];

const ETIQUETAS_TIPO_ANTERIOR = {
  fertilizante: "Fertilizante",
  nutriente: "Nutriente",
  aditivo: "Aditivo",
};

export function esTipoProductoCatalogo(tipo) {
  return TIPOS_PRODUCTO.some((item) => item.valor === tipo && item.valor !== TIPO_PRODUCTO_OTRO);
}

export function esTipoProductoAnterior(tipo) {
  return Object.hasOwn(ETIQUETAS_TIPO_ANTERIOR, tipo);
}

export function formularioTipoProducto(tipoGuardado) {
  const tipo = String(tipoGuardado || "").trim();
  if (esTipoProductoCatalogo(tipo) || esTipoProductoAnterior(tipo)) {
    return { tipo, categoria: "" };
  }
  return { tipo: TIPO_PRODUCTO_OTRO, categoria: tipo };
}

export function parsearCantidad(valor) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }
  const texto = String(valor ?? "").trim().replace(",", ".");
  if (!texto || !/^\d+(\.\d+)?$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

export function redondearCantidad(valor, decimales = 4) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  const factor = 10 ** decimales;
  return Math.round((numero + Number.EPSILON) * factor) / factor;
}

export function cantidadesEquivalentes(a, b) {
  const izquierda = Number(a);
  const derecha = Number(b);
  if (!Number.isFinite(izquierda) || !Number.isFinite(derecha)) return false;
  return Math.abs(izquierda - derecha) <= TOLERANCIA_CANTIDAD;
}

export function litrosDe(volumen, unidad) {
  const cantidad = parsearCantidad(volumen);
  if (cantidad === null || cantidad <= 0) return null;
  if (unidad === "L") return cantidad;
  if (unidad === "ml") return cantidad / 1000;
  return null;
}

export function mililitrosDe(volumen, unidad) {
  const litros = litrosDe(volumen, unidad);
  if (litros === null) return null;
  return litros * 1000;
}

export function esUnidadPorLitro(unidad) {
  return UNIDADES_POR_LITRO.includes(unidad);
}

// El volumen es el total preparado para esa aplicación.
// ml/L, g/L y gotas/L se escalan solo si hay litros. gotas no pasan a mililitros.
// ml, g, L y gotas quedan como cantidades absolutas.
export function cantidadAplicada({ cantidad, unidad, volumenAgua, unidadVolumen }) {
  const dosis = Number(cantidad);
  if (!Number.isFinite(dosis) || dosis <= 0) return null;
  if (!UNIDADES_COMPONENTE.includes(unidad)) return null;

  const destino = UNIDAD_APLICADA_POR_LITRO[unidad];
  if (destino) {
    const litros = litrosDe(volumenAgua, unidadVolumen);
    if (litros === null) return null;
    const aplicada = redondearCantidad(dosis * litros);
    if (aplicada === null || aplicada <= 0) return null;
    return { cantidad: aplicada, unidad: destino };
  }

  const absoluta = redondearCantidad(dosis);
  if (absoluta === null || absoluta <= 0) return null;
  return { cantidad: absoluta, unidad };
}

export function textoCantidad(cantidad) {
  const numero = redondearCantidad(cantidad);
  if (numero === null) return "";
  const texto = Number.isInteger(numero) ? String(numero) : String(numero);
  return texto.replace(".", ",");
}

export function textoMedida(cantidad, unidad) {
  const texto = textoCantidad(cantidad);
  if (!texto || !unidad) return "";
  return `${texto} ${unidad}`;
}

export function etiquetaTipoProducto(tipo) {
  const catalogo = TIPOS_PRODUCTO.find((item) => item.valor === tipo && item.valor !== TIPO_PRODUCTO_OTRO);
  if (catalogo) return catalogo.etiqueta;
  return ETIQUETAS_TIPO_ANTERIOR[tipo] || tipo || "";
}

const TONOS_CATEGORIA = {
  fertilizantes_nutrientes: "fertilizantes",
  estimulantes: "estimulantes",
  reguladores_ph: "ph",
  potenciadores: "potenciadores",
  correctores: "correctores",
  microorganismos: "microorganismos",
  proteccion_vegetal: "proteccion",
  enmiendas: "enmiendas",
  enzimas: "enzimas",
  fertilizante: "fertilizantes",
  nutriente: "nutrientes",
  aditivo: "aditivos",
};

export function tonoCategoriaProducto(tipo) {
  const clave = String(tipo || "").trim();
  return TONOS_CATEGORIA[clave] || "otro";
}
