import { revalidatePath } from "next/cache";
import { cronAutorizado } from "@/lib/cron-auth";
import { obtenerCotizacionBilleteVendedor } from "@/lib/pagos/cotizacion-bna";

export async function GET(request) {
  if (!cronAutorizado(request.headers.get("authorization"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const lectura = await obtenerCotizacionBilleteVendedor();
  revalidatePath("/");

  if (!lectura.ok) {
    return Response.json(
      { ok: false, codigo: lectura.codigo || "cotizacion_no_disponible" },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    fuente: lectura.cotizacion.fuente,
    publicadaEn: lectura.cotizacion.publicadaEn,
    vigenteHasta: lectura.vigenteHasta,
    advertenciaAntigua: lectura.advertenciaAntigua,
  });
}
