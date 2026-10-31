import { revalidatePath, revalidateTag } from "next/cache";
import { cronAutorizado } from "@/lib/cron-auth";
import {
  actualizarCotizacionOficial,
  tagCotizacionOficial,
} from "@/lib/cotizacion";

export async function GET(request) {
  if (!cronAutorizado(request.headers.get("authorization"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const cotizacion = await actualizarCotizacionOficial();
  revalidateTag(tagCotizacionOficial, "max");
  revalidatePath("/");

  if (!cotizacion) {
    return Response.json(
      { ok: false, error: "No se pudo obtener la cotización" },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    valor: cotizacion.valor,
    fecha: cotizacion.fecha,
    ventana: cotizacion.ventana,
    fuente: cotizacion.fuente,
  });
}
