import { clientePush, marcarPruebaRecibida } from "@/lib/push/datos";
import { leerJsonAcotado, respuestaPush } from "@/lib/push/http";
import { esUuid } from "@/lib/push/reglas";
import { hashRecibo, reciboValido } from "@/lib/push/secreto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const cuerpo = await leerJsonAcotado(request, 300);
  if (!cuerpo || !esUuid(cuerpo.prueba) || !reciboValido(cuerpo.recibo)) {
    return respuestaPush(400, { ok: false, error: "Solicitud inválida" });
  }

  const supabase = clientePush();
  if (!supabase) return respuestaPush(503, { ok: false, error: "No disponible" });

  await marcarPruebaRecibida(supabase, cuerpo.prueba, hashRecibo(cuerpo.recibo));
  return respuestaPush(202, { ok: true });
}
