import fs from "node:fs";
import path from "node:path";
import { IMPORT_ID, RUTA_ESTADO_LOCAL } from "@/lib/import/rdwc1-constantes";

function estadoInicial(importId = IMPORT_ID) {
  return {
    import_id: importId,
    estado: "in_progress",
    usuario_id: "",
    espacio_id: null,
    unidad_id: null,
    planta_ids: [],
    opciones_accion: {},
    registros: [],
    portada_rutas: [],
    storage_huerfano: [],
    dias_completados: [],
    fotos_demo: {},
    fecha_inicio: null,
    fecha_fin: null,
  };
}

export function rutaEstadoLocal(raiz = process.cwd()) {
  return path.join(raiz, RUTA_ESTADO_LOCAL);
}

export function cargarEstadoLocal(raiz = process.cwd()) {
  const ruta = rutaEstadoLocal(raiz);
  if (!fs.existsSync(ruta)) return null;
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8"));
  } catch {
    return null;
  }
}

export function guardarEstadoLocal(estado, raiz = process.cwd()) {
  const ruta = rutaEstadoLocal(raiz);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, `${JSON.stringify(estado, null, 2)}\n`, "utf8");
}

export async function cargarEstadoRemoto(supabase, importId = IMPORT_ID) {
  const { error } = await supabase.from("importaciones_cultivo").select("import_id").limit(1);
  if (error) return { remotoDisponible: false, estado: null };
  const { data } = await supabase
    .from("importaciones_cultivo")
    .select("*")
    .eq("import_id", importId)
    .maybeSingle();
  if (!data) return { remotoDisponible: true, estado: null };
  return {
    remotoDisponible: true,
    estado: {
      ...data.payload,
      import_id: data.import_id,
      estado: data.estado,
      usuario_id: data.usuario_id,
      espacio_id: data.espacio_id,
      unidad_id: data.unidad_id,
    },
  };
}

export async function guardarEstadoRemoto(supabase, estado) {
  const { error } = await supabase.from("importaciones_cultivo").select("import_id").limit(1);
  if (error) return { ok: false, error: error.message };
  const fila = {
    import_id: estado.import_id,
    usuario_id: estado.usuario_id,
    espacio_id: estado.espacio_id,
    unidad_id: estado.unidad_id,
    estado: estado.estado,
    payload: {
      planta_ids: estado.planta_ids,
      opciones_accion: estado.opciones_accion,
      registros: estado.registros,
      portada_rutas: estado.portada_rutas,
      storage_huerfano: estado.storage_huerfano,
      dias_completados: estado.dias_completados,
      fotos_demo: estado.fotos_demo || {},
      fecha_inicio: estado.fecha_inicio,
      fecha_fin: estado.fecha_fin,
    },
    fecha_actualizacion: new Date().toISOString(),
  };
  const { error: upsertError } = await supabase.from("importaciones_cultivo").upsert(fila);
  if (upsertError) return { ok: false, error: upsertError.message };
  return { ok: true, error: "" };
}

export async function sincronizarEstado(supabase, estado, raiz = process.cwd()) {
  guardarEstadoLocal(estado, raiz);
  return guardarEstadoRemoto(supabase, estado);
}

export function crearEstadoVacío(usuarioId) {
  const base = estadoInicial();
  base.usuario_id = usuarioId;
  base.fecha_inicio = new Date().toISOString();
  return base;
}

export function importacionCompleta(estado) {
  return estado?.estado === "complete";
}

export function registroYaImportado(estado, claveRegistro) {
  return (estado?.registros || []).some((item) => item.clave === claveRegistro);
}

export function diaYaImportado(estado, fecha) {
  return (estado?.dias_completados || []).includes(fecha);
}

export function marcarRegistroImportado(estado, entrada) {
  estado.registros.push(entrada);
}

export function marcarDiaCompleto(estado, fecha) {
  if (!estado.dias_completados.includes(fecha)) {
    estado.dias_completados.push(fecha);
  }
}
