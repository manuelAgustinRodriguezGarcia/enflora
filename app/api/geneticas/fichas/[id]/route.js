import { esUuid, solicitudDeLaApp } from "@/lib/geneticas/reglas";
import { leerDetalle } from "@/lib/geneticas/datos";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request, { params }) {
  if (!solicitudDeLaApp(request.headers)) return json({ ok: false, error: "No se pudo leer la genética." }, 403);
  if (!configuracionLista()) return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);

  const user = await obtenerSesionRapida();
  if (!user?.id) return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);

  const { id } = await params;
  if (!esUuid(id)) return json({ ok: false, error: "La genética no es válida." }, 400);

  const supabase = await crearClienteServidor();
  const detalle = await leerDetalle(supabase, user.id, id);
  if (!detalle) return json({ ok: false, error: "No se encontró la genética." }, 404);
  return json({ ok: true, detalle });
}
