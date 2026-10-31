import { leerRecepcionPagos } from "@/lib/pagos/ambiente";
import { clientePagos } from "@/lib/pagos/datos";
import {
  EDAD_MAXIMA_MIN_DEFECTO,
  evaluarHeartbeat,
  leerHeartbeat,
  monitorAutorizado,
} from "@/lib/pagos/plus/heartbeat-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sonda para un monitor externo (uptime). 200 = cron al día; 503 = ejecución faltante, última
 * corrida fallida o heartbeat ilegible. Exige Bearer PLUS_MONITOR_SECRET (no CRON_SECRET).
 * La respuesta no incluye datos de usuarios ni secretos.
 */
export async function GET(request) {
  if (!monitorAutorizado(request.headers.get("authorization"))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const ambiente = leerRecepcionPagos();
  const supabase = clientePagos();
  if (!ambiente.ok || !supabase) {
    return Response.json({ ok: false, motivo: "sin_servicio" }, { status: 503 });
  }
  const lectura = await leerHeartbeat(supabase, ambiente.ambiente);
  if (!lectura.ok) {
    return Response.json({ ok: false, motivo: "heartbeat_no_disponible" }, { status: 503 });
  }
  const edadMaximaMin = Number(process.env.PLUS_HEARTBEAT_EDAD_MAX_MIN) || EDAD_MAXIMA_MIN_DEFECTO;
  const evaluacion = evaluarHeartbeat(lectura.fila, { edadMaximaMin });
  return Response.json(evaluacion, { status: evaluacion.ok ? 200 : 503 });
}
