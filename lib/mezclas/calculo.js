export const UNIDADES_VOLUMEN = ["L", "ml"];
export const UNIDADES_COMPONENTE = ["ml", "g", "L", "ml/L", "g/L"];
export const UNIDADES_APLICADAS = ["ml", "g", "L"];
export const UNIDADES_POR_LITRO = ["ml/L", "g/L"];

export const LIMITE_COMPONENTES = 24;
export const LIMITE_NOMBRE = 80;
export const LIMITE_FABRICANTE = 80;
export const LIMITE_CARACTERISTICAS = 2000;
export const LIMITE_NOTAS = 2000;
export const LIMITE_METODO = 40;
export const VOLUMEN_MAXIMO = 1000000;
export const TOLERANCIA_CANTIDAD = 0.0001;

export const TIPOS_PRODUCTO = [
  { valor: "fertilizante", etiqueta: "Fertilizante" },
  { valor: "nutriente", etiqueta: "Nutriente" },
  { valor: "aditivo", etiqueta: "Aditivo" },
];

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
  const cantidad = Number(volumen);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
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
// ml/L y g/L se convierten a una cantidad absoluta. ml, g y L quedan iguales.
export function cantidadAplicada({ cantidad, unidad, volumenAgua, unidadVolumen }) {
  const dosis = Number(cantidad);
  if (!Number.isFinite(dosis) || dosis <= 0) return null;
  if (!UNIDADES_COMPONENTE.includes(unidad)) return null;

  if (unidad === "ml/L" || unidad === "g/L") {
    const litros = litrosDe(volumenAgua, unidadVolumen);
    if (litros === null) return null;
    const aplicada = redondearCantidad(dosis * litros);
    if (aplicada === null || aplicada <= 0) return null;
    return { cantidad: aplicada, unidad: unidad === "ml/L" ? "ml" : "g" };
  }

  const absoluta = redondearCantidad(dosis);
  if (absoluta === null || absoluta <= 0) return null;
  return { cantidad: absoluta, unidad };
}

export function textoMedida(cantidad, unidad) {
  const numero = redondearCantidad(cantidad);
  if (numero === null || !unidad) return "";
  const texto = Number.isInteger(numero) ? String(numero) : String(numero);
  return `${texto} ${unidad}`;
}

export function etiquetaTipoProducto(tipo) {
  return TIPOS_PRODUCTO.find((item) => item.valor === tipo)?.etiqueta || tipo || "";
}
