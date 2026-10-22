import { textoArAEscala4 } from "./dinero.js";

export const FUENTE_BNA = "Banco Nación";
export const URL_BNA = "https://www.bna.com.ar/Personas";
export const TIPO_COTIZACION = "billete_vendedor";
export const DIAS_VIGENCIA_COTIZACION = 7;

const CACHE_MS = 15 * 60 * 1000;
let cache = null;

export function instanteArgentina(dia, mes, anio, hora, minuto) {
  return new Date(Date.UTC(anio, mes - 1, dia, hora + 3, minuto, 0)).toISOString();
}

export function parsearBilleteVendedor(html) {
  const sinScripts = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const corte = sinScripts.search(/Hora\s+Actualizaci[oó]n/i);
  if (corte < 0) return null;
  const billetes = sinScripts.slice(0, corte + 40);
  const fecha = billetes.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const hora = sinScripts
    .slice(corte, corte + 40)
    .match(/Hora\s+Actualizaci[oó]n:\s*(\d{1,2}):(\d{2})/i);
  const fila = billetes.match(
    /D[oó]lar\s+U\.S\.A[\s\S]{0,240}?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})[\s\S]{0,120}?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
  );
  if (!fecha || !hora || !fila) return null;
  const compra = textoArAEscala4(fila[1]);
  const venta = textoArAEscala4(fila[2]);
  if (!compra || !venta) return null;
  return {
    compra,
    venta,
    publicadaEn: instanteArgentina(
      Number(fecha[1]),
      Number(fecha[2]),
      Number(fecha[3]),
      Number(hora[1]),
      Number(hora[2]),
    ),
    fuente: FUENTE_BNA,
    url: URL_BNA,
    tipo: TIPO_COTIZACION,
    mercado: "billete",
    punta: "vendedor",
  };
}

export function evaluarCotizacion(cotizacion, ahora = new Date()) {
  if (!cotizacion || cotizacion.tipo !== TIPO_COTIZACION || cotizacion.punta !== "vendedor") {
    return { ok: false, codigo: "cotizacion_invalida" };
  }
  if (!Number.isInteger(cotizacion.venta) || cotizacion.venta <= 0) {
    return { ok: false, codigo: "cotizacion_invalida" };
  }
  const publicada = new Date(cotizacion.publicadaEn);
  if (Number.isNaN(publicada.getTime())) {
    return { ok: false, codigo: "cotizacion_invalida" };
  }
  const edadMs = ahora.getTime() - publicada.getTime();
  if (edadMs < -60 * 60 * 1000) {
    return { ok: false, codigo: "cotizacion_invalida" };
  }
  const limite = DIAS_VIGENCIA_COTIZACION * 24 * 60 * 60 * 1000;
  if (edadMs > limite) {
    return { ok: false, codigo: "cotizacion_antigua" };
  }
  return {
    ok: true,
    cotizacion,
    vigenteHasta: new Date(publicada.getTime() + limite).toISOString(),
  };
}

export async function obtenerCotizacionBilleteVendedor(ahora = new Date()) {
  if (cache && cache.expira > Date.now()) {
    const guardada = evaluarCotizacion(cache.cotizacion, ahora);
    if (guardada.ok) return guardada;
  }
  try {
    const respuesta = await fetch(URL_BNA, {
      cache: "no-store",
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 ENFLORA cotizacion-billete",
      },
    });
    if (!respuesta.ok) return { ok: false, codigo: "cotizacion_no_disponible" };
    const html = await respuesta.text();
    const cotizacion = parsearBilleteVendedor(html);
    const evaluada = evaluarCotizacion(cotizacion, ahora);
    if (evaluada.ok) cache = { cotizacion, expira: Date.now() + CACHE_MS };
    return evaluada.ok ? evaluada : { ok: false, codigo: evaluada.codigo };
  } catch {
    return { ok: false, codigo: "cotizacion_no_disponible" };
  }
}
