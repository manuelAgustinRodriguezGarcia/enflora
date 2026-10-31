import { ejecutarCronRenovacionImportePlus } from "@/lib/pagos/plus/cron-renovacion-ars";
import { cronPlusAutorizado } from "@/lib/pagos/plus/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Debe cubrir PRESUPUESTO_MS_DEFECTO (40 s) del cron más el cierre (alertas y heartbeat). */
export const maxDuration = 60;

/**
 * Cron horario de Plus (vercel.json, minuto 45). En producción no actúa mientras
 * PLUS_LIVE_ENABLED no sea "true". Exige siempre Authorization: Bearer <CRON_SECRET> (sin bypass en ningún entorno).
 */
export async function GET(request) {
  if (!cronPlusAutorizado(request.headers.get("authorization"))) {
    return Response.json({ ok: false }, { status: 401 });
  }

  if (process.env.PLUS_LIVE_ENABLED !== "true" && process.env.MERCADOPAGO_ENV === "produccion") {
    return Response.json({ ok: true, ignorado: true, motivo: "plus_produccion_desactivado" });
  }

  const resultado = await ejecutarCronRenovacionImportePlus();
  if (!resultado.ok) {
    return Response.json(resultado, { status: 503 });
  }
  return Response.json(resultado);
}
