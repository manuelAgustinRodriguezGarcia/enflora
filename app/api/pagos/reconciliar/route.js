import { cronAutorizado } from "@/lib/cron-auth";
import { leerRecepcionPagos } from "@/lib/pagos/ambiente";
import { reconciliarPago } from "@/lib/pagos/aplicar";
import { clientePagos } from "@/lib/pagos/datos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!cronAutorizado(request.headers.get("authorization"))) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const ambiente = leerRecepcionPagos();
  if (!ambiente.ok) {
    return Response.json({ ok: true, ignorado: true });
  }

  const supabase = clientePagos();
  if (!supabase) return Response.json({ ok: false }, { status: 503 });

  const { data, error } = await supabase
    .from("pagos")
    .select("id, estado, order_id, importe_ars, ambiente, vendedor_mp")
    .eq("ambiente", ambiente.ambiente)
    .in("estado", ["creada", "pendiente"])
    .not("order_id", "is", null)
    .order("creado_en", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[mercadopago] reconciliar_no_disponible");
    return Response.json({ ok: false }, { status: 503 });
  }

  let revisados = 0;
  let actualizados = 0;
  for (const pago of data || []) {
    revisados += 1;
    try {
      const resultado = await reconciliarPago(pago);
      if (resultado?.ok && resultado.estado && resultado.estado !== pago.estado) actualizados += 1;
    } catch {
      console.error("[mercadopago] reconciliar_orden_no_disponible");
    }
  }

  return Response.json({ ok: true, revisados, actualizados });
}
