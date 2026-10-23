import {
  clientePush,
  desactivarSuscripcion,
  leerSuscripcionPorId,
  registrarEnvioPrueba,
} from "@/lib/push/datos";
import { clasificarResultadoPush, esUuid, payloadAviso } from "@/lib/push/reglas";
import { pruebaAutorizada } from "@/lib/push/secreto";
import { configuracionVapid, despacharPush } from "@/lib/push/vapid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVISO_PRUEBA = payloadAviso(
  "Prueba de Enflora",
  "Este aviso solo llega al dispositivo de prueba.",
  "/",
);

export async function POST(request) {
  if (!pruebaAutorizada(request.headers.get("authorization"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const texto = await request.text();
  if (texto.length > 2000) return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });

  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });
  }

  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });
  }
  if ("todas" in cuerpo || "campana" in cuerpo || "suscripciones" in cuerpo) {
    return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });
  }
  if (!esUuid(cuerpo.suscripcionId)) {
    return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });
  }

  const supabase = clientePush();
  if (!supabase || !configuracionVapid()) {
    return Response.json({ ok: false, error: "No disponible" }, { status: 503 });
  }

  const leida = await leerSuscripcionPorId(supabase, cuerpo.suscripcionId);
  if (!leida.ok) return Response.json({ ok: false, error: "No disponible" }, { status: 503 });
  if (!leida.suscripcion) return Response.json({ ok: false, error: "No encontrado" }, { status: 404 });
  if (!leida.suscripcion.activa) {
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
    console.error("[push] prueba_fallida");
    return Response.json(
      { ok: false, estado: clase.estado, visualizado: false },
      { status: clase.expirada ? 410 : 502 },
    );
  }
}
