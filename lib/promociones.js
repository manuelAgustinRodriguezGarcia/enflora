import { PRECIO_PLUS_USD } from "@/lib/pagos/plus/constantes";
import { ESTADOS_BENEFICIO_PLAN, etiquetaEstadoBeneficioPlan, planesEnflora, textoBeneficioPlan } from "@/lib/planes";

export const SEGMENTOS_PROMOCION = Object.freeze(["gratuito", "plus", "licencia"]);
export const TIPOS_CAMPANA = Object.freeze(["interna", "comercial", "beneficio"]);
export const FORMATOS_CAMPANA = Object.freeze(["banner", "modal"]);
export const UBICACIONES_CAMPANA = Object.freeze(["listado_cultivos", "inicio"]);
export const FRECUENCIA_MODAL_GRATUITO_DIAS = 7;
export const FRECUENCIA_MODAL_PLUS_DIAS = 30;
export const ESPERA_MODAL_MS = 12000;
export const DESTINO_PLUS = "/pagos/plus";

const SUPERFICIES_SIN_PUBLICIDAD = Object.freeze(["/flora", "/registro", "/ingreso", "/onboarding", "/pagos"]);
const RE_RUTA = /^\/(?!\/)[A-Za-z0-9/_?-]{1,120}$/;
const MS_DIA = 24 * 60 * 60 * 1000;

function planPlus() {
  return planesEnflora.items.find((item) => item.id === "plus") || null;
}

export function superficiePermitePublicidad(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  const ruta = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return !SUPERFICIES_SIN_PUBLICIDAD.some((bloqueada) => ruta === bloqueada || ruta.startsWith(`${bloqueada}/`));
}

/**
 * Plus es solo la suscripción de cuenta. Una licencia por cultivo no la reemplaza
 * y tampoco convierte la cuenta en plan gratuito.
 */
export function segmentosDeCuenta({ plusActivo = false, licenciaVigente = false } = {}) {
  const segmentos = [];
  if (plusActivo) segmentos.push("plus");
  else if (!licenciaVigente) segmentos.push("gratuito");
  if (licenciaVigente) segmentos.push("licencia");
  return segmentos;
}

export function leerSegmentos(valor) {
  const lista = Array.isArray(valor)
    ? valor
    : typeof valor === "string"
      ? valor.replace(/[{}]/g, "").split(",")
      : [];
  const vistos = new Set();
  const segmentos = [];
  for (const item of lista) {
    const limpio = String(item || "").trim();
    if (!SEGMENTOS_PROMOCION.includes(limpio) || vistos.has(limpio)) continue;
    vistos.add(limpio);
    segmentos.push(limpio);
  }
  return segmentos;
}

export function destinoPromocion(valor, { interno = false } = {}) {
  const limpio = typeof valor === "string" ? valor.trim() : "";
  if (!limpio || limpio.length > 500) return null;
  const minuscula = limpio.toLowerCase();
  if (/[\s@\\]/.test(limpio) || minuscula.startsWith("javascript:") || minuscula.startsWith("data:")) return null;
  if (limpio.startsWith("/")) {
    if (!interno || !RE_RUTA.test(limpio)) return null;
    if (limpio === "/admin" || limpio.startsWith("/admin/") || limpio === "/api" || limpio.startsWith("/api/")) return null;
    return limpio;
  }
  if (!minuscula.startsWith("https://")) return null;
  try {
    const parsed = new URL(limpio);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname.includes(".")) return null;
    return limpio;
  } catch {
    return null;
  }
}

export function textoPrometeSinAnuncios(valor) {
  return /sin anuncios|sin publicidad|ad-free|ad free/i.test(String(valor || ""));
}

export function etiquetaUbicacion(ubicacion) {
  if (ubicacion === "inicio") return "Inicio";
  if (ubicacion === "listado_cultivos") return "Listado de cultivos";
  return "Ubicación";
}

export function etiquetaFormato(formato) {
  if (formato === "modal") return "Ventana";
  if (formato === "banner") return "Banner";
  return "Pieza";
}

export function etiquetaPieza(tipo) {
  return tipo === "interna" ? "ENFLORA" : "Publicidad";
}

export function beneficiosAnunciablesPlus(anunciarFuturos = false) {
  const plan = planPlus();
  if (!plan || plan.precioUsd !== PRECIO_PLUS_USD) return [];
  return plan.beneficios.flatMap((item) => {
    const estado = typeof item === "string" ? ESTADOS_BENEFICIO_PLAN.disponible : item.estado;
    const actual = estado === ESTADOS_BENEFICIO_PLAN.disponible || estado === ESTADOS_BENEFICIO_PLAN.plan_pago;
    const futuro = estado === ESTADOS_BENEFICIO_PLAN.proximamente || estado === ESTADOS_BENEFICIO_PLAN.pendiente;
    if (!actual && !(anunciarFuturos && futuro)) return [];
    return [{ texto: textoBeneficioPlan(item), etiqueta: actual ? "" : etiquetaEstadoBeneficioPlan(item) }];
  });
}

export function textoPromocionPlus({ anunciarFuturos = false } = {}) {
  const plan = planPlus();
  return {
    titulo: plan?.titulo || "PLAN 420",
    precio: plan?.precioEtiqueta || "US$ 4,20",
    periodicidad: plan?.periodicidad || "AL MES",
    descripcion: "Suscripción de toda la cuenta. El precio sigue la cotización que ya usa el checkout.",
    beneficios: beneficiosAnunciablesPlus(anunciarFuturos),
    cta: plan?.cta || "Quiero el PLAN 420",
    href: DESTINO_PLUS,
  };
}

export function diasEsperaModal(campana, segmentosUsuario) {
  if (campana?.formato !== "modal") return 0;
  const configurada = Number(campana.frecuencia_dias);
  const base = Number.isInteger(configurada) && configurada > 0 ? configurada : FRECUENCIA_MODAL_GRATUITO_DIAS;
  if (Array.isArray(segmentosUsuario) && segmentosUsuario.includes("plus")) {
    return Math.max(base, FRECUENCIA_MODAL_PLUS_DIAS);
  }
  return Math.max(base, FRECUENCIA_MODAL_GRATUITO_DIAS);
}

export function modalEnVentana({ marca, dias, ahora }) {
  if (!marca || !dias) return true;
  const tiempos = [marca.impresion_en, marca.cierre_en]
    .map((valor) => Date.parse(valor))
    .filter((valor) => Number.isFinite(valor));
  if (!tiempos.length) return true;
  return ahora.getTime() - Math.max(...tiempos) >= dias * MS_DIA;
}

function diaCampo(valor) {
  return typeof valor === "string" ? valor.slice(0, 10) : "";
}

function rechazar(motivo) {
  return { mostrar: false, motivo };
}

export function evaluarCampanaPublica({ campana, segmentosUsuario, marca = null, ahora = new Date(), hoy, superficie }) {
  if (!campana || typeof campana !== "object") return rechazar("vacia");
  if (campana.estado !== "activa") return rechazar("estado");
  if (!UBICACIONES_CAMPANA.includes(campana.ubicacion) || campana.ubicacion !== superficie) return rechazar("ubicacion");
  if (!FORMATOS_CAMPANA.includes(campana.formato)) return rechazar("formato");
  if (campana.formato === "modal" && superficie !== "inicio") return rechazar("modal");
  const inicio = diaCampo(campana.inicio);
  const fin = diaCampo(campana.fin);
  if (!inicio || inicio > hoy || (fin && fin < hoy)) return rechazar("fecha");
  const segmentos = leerSegmentos(campana.segmentos);
  const audiencia = leerSegmentos(segmentosUsuario);
  if (!segmentos.length || !segmentos.some((segmento) => audiencia.includes(segmento))) return rechazar("segmento");
  if (campana.es_upsell_plus && audiencia.includes("plus")) return rechazar("plus");
  if (campana.tipo === "interna") {
    if (campana.comercio_id) return rechazar("anunciante");
  } else if (campana.tipo === "comercial" || campana.tipo === "beneficio") {
    if (!campana.comercioHabilitado) return rechazar("comercio");
  } else {
    return rechazar("tipo");
  }
  if (textoPrometeSinAnuncios(campana.titulo) || textoPrometeSinAnuncios(campana.descripcion) || textoPrometeSinAnuncios(campana.cta)) {
    return rechazar("promesa");
  }
  if (campana.formato === "modal") {
    const dias = diasEsperaModal(campana, audiencia);
    if (!modalEnVentana({ marca, dias, ahora })) return rechazar("frecuencia");
  }
  const destino = destinoPromocion(campana.enlace || "", { interno: campana.tipo === "interna" });
  if (campana.es_upsell_plus && destino !== DESTINO_PLUS) return rechazar("destino");
  if (campana.formato === "modal" && !destino && !campana.es_upsell_plus) return rechazar("destino");
  return { mostrar: true, motivo: "", formato: campana.formato, dias: diasEsperaModal(campana, audiencia) };
}

export function elegirModal(candidatas) {
  const visibles = (Array.isArray(candidatas) ? candidatas : []).filter((item) => item?.decision?.mostrar && item.decision.formato === "modal");
  visibles.sort((a, b) => (Number(b.campana?.prioridad) || 0) - (Number(a.campana?.prioridad) || 0));
  return visibles[0]?.campana || null;
}
