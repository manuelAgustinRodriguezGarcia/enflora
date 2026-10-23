import {
  clientePush,
  consultarCupo,
  crearEnvioPrueba,
  desactivarSuscripcion,
  guardarResultado,
  leerSuscripcionPorId,
  marcarEnvioOk,
  nuevoIdEnvio,
  registrarIntento,
} from "@/lib/push/datos";
import { leerJsonAcotado, respuestaPush } from "@/lib/push/http";
import { ejecutarPrueba } from "@/lib/push/prueba";
import { esUuid } from "@/lib/push/reglas";
import { claveLimiteIp, nuevoRecibo, pruebaAutorizada, salLimite } from "@/lib/push/secreto";
import { configuracionVapid, despacharPush } from "@/lib/push/vapid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!pruebaAutorizada(request.headers.get("authorization"))) {
    return respuestaPush(401, { ok: false, error: "No autorizado" });
  }

  const cuerpo = await leerJsonAcotado(request, 2000);
  if (!cuerpo || "todas" in cuerpo || "campana" in cuerpo || "suscripciones" in cuerpo) {
    return respuestaPush(400, { ok: false, error: "Solicitud inválida" });
  }
  if (!esUuid(cuerpo.suscripcionId)) {
    return respuestaPush(400, { ok: false, error: "Solicitud inválida" });
  }

  const supabase = clientePush();
  if (!supabase || !configuracionVapid()) {
    return respuestaPush(503, { ok: false, error: "No disponible" });
  }

  const clave = claveLimiteIp("secreto:prueba", salLimite());

  try {
    const resultado = await ejecutarPrueba(
      {
        consultarCupo: (limite) => consultarCupo(supabase, clave, limite),
        registrarIntento: () => registrarIntento(supabase, clave),
        leerSuscripcion: () => leerSuscripcionPorId(supabase, cuerpo.suscripcionId),
        nuevoId: nuevoIdEnvio,
        nuevoRecibo,
        crearEnvio: (id, suscripcionId, hash) => crearEnvioPrueba(supabase, id, suscripcionId, hash),
        despachar: despacharPush,
        guardarResultado: (fila) => guardarResultado(supabase, fila),
        marcarEnvioOk: (id) => marcarEnvioOk(supabase, id),
        desactivar: (id, motivo) => desactivarSuscripcion(supabase, id, motivo),
      },
      true,
    );
    if (resultado.status >= 500) console.error("[push] prueba_fallida");
    return respuestaPush(resultado.status, resultado.cuerpo, resultado.reintentarEnSeg);
  } catch {
    console.error("[push] prueba_interrumpida");
    return respuestaPush(503, { ok: false, error: "No disponible" });
  }
}
