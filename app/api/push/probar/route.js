import { administradorPush } from "@/lib/push/admin";
import {
  clientePush,
  consultarCupo,
  crearEnvioPrueba,
  desactivarSuscripcion,
  guardarResultado,
  leerSuscripcionPorEndpoint,
  marcarEnvioOk,
  nuevoIdEnvio,
  registrarIntento,
} from "@/lib/push/datos";
import { leerJsonAcotado, respuestaPush } from "@/lib/push/http";
import { ejecutarPrueba } from "@/lib/push/prueba";
import { endpointPushValido } from "@/lib/push/reglas";
import { claveLimiteIp, ipCliente, nuevoRecibo, salLimite } from "@/lib/push/secreto";
import { configuracionVapid, despacharPush } from "@/lib/push/vapid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const cuerpo = await leerJsonAcotado(request, 4000);
  const endpoint = endpointPushValido(cuerpo?.endpoint);
  if (!cuerpo || !endpoint || "todas" in cuerpo || "campana" in cuerpo) {
    return respuestaPush(400, { ok: false, error: "Solicitud inválida" });
  }

  const supabase = clientePush();
  if (!supabase || !configuracionVapid()) {
    return respuestaPush(503, { ok: false, error: "No disponible" });
  }

  const admin = await administradorPush(request);
  const sal = salLimite();
  const clave = admin
    ? claveLimiteIp(`admin:${admin.id}:probar`, sal)
    : claveLimiteIp(`${ipCliente(request.headers.get("x-forwarded-for"))}:probar`, sal);

  try {
    const resultado = await ejecutarPrueba(
      {
        consultarCupo: (limite) => consultarCupo(supabase, clave, limite),
        registrarIntento: () => registrarIntento(supabase, clave),
        leerSuscripcion: () => leerSuscripcionPorEndpoint(supabase, endpoint),
        nuevoId: nuevoIdEnvio,
        nuevoRecibo,
        crearEnvio: (id, suscripcionId, hash) => crearEnvioPrueba(supabase, id, suscripcionId, hash),
        despachar: despacharPush,
        guardarResultado: (fila) => guardarResultado(supabase, fila),
        marcarEnvioOk: (id) => marcarEnvioOk(supabase, id),
        desactivar: (id, motivo) => desactivarSuscripcion(supabase, id, motivo),
      },
      Boolean(admin),
    );
    if (resultado.status >= 500) console.error("[push] prueba_dispositivo_fallida");
    return respuestaPush(resultado.status, resultado.cuerpo, resultado.reintentarEnSeg);
  } catch {
    console.error("[push] prueba_dispositivo_interrumpida");
    return respuestaPush(503, { ok: false, error: "No disponible" });
  }
}
