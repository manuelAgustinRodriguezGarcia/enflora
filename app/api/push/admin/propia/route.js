import { obtenerAdmin, verificarCredencial } from "@/lib/admin/autorizacion";
import { MOTIVOS_ADMIN } from "@/lib/admin/reglas";
import {
  clientePush,
  consultarCupo,
  desactivarSuscripcion,
  leerSuscripcionesPropias,
  marcarEnvioOk,
  registrarIntento,
} from "@/lib/push/datos";
import { leerJsonAcotado, respuestaPush, solicitudMismoOrigen } from "@/lib/push/http";
import { enviarADispositivosPropios } from "@/lib/push/propio";
import { LIMITE_PRUEBAS_ADMIN, avisoAdministrativo } from "@/lib/push/reglas";
import { claveLimiteIp, salLimite } from "@/lib/push/secreto";
import { configuracionVapid, despacharPush } from "@/lib/push/vapid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!solicitudMismoOrigen(request.headers)) {
    return respuestaPush(403, { ok: false, error: "Solicitud inválida" });
  }

  const acceso = await obtenerAdmin("notificaciones");
  if (!acceso.ok) {
    const estado = acceso.motivo === MOTIVOS_ADMIN.sinSesion ? 401 : 403;
    return respuestaPush(estado, { ok: false, error: "No autorizado" });
  }

  let usuarioId = null;
  try {
    usuarioId = verificarCredencial(acceso.credencial, "notificaciones").id;
  } catch {
    return respuestaPush(403, { ok: false, error: "No autorizado" });
  }
  if (!usuarioId) return respuestaPush(403, { ok: false, error: "No autorizado" });

  const cuerpo = await leerJsonAcotado(request, 4000);
  const aviso = avisoAdministrativo(cuerpo);
  if (!aviso || cuerpo?.masivo === true) {
    return respuestaPush(400, { ok: false, error: "Solicitud inválida" });
  }

  const supabase = clientePush();
  if (!supabase || !configuracionVapid()) {
    return respuestaPush(503, { ok: false, error: "No disponible" });
  }

  const clave = claveLimiteIp(`admin:${usuarioId}:propia`, salLimite());
  try {
    const resultado = await enviarADispositivosPropios(
      {
        consultarCupo: () => consultarCupo(supabase, clave, LIMITE_PRUEBAS_ADMIN),
        registrarIntento: () => registrarIntento(supabase, clave),
        leerPropias: () => leerSuscripcionesPropias(supabase, usuarioId),
        despachar: despacharPush,
        marcarEnvioOk: (id) => marcarEnvioOk(supabase, id),
        desactivar: (id, motivo) => desactivarSuscripcion(supabase, id, motivo),
      },
      aviso,
    );
    return respuestaPush(resultado.status, resultado.cuerpo, resultado.reintentarEnSeg);
  } catch {
    console.error("[push] prueba_propia_interrumpida");
    return respuestaPush(503, { ok: false, error: "No disponible" });
  }
}
