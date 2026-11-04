import { clientePush, estadoSuscripcion } from "@/lib/push/datos";
import { leerJsonAcotado, respuestaPush, solicitudMismoOrigen } from "@/lib/push/http";
import { endpointPushValido } from "@/lib/push/reglas";
import { obtenerUsuario } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!solicitudMismoOrigen(request.headers)) {
    return respuestaPush(403, { ok: false, error: "Solicitud inválida" });
  }
  const cuerpo = await leerJsonAcotado(request, 4000);
  const endpoint = endpointPushValido(cuerpo?.endpoint);
  if (!endpoint) return respuestaPush(400, { ok: false, error: "Solicitud inválida" });

  const supabase = clientePush();
  if (!supabase) return respuestaPush(503, { ok: false, error: "No disponible" });

  const usuario = await obtenerUsuario();
  const leida = await estadoSuscripcion(supabase, endpoint, usuario?.id || null);
  if (!leida.ok) return respuestaPush(503, { ok: false, error: "No disponible" });
  return respuestaPush(200, {
    ok: true,
    activa: leida.activa,
    vinculada: leida.vinculada,
    sesion: Boolean(usuario?.id),
  });
}
