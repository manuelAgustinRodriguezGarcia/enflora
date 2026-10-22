export const PRECIO_LICENCIA_USD_CENTAVOS = 3000;
export const ESCALA_COTIZACION = 10000;

export function textoArAEscala4(texto) {
  const limpio = String(texto || "").trim();
  if (!/^\d{1,3}(\.\d{3})*,\d{2}$/.test(limpio) && !/^\d+,\d{2}$/.test(limpio)) {
    return null;
  }
  const centavos = BigInt(limpio.replace(/\./g, "").replace(",", ""));
  if (centavos <= 0n) return null;
  return Number(centavos * 100n);
}

export function escala4ADecimal(escala) {
  const valor = BigInt(escala);
  const entero = valor / BigInt(ESCALA_COTIZACION);
  const frac = (valor % BigInt(ESCALA_COTIZACION)).toString().padStart(4, "0");
  return `${entero}.${frac}`;
}

export function formatearCotizacion(escala) {
  const valor = BigInt(escala);
  const entero = valor / BigInt(ESCALA_COTIZACION);
  const dec = ((valor % BigInt(ESCALA_COTIZACION)) / 100n).toString().padStart(2, "0");
  const miles = new Intl.NumberFormat("es-AR").format(Number(entero));
  return `${miles},${dec}`;
}

export function importeLicenciaCentavos(escala) {
  const producto = BigInt(PRECIO_LICENCIA_USD_CENTAVOS) * BigInt(escala);
  const divisor = BigInt(ESCALA_COTIZACION);
  return Number((producto + divisor / 2n) / divisor);
}

export function textoImporteOrden(valor) {
  const texto = typeof valor === "number" ? String(valor) : String(valor ?? "").trim();
  const centavos = decimalACentavos(texto);
  if (centavos === null || centavos <= 0) return null;
  return centavosADecimal(centavos);
}

export function centavosADecimal(centavos) {
  const valor = BigInt(centavos);
  const signo = valor < 0n ? "-" : "";
  const abs = valor < 0n ? -valor : valor;
  const entero = abs / 100n;
  const dec = (abs % 100n).toString().padStart(2, "0");
  return `${signo}${entero}.${dec}`;
}

export function decimalACentavos(texto) {
  const limpio = String(texto || "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const negativo = limpio.startsWith("-");
  const [entero, frac = ""] = limpio.replace("-", "").split(".");
  const centavos = BigInt(entero) * 100n + BigInt(frac.padEnd(2, "0"));
  return Number(negativo ? -centavos : centavos);
}

export function mismosImportes(guardado, recibido) {
  const izquierda = decimalACentavos(typeof guardado === "number" ? String(guardado) : guardado);
  const derecha = decimalACentavos(typeof recibido === "number" ? String(recibido) : recibido);
  return izquierda !== null && derecha !== null && izquierda === derecha;
}

export function formatearCentavosArs(centavos) {
  const valor = BigInt(centavos);
  const negativo = valor < 0n;
  const abs = negativo ? -valor : valor;
  const entero = Number(abs / 100n);
  const dec = (abs % 100n).toString().padStart(2, "0");
  const miles = new Intl.NumberFormat("es-AR").format(entero);
  return `${negativo ? "-" : ""}$ ${miles},${dec}`;
}
