"use server";

import { revalidatePath } from "next/cache";
import { borrarArchivos, rutasDeFotos } from "@/lib/fotos-servidor";
import { normalizarFotosNuevas, rutaPerteneceAUsuario } from "@/lib/fotos";
import { esUuid } from "@/lib/historial-registros";
import {
  descripcionReporteValida,
  esAlcanceReporte,
  plantasAfectadasReporte,
} from "@/lib/reportes-problema";
import {
  leerReporteProblema,
  presentarReporteProblema,
} from "@/lib/reportes-problema-servidor";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

const MENSAJES = [
  "No hay sesión.",
  "El envío del reporte no es válido.",
  "No se encontró la unidad.",
  "Indicá si el problema es de todas las plantas o solo de algunas.",
  "Contale a Flora qué está pasando.",
  "La descripción es demasiado larga.",
  "Elegí al menos una planta.",
  "Hay una planta que no pertenece a esta unidad.",
  "Esta unidad no tiene plantas para reportar.",
  "No se encontró el reporte.",
  "No se encontró la conversación.",
  "No se puede asociar una conversación de otro usuario.",
  "La conversación no corresponde a este reporte.",
  "El reporte ya fue enviado.",
  "El estado del reporte no es válido.",
  "Un registro admite hasta 3 fotos.",
  "Las fotos del registro no son válidas.",
  "Hay una foto con identificador inválido.",
  "La ruta de una foto no es válida.",
  "Hay una foto con un formato no permitido.",
  "Hay una foto que supera el tamaño permitido.",
];

function mensajeDe(error, reserva) {
  const texto = error?.message || error || "";
  if (/crear_reporte_problema|reclamar_diagnostico_reporte|cerrar_diagnostico_reporte|reportes_problema/i.test(texto)) {
    return "Falta aplicar la migración de reportes de problema en Supabase.";
  }
  return MENSAJES.find((mensaje) => texto.includes(mensaje)) || reserva;
}

async function sesion() {
  if (!configuracionLista()) {
    return { error: "Falta la configuración de Supabase." };
  }
  const user = await obtenerSesionRapida();
  if (!user) return { error: "Tenés que iniciar sesión." };
  const supabase = await crearClienteServidor();
  return { supabase, user };
}

export async function cargarContextoReporte() {
  const acceso = await sesion();
  if (acceso.error) return { ok: false, error: acceso.error, usuarioId: "", unidades: [] };

  const [espacios, unidades, plantas] = await Promise.all([
    acceso.supabase.from("espacios").select("id, nombre").order("nombre"),
    acceso.supabase
      .from("unidades_cultivo")
      .select("id, nombre, espacio_id, numero")
      .order("numero"),
    acceso.supabase
      .from("plantas")
      .select("id, nombre, genetica, numero, unidad_cultivo_id, estado")
      .order("numero"),
  ]);

  if (espacios.error || unidades.error || plantas.error) {
    return { ok: false, error: "No se pudieron cargar tus cultivos.", usuarioId: "", unidades: [] };
  }

  const espaciosPorId = new Map((espacios.data || []).map((item) => [item.id, item]));
  const plantasPorUnidad = new Map();
  for (const planta of plantas.data || []) {
    if (!planta?.unidad_cultivo_id) continue;
    const lista = plantasPorUnidad.get(planta.unidad_cultivo_id) || [];
    lista.push({
      id: planta.id,
      nombre: planta.nombre || "",
      genetica: planta.genetica || "",
      numero: planta.numero,
      estado: planta.estado || "",
    });
    plantasPorUnidad.set(planta.unidad_cultivo_id, lista);
  }

  const lista = (unidades.data || [])
    .map((unidad) => {
      const espacio = espaciosPorId.get(unidad.espacio_id);
      if (!espacio) return null;
      return {
        id: unidad.id,
        nombre: unidad.nombre,
        espacio_id: unidad.espacio_id,
        espacio_nombre: espacio.nombre,
        plantas: plantasPorUnidad.get(unidad.id) || [],
      };
    })
    .filter(Boolean);

  return { ok: true, error: "", usuarioId: acceso.user.id, unidades: lista };
}

export async function crearReporteProblema(entrada) {
  const clave = String(entrada?.claveEnvio || "").trim();
  const unidadId = String(entrada?.unidadId || "").trim();
  const alcance = String(entrada?.alcance || "").trim();
  const descripcion = descripcionReporteValida(entrada?.descripcion);
  const ids = Array.isArray(entrada?.plantaIds) ? entrada.plantaIds.map((id) => String(id || "").trim()) : [];

  if (!esUuid(clave)) return { ok: false, error: "El envío del reporte no es válido." };
  if (!esUuid(unidadId)) return { ok: false, error: "Seleccioná una unidad." };
  if (!esAlcanceReporte(alcance)) {
    return { ok: false, error: "Indicá si el problema es de todas las plantas o solo de algunas." };
  }
  if (!descripcion.ok) return { ok: false, error: descripcion.error };
  if (alcance === "seleccion" && !ids.length) return { ok: false, error: "Elegí al menos una planta." };
  if (ids.some((id) => !esUuid(id))) {
    return { ok: false, error: "Hay una planta que no pertenece a esta unidad." };
  }

  const fotosOk = normalizarFotosNuevas(entrada?.fotos || []);
  if (fotosOk.error) return { ok: false, error: fotosOk.error };

  const acceso = await sesion();
  if (acceso.error) return { ok: false, error: acceso.error };

  if (
    fotosOk.fotos.some(
      (foto) =>
        !rutaPerteneceAUsuario(foto.ruta, acceso.user.id) ||
        !rutaPerteneceAUsuario(foto.ruta_miniatura, acceso.user.id),
    )
  ) {
    return { ok: false, error: "La ruta de una foto no es válida." };
  }

  const { data: plantasUnidad, error: errorPlantas } = await acceso.supabase
    .from("plantas")
    .select("id, nombre, genetica, numero")
    .eq("unidad_cultivo_id", unidadId);

  if (errorPlantas) {
    return { ok: false, error: "No se pudieron leer las plantas de la unidad." };
  }

  const afectadas = plantasAfectadasReporte({
    alcance,
    plantasUnidad: plantasUnidad || [],
    idsSeleccionados: ids,
  });
  if (!afectadas.ok) {
    if (fotosOk.fotos.length) await borrarArchivos(acceso.supabase, rutasDeFotos(fotosOk.fotos));
    return { ok: false, error: afectadas.error, archivosLimpiados: fotosOk.fotos.length > 0 };
  }

  const { data, error } = await acceso.supabase.rpc("crear_reporte_problema", {
    p_clave_envio: clave,
    p_unidad_cultivo_id: unidadId,
    p_alcance: alcance,
    p_planta_ids: alcance === "seleccion" ? afectadas.plantas.map((planta) => planta.id) : [],
    p_descripcion: descripcion.texto,
    p_fotos: fotosOk.fotos,
  });

  if (error || !data?.reporte_id) {
    const limpiar = fotosOk.fotos.length > 0;
    if (limpiar) await borrarArchivos(acceso.supabase, rutasDeFotos(fotosOk.fotos));
    return {
      ok: false,
      error: mensajeDe(error, "No se pudo guardar el reporte. Revisá tu conexión y volvé a intentar."),
      archivosLimpiados: limpiar,
    };
  }

  revalidatePath("/registros");
  revalidatePath("/registros/historial");
  revalidatePath("/cultivos");

  return {
    ok: true,
    error: "",
    reporteId: data.reporte_id,
    registroId: data.registro_id,
    estado: data.estado,
    claveSesion: data.clave_sesion,
    yaExistia: Boolean(data.ya_existia),
  };
}

export async function obtenerReporteProblema(reporteId) {
  const acceso = await sesion();
  if (acceso.error) return { ok: false, error: acceso.error };

  const leido = await leerReporteProblema(acceso.supabase, reporteId);
  if (!leido.ok) return { ok: false, error: leido.error };

  return presentarReporteProblema(acceso.supabase, leido.fila);
}

export async function vincularChatReporte(reporteId, chatId) {
  if (!esUuid(reporteId) || !esUuid(chatId)) {
    return { ok: false, error: "No se encontró la conversación." };
  }

  const acceso = await sesion();
  if (acceso.error) return { ok: false, error: acceso.error };

  const { data, error } = await acceso.supabase.rpc("cerrar_diagnostico_reporte", {
    p_reporte_id: reporteId,
    p_estado: "enviado",
    p_flora_chat_id: chatId,
  });

  if (error || !data?.ok) {
    return { ok: false, error: mensajeDe(error, "No se pudo asociar la conversación al reporte.") };
  }

  return { ok: true, error: "", floraChatId: data.flora_chat_id || chatId };
}
