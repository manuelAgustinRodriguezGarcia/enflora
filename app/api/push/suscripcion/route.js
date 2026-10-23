import {
  clientePush,
  consultarCupo,
  guardarSuscripcion,
  reemplazarSuscripcion,
  registrarIntento,
  revocarSuscripcion,
} from "@/lib/push/datos";
import { leerJsonAcotado, respuestaPush } from "@/lib/push/http";
import { LIMITE_ALTAS, endpointPushValido, normalizarSuscripcion } from "@/lib/push/reglas";
import { claveLimiteIp, ipCliente, salLimite } from "@/lib/push/secreto";
import { obtenerUsuario } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function cupo(request, supabase) {
  const clave = claveLimiteIp(ipCliente(request.headers.get("x-forwarded-for")), salLimite());
  const resultado = await consultarCupo(supabase, clave, LIMITE_ALTAS);
  if (!resultado) return { estado: "error" };
  if (!resultado.permitido) return { estado: "limite", reintentarEnSeg: resultado.reintentarEnSeg };
  const registrado = await registrarIntento(supabase, clave);
  return { estado: registrado ? "ok" : "error" };
}

function respuestaCupo(limite) {
  if (limite.estado === "limite") {
    return respuestaPush(
      429,
      { ok: false, error: "Demasiados intentos", reintentarEn: limite.reintentarEnSeg },
      limite.reintentarEnSeg,
    );
  }
  return respuestaPush(503, { ok: false, error: "No disponible" });
}

export async function POST(request) {
  const supabase = clientePush();
  if (!supabase) return respuestaPush(503, { ok: false, error: "No disponible" });

  const cuerpo = await leerJsonAcotado(request, 8000);
  const entrada = normalizarSuscripcion(cuerpo);
  if (!entrada) return respuestaPush(400, { ok: false, error: "Suscripción inválida" });
  const reemplaza = cuerpo.reemplaza == null ? null : endpointPushValido(cuerpo.reemplaza);
  if (cuerpo.reemplaza != null && !reemplaza) {
    return respuestaPush(400, { ok: false, error: "Suscripción inválida" });
  }

  const limite = await cupo(request, supabase);
  if (limite.estado !== "ok") return respuestaCupo(limite);

  const usuario = await obtenerUsuario();
  const guardada = await guardarSuscripcion(
    supabase,
    entrada,
    usuario?.id || null,
    request.headers.get("user-agent"),
  );
  if (!guardada.ok) return respuestaPush(503, { ok: false, error: "No se pudo guardar" });
  if (reemplaza && !(await reemplazarSuscripcion(supabase, reemplaza, entrada.endpoint))) {
    console.error("[push] reemplazo_no_registrado");
  }
  return respuestaPush(200, { ok: true, id: guardada.id });
}

export async function DELETE(request) {
  const supabase = clientePush();
  if (!supabase) return respuestaPush(503, { ok: false, error: "No disponible" });

  const cuerpo = await leerJsonAcotado(request, 8000);
  const endpoint = endpointPushValido(cuerpo?.endpoint);
  if (!endpoint) return respuestaPush(400, { ok: false, error: "Suscripción inválida" });
  const limite = await cupo(request, supabase);
  if (limite.estado !== "ok") return respuestaCupo(limite);

  const revocada = await revocarSuscripcion(supabase, endpoint);
  if (!revocada) return respuestaPush(503, { ok: false, error: "No se pudo cancelar" });
  return respuestaPush(200, { ok: true });
}
