import { clienteContactos, registrarContacto } from "@/lib/contactos/datos";
import { LIMITE_ALTAS_CONTACTOS, MENSAJES_CONTACTOS, validarContactoPublico } from "@/lib/contactos/reglas";
import { consultarCupo, registrarIntento } from "@/lib/push/datos";
import { leerJsonAcotado, respuestaPush, solicitudMismoOrigen } from "@/lib/push/http";
import { claveLimiteIp, ipCliente, salLimite } from "@/lib/push/secreto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPUESTA_OK = { ok: true };

export async function POST(request) {
  if (!solicitudMismoOrigen(request.headers)) {
    return respuestaPush(403, { ok: false, error: MENSAJES_CONTACTOS.generico });
  }

  const supabase = clienteContactos();
  if (!supabase) return respuestaPush(503, { ok: false, error: MENSAJES_CONTACTOS.generico });

  const cuerpo = await leerJsonAcotado(request, 4000);
  if (!cuerpo) return respuestaPush(400, { ok: false, error: MENSAJES_CONTACTOS.generico });

  const validacion = validarContactoPublico(cuerpo);
  if (!validacion.ok) {
    return respuestaPush(400, { ok: false, error: validacion.error, campo: validacion.campo || null });
  }
  if (validacion.honeypot) return respuestaPush(200, RESPUESTA_OK);

  const clave = `${claveLimiteIp(ipCliente(request.headers.get("x-forwarded-for")), salLimite())}:contactos`;
  const cupo = await consultarCupo(supabase, clave, LIMITE_ALTAS_CONTACTOS);
  if (!cupo) return respuestaPush(503, { ok: false, error: MENSAJES_CONTACTOS.generico });
  if (!cupo.permitido) {
    return respuestaPush(
      429,
      { ok: false, error: MENSAJES_CONTACTOS.limite, reintentarEn: cupo.reintentarEnSeg },
      cupo.reintentarEnSeg,
    );
  }
  if (!(await registrarIntento(supabase, clave))) {
    return respuestaPush(503, { ok: false, error: MENSAJES_CONTACTOS.generico });
  }

  const registro = await registrarContacto(supabase, validacion.datos);
  if (!registro.ok) return respuestaPush(503, { ok: false, error: MENSAJES_CONTACTOS.generico });

  return respuestaPush(200, RESPUESTA_OK);
}
