import "server-only";

import { firmarRutas } from "@/lib/fotos-servidor";
import { esUuid } from "@/lib/historial-registros";
import { mimeImagenFloraPermitido } from "@/lib/flora-imagen-chat";
import { validarMensajesChatPersistidos } from "@/lib/flora-chats-guardados";
import { armarMensajeFloraReporte, tituloChatReporte } from "@/lib/reportes-problema";

const SELECT_REPORTE = `
  id,
  registro_id,
  unidad_cultivo_id,
  alcance,
  clave_sesion,
  flora_chat_id,
  estado,
  creado_en,
  registro:registros (
    id,
    observacion,
    fecha_evento,
    unidad_cultivo_id,
    unidad:unidades_cultivo ( nombre ),
    registro_plantas (
      planta_id,
      nombre_planta,
      numero_planta,
      genetica_planta
    ),
    registro_fotos (
      id,
      ruta,
      ruta_miniatura,
      tipo_mime,
      orden
    )
  )
`;

export async function leerReporteProblema(supabase, reporteId) {
  if (!esUuid(reporteId)) {
    return { ok: false, error: "No se encontró el reporte.", fila: null };
  }

  const { data, error } = await supabase
    .from("reportes_problema")
    .select(SELECT_REPORTE)
    .eq("id", reporteId)
    .maybeSingle();

  if (error) {
    const texto = `${error.code || ""} ${error.message || ""}`;
    if (/reportes_problema|PGRST205|42P01|schema cache/i.test(texto)) {
      return {
        ok: false,
        error: "Falta aplicar la migración de reportes de problema en Supabase.",
        fila: null,
      };
    }
    return { ok: false, error: "No se encontró el reporte.", fila: null };
  }

  if (!data?.registro) {
    return { ok: false, error: "No se encontró el reporte.", fila: null };
  }

  return { ok: true, error: "", fila: data };
}

function fotosOrdenadas(registro) {
  return [...(registro?.registro_fotos || [])].sort(
    (a, b) => (Number(a?.orden) || 0) - (Number(b?.orden) || 0),
  );
}

export async function presentarReporteProblema(supabase, fila) {
  const registro = fila?.registro;
  if (!registro) return { ok: false, error: "No se encontró el reporte." };

  const plantas = (registro.registro_plantas || []).map((item) => ({
    id: item.planta_id || "",
    nombre: item.nombre_planta || "",
    numero: item.numero_planta,
    genetica: item.genetica_planta || "",
  }));

  const mensaje = armarMensajeFloraReporte({
    unidadNombre: registro.unidad?.nombre || "",
    unidadId: fila.unidad_cultivo_id || registro.unidad_cultivo_id || "",
    alcance: fila.alcance === "seleccion" ? "seleccion" : "unidad",
    plantas,
    descripcion: registro.observacion || "",
    fechaIso: registro.fecha_evento || fila.creado_en,
    registroId: registro.id,
  });

  const fotos = fotosOrdenadas(registro).filter((foto) => esUuid(foto?.id));
  const rutas = fotos.map((foto) => foto.ruta_miniatura || foto.ruta).filter(Boolean);
  const firmas = await firmarRutas(supabase, rutas);

  return {
    ok: true,
    error: "",
    reporteId: fila.id,
    registroId: registro.id,
    estado: fila.estado,
    floraChatId: fila.flora_chat_id || "",
    claveSesion: fila.clave_sesion,
    unidadId: fila.unidad_cultivo_id || registro.unidad_cultivo_id || "",
    unidadNombre: registro.unidad?.nombre || "",
    alcance: fila.alcance,
    mensaje,
    fecha: registro.fecha_evento || fila.creado_en,
    fotos: fotos.map((foto) => {
      const ruta = foto.ruta_miniatura || foto.ruta;
      const mime = String(foto.tipo_mime || "").toLowerCase();
      return {
        id: foto.id,
        vista: firmas.get(ruta) || "",
        mimeType: mimeImagenFloraPermitido(mime) ? mime : "",
      };
    }),
  };
}

export async function guardarChatDeReporte(
  supabase,
  usuarioId,
  { titulo, claveSesion, mensaje, fotos, respuesta, reporteId, registroId, unidadId },
) {
  const ahora = new Date().toISOString();
  const adjuntos = (fotos || []).map((foto, orden) => {
    const item = {
      tipo: "foto_enflora",
      registro_foto_id: foto.id,
      orden,
    };
    if (mimeImagenFloraPermitido(foto.mimeType)) item.mime = foto.mimeType;
    return item;
  });

  const mensajes = [
    {
      rol: "usuario",
      texto: mensaje,
      fecha: ahora,
      ...(adjuntos.length ? { adjuntos } : {}),
    },
    {
      rol: "flora",
      texto: String(respuesta || "").trim(),
      fecha: ahora,
    },
  ];

  const validos = validarMensajesChatPersistidos(mensajes);
  if (!validos.ok) return { ok: false, error: validos.error, id: "" };

  const { data: porSesion } = await supabase
    .from("flora_chats_guardados")
    .select("id")
    .eq("clave_sesion", claveSesion)
    .maybeSingle();

  if (porSesion?.id) return { ok: true, error: "", id: porSesion.id, yaExistia: true };

  const fila = {
    usuario_id: usuarioId,
    titulo: tituloChatReporte(titulo),
    primera_pregunta: validos.primeraPregunta,
    mensajes: validos.mensajes,
    referencias: {
      procedencia: "reporte_problema",
      reporte_id: reporteId,
      registro_id: registroId,
      unidad_cultivo_id: unidadId || null,
    },
    clave_sesion: claveSesion,
    cantidad_mensajes: validos.mensajes.length,
    created_at: ahora,
    updated_at: ahora,
  };

  const { data, error } = await supabase
    .from("flora_chats_guardados")
    .insert(fila)
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: existente } = await supabase
      .from("flora_chats_guardados")
      .select("id")
      .eq("clave_sesion", claveSesion)
      .maybeSingle();
    if (existente?.id) return { ok: true, error: "", id: existente.id, yaExistia: true };
  }

  if (error || !data?.id) {
    return {
      ok: false,
      error: "Flora respondió, pero no pudimos guardar la conversación. Reintentá para conservarla.",
      id: "",
    };
  }

  return { ok: true, error: "", id: data.id, yaExistia: false };
}
