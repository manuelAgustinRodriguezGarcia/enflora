import "server-only";

import { diaArgentina } from "@/lib/admin/partners-reglas";
import { leerAmbientePagos } from "@/lib/pagos/ambiente";
import { licenciaHabilita } from "@/lib/pagos/cobertura";
import { consultarPlusActivo } from "@/lib/pagos/plus/leer-plus-activo";
import { elegirModal, evaluarCampanaPublica, segmentosDeCuenta } from "@/lib/promociones";

const COLUMNAS =
  "id, comercio_id, nombre, pieza_url, ubicacion, enlace, inicio, fin, estado, prioridad, tipo, formato, segmentos, titulo, descripcion, cta, frecuencia_dias, anunciar_futuros, es_upsell_plus";

function vacio(sutil = false) {
  return { banners: [], modal: null, sutil };
}

async function licenciaVigenteDeCuenta(supabase, usuarioId) {
  const lectura = leerAmbientePagos();
  if (!lectura.ok) return false;
  const { data: licencias, error } = await supabase
    .from("licencias_cultivo")
    .select("ciclo_cultivo_id, pago_id, estado, usuario_id")
    .eq("usuario_id", usuarioId)
    .eq("estado", "activa")
    .limit(20);
  if (error || !licencias?.length) return false;
  const pagoIds = [...new Set(licencias.map((licencia) => licencia.pago_id).filter(Boolean))];
  if (!pagoIds.length) return false;
  const { data: pagos, error: errorPagos } = await supabase
    .from("pagos")
    .select("id, estado, ambiente, usuario_id, ciclo_cultivo_id")
    .in("id", pagoIds);
  if (errorPagos || !pagos) return false;
  const pagosPorId = new Map(pagos.map((pago) => [pago.id, pago]));
  return licencias.some((licencia) =>
    licenciaHabilita({
      licencia,
      pago: pagosPorId.get(licencia.pago_id),
      ambiente: lectura.ambiente,
      usuarioId,
    }),
  );
}

function imagenHttps(url) {
  return typeof url === "string" && url.trim().toLowerCase().startsWith("https://");
}

function presentar(fila) {
  return {
    id: fila.id,
    campanaId: fila.id,
    comercioId: fila.comercio_id || "",
    nombre: fila.tipo === "interna" ? "ENFLORA" : fila.nombre,
    tipo: fila.tipo,
    formato: fila.formato,
    bannerUrl: typeof fila.pieza_url === "string" ? fila.pieza_url.trim() : "",
    enlace: fila.enlace || "",
    titulo: fila.titulo || "",
    descripcion: fila.descripcion || "",
    cta: fila.cta || "",
    anunciarFuturos: fila.anunciar_futuros === true,
    esUpsellPlus: fila.es_upsell_plus === true,
    prioridad: Number(fila.prioridad) || 0,
  };
}

export async function cargarPromocionesInicio(supabase, usuarioId, ahora = new Date()) {
  if (!supabase || !usuarioId) return vacio();
  let plusActivo = false;
  try {
    const plus = await consultarPlusActivo(supabase, usuarioId, process.env, ahora);
    plusActivo = plus.activo === true;
  } catch {
    plusActivo = false;
  }
  let licenciaVigente = false;
  try {
    licenciaVigente = await licenciaVigenteDeCuenta(supabase, usuarioId);
  } catch {
    licenciaVigente = false;
  }
  const segmentosUsuario = segmentosDeCuenta({ plusActivo, licenciaVigente });
  const { data, error } = await supabase
    .from("partners_campanas")
    .select(COLUMNAS)
    .eq("estado", "activa")
    .eq("ubicacion", "inicio")
    .order("prioridad", { ascending: false });
  if (error || !Array.isArray(data)) return vacio(plusActivo);

  const { data: marcas, error: errorMarcas } = await supabase
    .from("partners_frecuencia")
    .select("campana_id, impresion_en, cierre_en")
    .eq("usuario_id", usuarioId);
  const porMarca = new Map((marcas || []).map((marca) => [marca.campana_id, marca]));
  const hoy = diaArgentina(ahora);
  const banners = [];
  const modales = [];
  for (const fila of data) {
    const campana = {
      ...fila,
      comercioHabilitado: fila.tipo !== "interna" && Boolean(fila.comercio_id),
    };
    const decision = evaluarCampanaPublica({
      campana,
      segmentosUsuario,
      marca: porMarca.get(fila.id) || null,
      ahora,
      hoy,
      superficie: "inicio",
    });
    if (!decision.mostrar) continue;
    if (decision.formato === "modal" && errorMarcas) continue;
    const pieza = presentar(fila);
    if (pieza.bannerUrl && !imagenHttps(pieza.bannerUrl)) pieza.bannerUrl = "";
    if (decision.formato === "banner") banners.push(pieza);
    if (decision.formato === "modal") modales.push({ campana: pieza, decision });
  }
  return { banners, modal: elegirModal(modales), sutil: plusActivo };
}

async function audiencia(supabase, usuarioId, ahora) {
  let plusActivo = false;
  let licenciaVigente = false;
  try {
    plusActivo = (await consultarPlusActivo(supabase, usuarioId, process.env, ahora)).activo === true;
  } catch {
    plusActivo = false;
  }
  try {
    licenciaVigente = await licenciaVigenteDeCuenta(supabase, usuarioId);
  } catch {
    licenciaVigente = false;
  }
  return segmentosDeCuenta({ plusActivo, licenciaVigente });
}

export async function marcarPromocionUsuario(supabase, usuarioId, campanaId, accion, ahora = new Date()) {
  if (!supabase || !usuarioId || (accion !== "impresion" && accion !== "cierre")) return { ok: false };
  const { data: fila, error } = await supabase.from("partners_campanas").select(COLUMNAS).eq("id", campanaId).maybeSingle();
  if (error || !fila) return { ok: false };
  const segmentosUsuario = await audiencia(supabase, usuarioId, ahora);
  const campana = { ...fila, comercioHabilitado: fila.tipo !== "interna" && Boolean(fila.comercio_id) };
  const base = {
    campana,
    segmentosUsuario,
    ahora,
    hoy: diaArgentina(ahora),
    superficie: fila.ubicacion,
  };
  if (!evaluarCampanaPublica({ ...base, marca: null }).mostrar) return { ok: false };
  const { data: actual } = await supabase
    .from("partners_frecuencia")
    .select("impresion_en, cierre_en")
    .eq("usuario_id", usuarioId)
    .eq("campana_id", campanaId)
    .maybeSingle();
  if (accion === "impresion" && !evaluarCampanaPublica({ ...base, marca: actual || null }).mostrar) return { ok: true };
  const columna = accion === "cierre" ? "cierre_en" : "impresion_en";
  const instante = ahora.toISOString();
  const consulta = actual
    ? supabase.from("partners_frecuencia").update({ [columna]: instante }).eq("usuario_id", usuarioId).eq("campana_id", campanaId)
    : supabase.from("partners_frecuencia").insert({
        usuario_id: usuarioId,
        campana_id: campanaId,
        impresion_en: columna === "impresion_en" ? instante : null,
        cierre_en: columna === "cierre_en" ? instante : null,
      });
  const { error: errorMarca } = await consulta;
  return { ok: !errorMarca };
}
