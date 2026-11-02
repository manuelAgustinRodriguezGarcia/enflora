const ENTERO = new Intl.NumberFormat("es-AR");
const DECIMAL = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export function textoEntero(valor) {
  return ENTERO.format(valor);
}

export function textoBytes(bytes) {
  if (bytes < 1024) return `${textoEntero(bytes)} B`;
  if (bytes < 1024 * 1024) return `${DECIMAL.format(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${DECIMAL.format(bytes / (1024 * 1024))} MB`;
  return `${DECIMAL.format(bytes / (1024 * 1024 * 1024))} GB`;
}

export function textoInstante(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(fecha);
}

export function textoDia(dia) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!coincidencia) return dia;
  const fecha = new Date(Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3])));
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(fecha);
}
