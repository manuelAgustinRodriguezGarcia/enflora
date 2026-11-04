import { after } from "next/server";
import { conversarConFlora } from "@/lib/flora-gemini";
import { geminiConfigurado, modeloFloraGeminiPublico, resumenConfigGemini } from "@/lib/flora-chat-config";
import { verificarCuotaUsuario } from "@/lib/flora-chat-limites";
import { crearIdSolicitudFlora } from "@/lib/flora-chat-telemetria";
import { programarUsoFlora } from "@/lib/flora-uso";
import { argumentosUsoFlora, eventoDesdeResultadoFlora } from "@/lib/flora-uso-reglas";
import {
  guardarChatDeReporte,
  leerReporteProblema,
  presentarReporteProblema,
} from "@/lib/reportes-problema-servidor";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";
import { esUuid } from "@/lib/historial-registros";

export const maxDuration = 90;

function json(body, status = 200) {
  return Response.json(body, { status });
}

function dejarUsoFlora(argumentos) {
  if (!argumentos) return;
  try {
    after(() => programarUsoFlora(argumentos));
  } catch {
    // Una métrica fallida no cambia la respuesta de Flora.
  }
}

function mensajeRpc(error, reserva) {
  const texto = error?.message || "";
  if (/reclamar_diagnostico_reporte|cerrar_diagnostico_reporte|reportes_problema/i.test(texto)) {
    return "Falta aplicar la migración de reportes de problema en Supabase.";
  }
  if (/No se encontró el reporte|No hay sesión/.test(texto)) return "No se encontró el reporte.";
  return reserva;
}

export async function POST(request) {
  if (!configuracionLista()) {
    return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);
  }
  if (!geminiConfigurado()) {
    return json({ ok: false, error: "Flora no está disponible en este momento." }, 503);
  }

  const usuario = await obtenerUsuario();
  if (!usuario?.id) {
    return json({ ok: false, error: "Tenés que iniciar sesión para hablar con Flora." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "El reporte no es válido." }, 400);
  }

  const reporteId = String(body?.reporteId || "").trim();
  if (!esUuid(reporteId)) return json({ ok: false, error: "No se encontró el reporte." }, 400);

  const cuota = verificarCuotaUsuario(usuario.id);
  if (!cuota.ok) {
    return json(
      { ok: false, error: cuota.error, reintentarEnSegundos: cuota.reintentarEnSegundos },
      429,
    );
  }

  const supabase = await crearClienteServidor();
  const { data: reclamo, error: errorReclamo } = await supabase.rpc("reclamar_diagnostico_reporte", {
    p_reporte_id: reporteId,
  });

  if (errorReclamo || !reclamo) {
    return json({ ok: false, error: mensajeRpc(errorReclamo, "No se pudo abrir el diagnóstico.") }, 400);
  }

  if (!reclamo.proceder && reclamo.motivo === "abierto" && reclamo.flora_chat_id) {
    return json({ ok: true, yaEnviado: true, floraChatId: reclamo.flora_chat_id, claveSesion: reclamo.clave_sesion });
  }

  if (!reclamo.proceder && reclamo.motivo === "en_curso") {
    return json(
      {
        ok: false,
        error: "Flora ya está analizando este reporte. Esperá un momento y, si no aparece la respuesta, reintentá.",
        enCurso: true,
      },
      409,
    );
  }

  const leido = await leerReporteProblema(supabase, reporteId);
  if (!leido.ok) {
    await supabase.rpc("cerrar_diagnostico_reporte", {
      p_reporte_id: reporteId,
      p_estado: "error_flora",
      p_flora_chat_id: null,
    });
    return json({ ok: false, error: leido.error }, 404);
  }

  const presentado = await presentarReporteProblema(supabase, leido.fila);
  if (!presentado.ok) {
    await supabase.rpc("cerrar_diagnostico_reporte", {
      p_reporte_id: reporteId,
      p_estado: "error_flora",
      p_flora_chat_id: null,
    });
    return json({ ok: false, error: presentado.error }, 404);
  }

  const { data: chatPrevio } = await supabase
    .from("flora_chats_guardados")
    .select("id")
    .eq("clave_sesion", presentado.claveSesion)
    .maybeSingle();

  if (chatPrevio?.id) {
    await supabase.rpc("cerrar_diagnostico_reporte", {
      p_reporte_id: reporteId,
      p_estado: "enviado",
      p_flora_chat_id: chatPrevio.id,
    });
    return json({
      ok: true,
      yaEnviado: true,
      floraChatId: chatPrevio.id,
      claveSesion: presentado.claveSesion,
      mensaje: presentado.mensaje,
      fotos: presentado.fotos,
    });
  }

  const requestId = crearIdSolicitudFlora();
  const inicio = Date.now();
  const resultado = await conversarConFlora(supabase, {
    mensaje: presentado.mensaje,
    historial: [],
    adjuntosImagen: presentado.fotos.map((foto) => ({ origen: "enflora", fotoId: foto.id })),
    requestId,
    requestBodyBytes: presentado.mensaje.length,
  });

  dejarUsoFlora(
    eventoDesdeResultadoFlora({
      solicitudId: requestId,
      usuarioId: usuario.id,
      resultado,
      inicioMs: Date.now() - inicio,
      modelo: modeloFloraGeminiPublico(),
    }),
  );

  if (resultado.telemetria) {
    console.info("[flora/reporte]", JSON.stringify(resultado.telemetria));
  }

  if (!resultado.ok) {
    await supabase.rpc("cerrar_diagnostico_reporte", {
      p_reporte_id: reporteId,
      p_estado: "error_flora",
      p_flora_chat_id: null,
    });
    if (resultado.diagnostico) {
      console.error("[flora/reporte]", JSON.stringify({ ...resultado.diagnostico, config: resumenConfigGemini() }));
    }
    return json(
      {
        ok: false,
        error: resultado.error || "Flora no pudo analizar el reporte. Quedó guardado en el historial: podés reintentar el diagnóstico.",
        mensaje: presentado.mensaje,
        fotos: presentado.fotos,
        claveSesion: presentado.claveSesion,
        unidadNombre: presentado.unidadNombre,
      },
      502,
    );
  }

  const respuesta = String(resultado.texto || "").trim();
  const guardado = await guardarChatDeReporte(supabase, usuario.id, {
    titulo: presentado.unidadNombre,
    claveSesion: presentado.claveSesion,
    mensaje: presentado.mensaje,
    fotos: presentado.fotos,
    respuesta,
    reporteId,
    registroId: presentado.registroId,
    unidadId: presentado.unidadId,
  });

  if (!guardado.ok) {
    await supabase.rpc("cerrar_diagnostico_reporte", {
      p_reporte_id: reporteId,
      p_estado: "error_flora",
      p_flora_chat_id: null,
    });
    return json({
      ok: false,
      error: guardado.error,
      guardarEnCliente: true,
      respuesta,
      mensaje: presentado.mensaje,
      fotos: presentado.fotos,
      claveSesion: presentado.claveSesion,
      unidadNombre: presentado.unidadNombre,
    });
  }

  const cierre = await supabase.rpc("cerrar_diagnostico_reporte", {
    p_reporte_id: reporteId,
    p_estado: "enviado",
    p_flora_chat_id: guardado.id,
  });

  if (cierre.error) {
    return json({
      ok: false,
      error: "Flora respondió, pero no pudimos asociar la conversación al reporte. Reintentá para conservarla.",
      guardarEnCliente: true,
      respuesta,
      mensaje: presentado.mensaje,
      fotos: presentado.fotos,
      claveSesion: presentado.claveSesion,
      unidadNombre: presentado.unidadNombre,
      chatId: guardado.id,
    });
  }

  return json({
    ok: true,
    respuesta,
    mensaje: presentado.mensaje,
    fotos: presentado.fotos,
    claveSesion: presentado.claveSesion,
    unidadNombre: presentado.unidadNombre,
    chatId: guardado.id,
    floraChatId: guardado.id,
  });
}
