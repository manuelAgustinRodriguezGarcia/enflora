import { enviarRecordatoriosConfigurados } from "@/lib/calendario/enviar-recordatorios";
import { cronAutorizado } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// vercel.json lo llama cada minuto. Sin CRON_SECRET responde 401.
// Sin VAPID o service role responde omitido=configuracion y no contacta dispositivos.

export async function GET(request) {
  if (!cronAutorizado(request.headers.get("authorization"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const resultado = await enviarRecordatoriosConfigurados();
    console.info("[calendario] recordatorios", {
      omitido: resultado.omitido,
      enviados: resultado.enviados,
      errores: resultado.errores,
      sinDispositivo: resultado.sinDispositivo,
      expirados: resultado.expirados,
      omitidos: resultado.omitidos,
    });
    return Response.json(resultado);
  } catch {
    console.error("[calendario] recordatorios_error");
    return Response.json({ ok: false, error: "No se pudo ejecutar" }, { status: 503 });
  }
}
