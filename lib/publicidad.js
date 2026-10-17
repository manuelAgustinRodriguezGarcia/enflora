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
  const { comercios, error } = await cargarComerciosPublicos();
  if (error) return { campañas: [], error };

  const campañas = comercios
    .filter(
      (item) =>
        PLANES_BANNER.has(item.plan) &&
        typeof item.banner_url === "string" &&
        item.banner_url.trim() !== "",
    )
    .map((item) => ({
      id: item.id,
      nombre: item.nombre,
      bannerUrl: item.banner_url.trim(),
      enlace: enlaceExternoSeguro(item.banner_enlace || item.sitio_web),
    }));

  return { campañas, error: null };
}
