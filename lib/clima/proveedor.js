import { DIAS_PRONOSTICO } from "@/lib/clima/constantes";

const BASE = "https://api.weatherapi.com/v1";

export function crearConsultaPronostico({ clave, latitud, longitud, alertas = true, dias = DIAS_PRONOSTICO }) {
  const url = new URL(`${BASE}/forecast.json`);
  url.searchParams.set("key", clave);
  url.searchParams.set("q", `${latitud},${longitud}`);
  url.searchParams.set("days", String(dias));
  url.searchParams.set("aqi", "no");
  url.searchParams.set("alerts", alertas ? "yes" : "no");
  url.searchParams.set("lang", "es");
  return url;
}

export function crearConsultaBusqueda({ clave, consulta }) {
  const url = new URL(`${BASE}/search.json`);
  url.searchParams.set("key", clave);
  url.searchParams.set("q", consulta);
  return url;
}

export function clasificarFallo(status, cuerpo) {
  const codigo = Number(cuerpo?.error?.code);
  if (codigo === 2007) return "cuota_proveedor";
  if (codigo === 1006) return "ubicacion_invalida";
  if (codigo === 2006 || codigo === 2008 || codigo === 2009) return "sin_acceso";
  if (!cuerpo || status === 0 || status >= 400) return "proveedor";
  return "respuesta_invalida";
}

export async function consultarProveedor(url, fetchImpl) {
  try {
    const respuesta = await fetchImpl(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const texto = await respuesta.text();
    if (texto.length > 1_000_000) {
      return { ok: false, status: respuesta.status, cuerpo: null, codigo: "respuesta_invalida" };
    }
    let cuerpo = null;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      cuerpo = null;
    }
    const ok = respuesta.ok && cuerpo !== null && !cuerpo.error;
    return { ok, status: respuesta.status, cuerpo };
  } catch {
    return { ok: false, status: 0, cuerpo: null, codigo: "proveedor" };
  }
}
