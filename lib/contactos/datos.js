import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  MAXIMO_EXPORTACION,
  TAMANO_PAGINA_CONTACTOS,
  VERSION_CONSENTIMIENTO,
  filtroValido,
  limpiarBusqueda,
  ordenValido,
  paginaValida,
} from "./reglas.js";

const COLUMNAS =
  "id, nombre, email, telefono, origen_inicial, origenes, consentimiento_marketing, consentimiento_fecha, consentimiento_version, created_at, updated_at";

export function clienteContactos() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function registrarContacto(supabase, datos) {
  const { data, error } = await supabase.rpc("registrar_contacto_enflora", {
    p_nombre: datos.nombre,
    p_email: datos.email,
    p_telefono: datos.telefono,
    p_origen: datos.origen,
    p_detalle: datos.detalle ?? null,
    p_consentimiento: datos.consentimiento === true,
    p_version: VERSION_CONSENTIMIENTO,
  });
  if (error) {
    console.error("[contactos] registro_fallido", error.code || "sin_codigo");
    return { ok: false };
  }
  const fila = Array.isArray(data) ? data[0] : data;
  return { ok: true, id: fila?.id_contacto || null, nuevo: fila?.es_nuevo === true };
}

function aplicarFiltros(consulta, { busqueda, filtro }) {
  if (filtro === "landing" || filtro === "ruleta_420" || filtro === "manual" || filtro === "registro") {
    consulta = consulta.contains("origenes", [filtro]);
  } else if (filtro === "con-consentimiento") {
    consulta = consulta.eq("consentimiento_marketing", true);
  } else if (filtro === "sin-consentimiento") {
    consulta = consulta.eq("consentimiento_marketing", false);
  }
  if (busqueda) {
    const patron = `%${busqueda}%`;
    const partes = [`nombre.ilike.${patron}`, `email.ilike.${patron}`, `telefono.ilike.${patron}`];
    const digitos = busqueda.replace(/\D/g, "");
    if (digitos.length >= 4 && digitos !== busqueda) partes.push(`telefono.ilike.%${digitos}%`);
    consulta = consulta.or(partes.join(","));
  }
  return consulta;
}

function aplicarOrden(consulta, orden) {
  if (orden === "antiguos") return consulta.order("created_at", { ascending: true }).order("id", { ascending: true });
  if (orden === "nombre") {
    return consulta
      .order("nombre", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  }
  return consulta.order("created_at", { ascending: false }).order("id", { ascending: false });
}

export function normalizarConsulta(entrada) {
  return {
    busqueda: limpiarBusqueda(entrada?.busqueda),
    filtro: filtroValido(entrada?.filtro),
    orden: ordenValido(entrada?.orden),
    pagina: paginaValida(entrada?.pagina),
  };
}

export async function listarContactos(supabase, entrada) {
  const consulta = normalizarConsulta(entrada);
  const desde = (consulta.pagina - 1) * TAMANO_PAGINA_CONTACTOS;
  const hasta = desde + TAMANO_PAGINA_CONTACTOS - 1;
  let peticion = supabase.from("contactos_enflora").select(COLUMNAS, { count: "exact" });
  peticion = aplicarFiltros(peticion, consulta);
  peticion = aplicarOrden(peticion, consulta.orden).range(desde, hasta);
  const { data, error, count } = await peticion;
  if (error) {
    console.error("[contactos] listado_fallido", error.code || "sin_codigo");
    return { ok: false };
  }
  const total = count || 0;
  return {
    ok: true,
    filas: data || [],
    total,
    pagina: consulta.pagina,
    paginas: Math.max(1, Math.ceil(total / TAMANO_PAGINA_CONTACTOS)),
    tamano: TAMANO_PAGINA_CONTACTOS,
    consulta,
  };
}

export async function exportarContactos(supabase, entrada) {
  const consulta = normalizarConsulta(entrada);
  let peticion = supabase.from("contactos_enflora").select(COLUMNAS);
  peticion = aplicarFiltros(peticion, consulta);
  peticion = aplicarOrden(peticion, consulta.orden).limit(MAXIMO_EXPORTACION);
  const { data, error } = await peticion;
  if (error) {
    console.error("[contactos] exportacion_fallida", error.code || "sin_codigo");
    return { ok: false };
  }
  return { ok: true, filas: data || [], truncado: (data || []).length >= MAXIMO_EXPORTACION };
}

export async function resumenContactos(supabase) {
  const { data, error } = await supabase.rpc("resumen_contactos_enflora");
  if (error) {
    console.error("[contactos] resumen_fallido", error.code || "sin_codigo");
    return { ok: false };
  }
  const fila = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    resumen: {
      total: Number(fila?.total || 0),
      landing: Number(fila?.landing || 0),
      ruleta: Number(fila?.ruleta || 0),
      conConsentimiento: Number(fila?.con_consentimiento || 0),
      hoy: Number(fila?.hoy || 0),
    },
  };
}

export async function leerContacto(supabase, id) {
  const { data, error } = await supabase
    .from("contactos_enflora")
    .select(
      `${COLUMNAS}, detalle_origenes:contactos_origenes(origen, detalle, veces, primera_vez, ultima_vez), historial:contactos_consentimientos(acepta, version, origen, registrado_en)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[contactos] lectura_fallida", error.code || "sin_codigo");
    return { ok: false };
  }
  if (!data) return { ok: true, contacto: null };
  const historial = [...(data.historial || [])].sort((a, b) => Date.parse(b.registrado_en) - Date.parse(a.registrado_en));
  return { ok: true, contacto: { ...data, historial } };
}

export async function actualizarContacto(supabase, id, datos) {
  const { data, error } = await supabase
    .from("contactos_enflora")
    .update({ nombre: datos.nombre, email: datos.email, telefono: datos.telefono })
    .eq("id", id)
    .select(COLUMNAS)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { ok: false, duplicado: true };
    console.error("[contactos] edicion_fallida", error.code || "sin_codigo");
    return { ok: false };
  }
  return { ok: true, contacto: data || null };
}

export async function actualizarConsentimiento(supabase, id, acepta) {
  const { data, error } = await supabase.rpc("actualizar_consentimiento_contacto", {
    p_contacto: id,
    p_acepta: acepta === true,
    p_version: VERSION_CONSENTIMIENTO,
  });
  if (error) {
    console.error("[contactos] consentimiento_fallido", error.code || "sin_codigo");
    return { ok: false };
  }
  return { ok: data === true };
}

export async function eliminarContacto(supabase, id) {
  const { data, error } = await supabase.from("contactos_enflora").delete().eq("id", id).select("id");
  if (error) {
    console.error("[contactos] eliminacion_fallida", error.code || "sin_codigo");
    return { ok: false };
  }
  return { ok: true, eliminado: (data || []).length > 0 };
}
