import {
  clientePush,
  desactivarSuscripcion,
  leerSuscripcionPorEndpoint,
  permiteAlta,
  registrarEnvioPrueba,
  registrarIntento,
} from "@/lib/push/datos";
import { clasificarResultadoPush, endpointPushValido, payloadAviso } from "@/lib/push/reglas";
import { claveLimiteIp, ipCliente, salLimite } from "@/lib/push/secreto";
import { configuracionVapid, despacharPush } from "@/lib/push/vapid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVISO_PRUEBA = payloadAviso(
  "Prueba de Enflora",
  "Este aviso solo llega al dispositivo de prueba.",
  "/",
);

export async function POST(request) {
  const texto = await request.text();
  if (texto.length > 4000) return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });

  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });
  }

  const endpoint = endpointPushValido(cuerpo?.endpoint);
  if (!endpoint || "todas" in (cuerpo || {}) || "campana" in (cuerpo || {})) {
    return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });
  }

  const supabase = clientePush();
  if (!supabase || !configuracionVapid()) {
    return Response.json({ ok: false, error: "No disponible" }, { status: 503 });
  }

  const clave = claveLimiteIp(`${ipCliente(request.headers.get("x-forwarded-for"))}:probar`, salLimite());
  const permitido = await permiteAlta(supabase, clave);
  if (permitido == null) return Response.json({ ok: false, error: "No disponible" }, { status: 503 });
  if (!permitido) return Response.json({ ok: false, error: "Demasiados intentos" }, { status: 429 });
  if (!(await registrarIntento(supabase, clave))) {
    return Response.json({ ok: false, error: "No disponible" }, { status: 503 });
  }

  const leida = await leerSuscripcionPorEndpoint(supabase, endpoint);
  if (!leida.ok) return Response.json({ ok: false, error: "No disponible" }, { status: 503 });
  if (!leida.suscripcion || !leida.suscripcion.activa) {
    return Response.json({ ok: false, error: "Suscripción inactiva" }, { status: 409 });
  }

  try {
    const respuesta = await despacharPush(
      leida.suscripcion,
      { ...AVISO_PRUEBA, etiqueta: "push-prueba" },
      { topic: "push-prueba" },
    );
    const clase = clasificarResultadoPush(respuesta.statusCode);
    await registrarEnvioPrueba(supabase, leida.suscripcion.id, clase.estado, respuesta.statusCode, null);
    if (clase.expirada) await desactivarSuscripcion(supabase, leida.suscripcion.id, "expirada");
    return Response.json({ ok: true, estado: clase.estado, visualizado: false });
  } catch (error) {
    const codigo = Number(error && error.statusCode) || null;
    const clase = clasificarResultadoPush(codigo || 500);
    const detalle = typeof error?.body === "string" ? error.body.slice(0, 180) : "error";
    await registrarEnvioPrueba(supabase, leida.suscripcion.id, clase.estado, codigo, detalle);
    if (clase.expirada) await desactivarSuscripcion(supabase, leida.suscripcion.id, "expirada");
    console.error("[push] prueba_dispositivo_fallida");
    return Response.json(
      { ok: false, estado: clase.estado, visualizado: false },
      { status: clase.expirada ? 410 : 502 },
    );
  }
}
