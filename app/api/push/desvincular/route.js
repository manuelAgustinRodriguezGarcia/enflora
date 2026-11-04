import { clientePush, consultarCupo, desvincularSuscripcion, registrarIntento } from "@/lib/push/datos";
import { leerJsonAcotado, respuestaPush, solicitudMismoOrigen } from "@/lib/push/http";
import { LIMITE_ALTAS, endpointPushValido } from "@/lib/push/reglas";
import { claveLimiteIp, ipCliente, salLimite } from "@/lib/push/secreto";
import { obtenerUsuario } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!solicitudMismoOrigen(request.headers)) {
    return respuestaPush(403, { ok: false, error: "Solicitud inválida" });
  }
  const usuario = await obtenerUsuario();
  if (!usuario?.id) return respuestaPush(401, { ok: false, error: "No autorizado" });

  const cuerpo = await leerJsonAcotado(request, 4000);
  const endpoint = endpointPushValido(cuerpo?.endpoint);
  if (!endpoint) return respuestaPush(400, { ok: false, error: "Suscripción inválida" });

  const supabase = clientePush();
  if (!supabase) return respuestaPush(503, { ok: false, error: "No disponible" });

  const clave = claveLimiteIp(`${ipCliente(request.headers.get("x-forwarded-for"))}:desvincular`, salLimite());
  const cupo = await consultarCupo(supabase, clave, LIMITE_ALTAS);
  if (!cupo) return respuestaPush(503, { ok: false, error: "No disponible" });
  if (!cupo.permitido) {
    return respuestaPush(429, { ok: false, error: "Demasiados intentos", reintentarEn: cupo.reintentarEnSeg }, cupo.reintentarEnSeg);
  }
  if (!(await registrarIntento(supabase, clave))) {
    return respuestaPush(503, { ok: false, error: "No disponible" });
  }

  const resultado = await desvincularSuscripcion(supabase, endpoint, usuario.id);
  if (!resultado.ok) return respuestaPush(503, { ok: false, error: "No se pudo desvincular" });
  return respuestaPush(200, { ok: true, desvinculada: resultado.desvinculada });
}
