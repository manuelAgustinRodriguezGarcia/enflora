import { clientePush, guardarSuscripcion, permiteAlta, registrarIntento, revocarSuscripcion } from "@/lib/push/datos";
import { endpointPushValido, normalizarSuscripcion } from "@/lib/push/reglas";
import { claveLimiteIp, ipCliente, salLimite } from "@/lib/push/secreto";
import { obtenerUsuario } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function leerCuerpo(request) {
  const texto = await request.text();
  if (texto.length > 8000) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

async function cupo(request, supabase) {
  const clave = claveLimiteIp(ipCliente(request.headers.get("x-forwarded-for")), salLimite());
  const permitido = await permiteAlta(supabase, clave);
  if (permitido == null) return "error";
  if (!permitido) return "limite";
  const registrado = await registrarIntento(supabase, clave);
  return registrado ? "ok" : "error";
}

export async function POST(request) {
  const supabase = clientePush();
  if (!supabase) return Response.json({ ok: false, error: "No disponible" }, { status: 503 });

  const cuerpo = await leerCuerpo(request);
  const entrada = normalizarSuscripcion(cuerpo);
  if (!entrada) return Response.json({ ok: false, error: "Suscripción inválida" }, { status: 400 });
  const limite = await cupo(request, supabase);
  if (limite === "limite") return Response.json({ ok: false, error: "Demasiados intentos" }, { status: 429 });
  if (limite !== "ok") return Response.json({ ok: false, error: "No disponible" }, { status: 503 });

  const usuario = await obtenerUsuario();
  const guardada = await guardarSuscripcion(
    supabase,
    entrada,
    usuario?.id || null,
    request.headers.get("user-agent"),
  );
  if (!guardada.ok) return Response.json({ ok: false, error: "No se pudo guardar" }, { status: 503 });
  return Response.json({ ok: true, id: guardada.id });
}

export async function DELETE(request) {
  const supabase = clientePush();
  if (!supabase) return Response.json({ ok: false, error: "No disponible" }, { status: 503 });

  const cuerpo = await leerCuerpo(request);
  const endpoint = endpointPushValido(cuerpo?.endpoint);
  if (!endpoint) return Response.json({ ok: false, error: "Suscripción inválida" }, { status: 400 });
  const limite = await cupo(request, supabase);
  if (limite === "limite") return Response.json({ ok: false, error: "Demasiados intentos" }, { status: 429 });
  if (limite !== "ok") return Response.json({ ok: false, error: "No disponible" }, { status: 503 });

  const revocada = await revocarSuscripcion(supabase, endpoint);
  if (!revocada) return Response.json({ ok: false, error: "No se pudo cancelar" }, { status: 503 });
  return Response.json({ ok: true });
}
