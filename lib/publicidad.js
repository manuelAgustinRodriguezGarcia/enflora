import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const PLANES_BANNER = new Set(["visibilidad", "inteligente"]);

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

function estaVigente(comercio, hoy = hoyIso()) {
  if (!comercio?.aprobado || !comercio?.activo) return false;
  if (!comercio.fecha_inicio || comercio.fecha_inicio > hoy) return false;
  if (comercio.fecha_fin && comercio.fecha_fin < hoy) return false;
  return true;
}

export function enlaceExternoSeguro(url) {
  if (typeof url !== "string") return null;
  const limpio = url.trim();
  if (!limpio) return null;
  try {
    const parsed = new URL(limpio);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function elegirRotacion(items, semilla = Date.now()) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const indice = Math.floor(semilla / (30 * 60 * 1000)) % items.length;
  return items[indice];
}

export async function cargarComerciosPublicos() {
  if (!configuracionLista()) {
    return { comercios: [], error: null };
  }

  const supabase = await crearClienteServidor();
  const hoy = hoyIso();
  const { data, error } = await supabase
    .from("comercios_asociados")
    .select(
      "id, nombre, logo_url, rubro, sitio_web, plan, fecha_inicio, fecha_fin, banner_url, banner_enlace, activo, aprobado",
    )
    .eq("activo", true)
    .eq("aprobado", true)
    .lte("fecha_inicio", hoy)
    .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
    .order("nombre", { ascending: true });

  if (error) {
    return { comercios: [], error };
  }

  const comercios = (data || []).filter((item) => estaVigente(item, hoy));
  return { comercios, error: null };
}

export async function cargarCampañasBanner() {
  if (!configuracionLista()) return { campañas: [], error: null };
  const supabase = await crearClienteServidor();
  const { comercios, error } = await cargarComerciosPublicos();
  if (error) return { campañas: [], error };

  const propias = comercios
    .filter(
      (item) =>
        PLANES_BANNER.has(item.plan) &&
        typeof item.banner_url === "string" &&
        item.banner_url.trim() !== "" &&
        enlaceExternoSeguro(item.banner_url),
    )
    .map((item) => ({
      id: item.id,
      nombre: item.nombre,
      bannerUrl: item.banner_url.trim(),
      enlace: enlaceExternoSeguro(item.banner_enlace || item.sitio_web),
    }));

  const explicitas = await campañasExplicitas(supabase, comercios);
  return { campañas: deduplicarCampañasBanner(propias, explicitas), error: null };
}

/**
 * Una sola pieza por comercio. Si hay campaña elegible, reemplaza al banner
 * tradicional de ese comercio y conserva el identificador que se mide.
 * La prioridad más alta gana. El empate usa el id de campaña, en orden estable.
 */
export function deduplicarCampañasBanner(propias, explicitas) {
  const listaPropias = Array.isArray(propias) ? propias : [];
  const listaExplicitas = Array.isArray(explicitas) ? explicitas : [];
  const ordenadas = [...listaExplicitas].sort((a, b) => {
    const diferencia = (Number(b?.prioridad) || 0) - (Number(a?.prioridad) || 0);
    if (diferencia !== 0) return diferencia;
    return String(a?.campanaId || "").localeCompare(String(b?.campanaId || ""));
  });
  const ganadora = new Map();
  for (const item of ordenadas) {
    const clave = typeof item?.comercioId === "string" ? item.comercioId : "";
    if (!clave || ganadora.has(clave)) continue;
    ganadora.set(clave, item);
  }
  const vistos = new Set();
  const resultado = [];
  for (const propia of listaPropias) {
    const clave = typeof propia?.id === "string" ? propia.id : "";
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push(ganadora.get(clave) || propia);
  }
  for (const item of ordenadas) {
    const clave = typeof item?.comercioId === "string" ? item.comercioId : "";
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push(item);
  }
  return resultado;
}

async function campañasExplicitas(supabase, comercios) {
  const porId = new Map(comercios.filter((item) => PLANES_BANNER.has(item.plan)).map((item) => [item.id, item]));
  const { data, error } = await supabase
    .from("partners_campanas")
    .select("id, comercio_id, pieza_url, enlace, ubicacion, prioridad, estado")
    .eq("estado", "activa")
    .eq("ubicacion", "listado_cultivos")
    .order("prioridad", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((item) => {
      const comercio = porId.get(item.comercio_id);
      const bannerUrl = typeof item.pieza_url === "string" ? item.pieza_url.trim() : "";
      if (!comercio || !enlaceExternoSeguro(bannerUrl)) return null;
      return {
        id: item.id,
        campanaId: item.id,
        comercioId: item.comercio_id,
        nombre: comercio.nombre,
        bannerUrl,
        enlace: enlaceExternoSeguro(item.enlace),
        prioridad: Number(item.prioridad) || 0,
      };
    })
    .filter(Boolean);
}
