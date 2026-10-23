import { clientePush, suscripcionActiva } from "@/lib/push/datos";
import { endpointPushValido } from "@/lib/push/reglas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (!endpoint) return Response.json({ ok: false, error: "Solicitud inválida" }, { status: 400 });

  const supabase = clientePush();
  if (!supabase) return Response.json({ ok: false, error: "No disponible" }, { status: 503 });

  const leida = await suscripcionActiva(supabase, endpoint);
  if (!leida.ok) return Response.json({ ok: false, error: "No disponible" }, { status: 503 });
  return Response.json({ ok: true, activa: leida.activa }, { headers: { "Cache-Control": "no-store" } });
}
