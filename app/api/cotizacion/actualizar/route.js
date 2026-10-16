import { revalidatePath, revalidateTag } from "next/cache";
import {
  actualizarCotizacionOficial,
  tagCotizacionOficial,
} from "@/lib/cotizacion";

function autorizado(request) {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function GET(request) {
  if (!autorizado(request)) {
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
