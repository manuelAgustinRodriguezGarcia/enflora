import { procesarCampana } from "@/lib/push/campana";
import {
  clientePush,
  desactivarSuscripcion,
  guardarResultado,
  leerCampanaLanzamiento,
  leerLote,
  liberarInterrumpidos,
  limpiarLimitesViejos,
  marcarCompletada,
  marcarEnCurso,
  quedanPendientes,
  reclamarEnvio,
} from "@/lib/push/datos";
import { cronAutorizado } from "@/lib/push/secreto";
import { activacionLanzamiento, despacharPush } from "@/lib/push/vapid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!cronAutorizado(request.headers.get("authorization"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const supabase = clientePush();
  if (!supabase) return Response.json({ ok: false, error: "No disponible" }, { status: 503 });

  try {
    const resultado = await procesarCampana(
      {
        activacion: activacionLanzamiento(),
        origenExtra: process.env.APP_URL || "",
        leerCampana: () => leerCampanaLanzamiento(supabase),
        marcarEnCurso: (campana) => marcarEnCurso(supabase, campana),
        liberarInterrumpidos: (id) => liberarInterrumpidos(supabase, id),
        leerLote: (id) => leerLote(supabase, id),
        quedanPendientes: (id) => quedanPendientes(supabase, id),
        marcarCompletada: (id) => marcarCompletada(supabase, id),
        reclamar: (campanaId, suscripcionId, clave) =>
          reclamarEnvio(supabase, campanaId, suscripcionId, clave),
        guardarResultado: (resultadoEnvio) => guardarResultado(supabase, resultadoEnvio),
        desactivar: (id, motivo) => desactivarSuscripcion(supabase, id, motivo),
        despachar: (suscripcion, payload, opciones) => despacharPush(suscripcion, payload, opciones),
      },
      Date.now(),
    );
    await limpiarLimitesViejos(supabase);
    return Response.json(resultado);
  } catch {
    console.error("[push] campana_no_disponible");
    return Response.json({ ok: false, error: "No se pudo ejecutar" }, { status: 503 });
  }
}
