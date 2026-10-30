const URL_OFICIAL = "https://dolarapi.com/v1/dolares/oficial";

/** Enlace público al recurso que consume Enflora para el dólar oficial. */
export const ENLACE_FUENTE_COTIZACION = {
  href: URL_OFICIAL,
  etiqueta: "dolarapi.com — dólar oficial",
};
const ZONA_AR = "America/Argentina/Buenos_Aires";
const OFFSET_AR_HORAS = 3;
const MINUTO_VENTANA = 20;
const HORAS_VENTANA = [4, 16];
const TAG_COTIZACION = "cotizacion-oficial";

function partesEnArgentina(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  return Object.fromEntries(
    partes.filter((parte) => parte.type !== "literal").map((parte) => [parte.type, parte.value]),
  );
}

function utcDesdeArgentina(anio, mes, dia, hora, minuto) {
  return new Date(Date.UTC(anio, mes - 1, dia, hora + OFFSET_AR_HORAS, minuto, 0));
}

function sumarDiasCalendario(anio, mes, dia, dias) {
  const base = new Date(Date.UTC(anio, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() + dias);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

export function obtenerClaveVentanaCotizacion(fecha = new Date()) {
  const partes = partesEnArgentina(fecha);
  const anio = Number(partes.year);
  const mes = Number(partes.month);
  const dia = Number(partes.day);
  const minutos = Number(partes.hour) * 60 + Number(partes.minute);
  const am = HORAS_VENTANA[0] * 60 + MINUTO_VENTANA;
  const pm = HORAS_VENTANA[1] * 60 + MINUTO_VENTANA;

  if (minutos >= pm) {
    return `${partes.year}-${partes.month}-${partes.day}-1620`;
  }
  if (minutos >= am) {
    return `${partes.year}-${partes.month}-${partes.day}-0420`;
  }
  const anterior = sumarDiasCalendario(anio, mes, dia, -1);
  const y = String(anterior.year);
  const m = String(anterior.month).padStart(2, "0");
  const d = String(anterior.day).padStart(2, "0");
  return `${y}-${m}-${d}-1620`;
}

export function segundosHastaProximaVentanaCotizacion(fecha = new Date()) {
  const partes = partesEnArgentina(fecha);
  const anio = Number(partes.year);
  const mes = Number(partes.month);
  const dia = Number(partes.day);
  const minutos =
    Number(partes.hour) * 60 + Number(partes.minute) + Number(partes.second) / 60;
  const am = HORAS_VENTANA[0] * 60 + MINUTO_VENTANA;
  const pm = HORAS_VENTANA[1] * 60 + MINUTO_VENTANA;

  let objetivo;
  if (minutos < am) {
    objetivo = utcDesdeArgentina(anio, mes, dia, HORAS_VENTANA[0], MINUTO_VENTANA);
  } else if (minutos < pm) {
    objetivo = utcDesdeArgentina(anio, mes, dia, HORAS_VENTANA[1], MINUTO_VENTANA);
  } else {
    const manana = sumarDiasCalendario(anio, mes, dia, 1);
    objetivo = utcDesdeArgentina(
      manana.year,
      manana.month,
      manana.day,
      HORAS_VENTANA[0],
      MINUTO_VENTANA,
    );
  }

  return Math.max(1, Math.ceil((objetivo.getTime() - fecha.getTime()) / 1000));
}

function parsearCotizacion(data, ventana) {
  const valor = Number(data?.venta ?? data?.compra);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const fechaFuente =
    typeof data?.fechaActualizacion === "string" ? data.fechaActualizacion : null;
  return {
    valor,
    fecha: new Date().toISOString(),
    fechaFuente,
    fuente: "dolarapi-oficial",
    ventana,
  };
}

async function pedirCotizacionOficial({ forzar = false } = {}) {
  const ventana = obtenerClaveVentanaCotizacion();
  const revalidate = segundosHastaProximaVentanaCotizacion();
  const respuesta = await fetch(URL_OFICIAL, {
    ...(forzar
      ? { cache: "no-store" }
      : {
          next: {
            revalidate,
            tags: [TAG_COTIZACION, `cotizacion-${ventana}`],
          },
        }),
    headers: { Accept: "application/json" },
  });
  if (!respuesta.ok) return null;
  const data = await respuesta.json();
  return parsearCotizacion(data, ventana);
}

export async function obtenerCotizacionOficial() {
  try {
    return await pedirCotizacionOficial();
  } catch {
    return null;
  }
}

export async function actualizarCotizacionOficial() {
  try {
    return await pedirCotizacionOficial({ forzar: true });
  } catch {
    return null;
  }
}

export const tagCotizacionOficial = TAG_COTIZACION;

export function convertirUsdAArs(usd, cotizacion) {
  const monto = Number(usd);
  const valor = Number(cotizacion?.valor);
  if (!Number.isFinite(monto) || !Number.isFinite(valor) || valor <= 0) return null;
  return monto * valor;
}

function normalizarEspacios(texto) {
  return String(texto).replace(/[\u00a0\u202f]/g, " ");
}

export function formatearArs(monto) {
  if (!Number.isFinite(monto)) return "";
  return normalizarEspacios(
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(monto),
  );
}

export function formatearFechaCotizacion(fechaIso) {
  if (!fechaIso) return null;
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const mapa = Object.fromEntries(
    partes.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  if (!mapa.year || !mapa.month || !mapa.day || !mapa.hour || !mapa.minute) return null;
  return `${mapa.day}/${mapa.month}/${mapa.year} ${mapa.hour}:${mapa.minute}`;
}
