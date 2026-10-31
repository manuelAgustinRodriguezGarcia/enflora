import "server-only";
import { mismosImportes } from "./dinero.js";
import { clientePagos } from "./datos.js";
import {
  aplicacionDuplicadaTerminal,
  evaluarOrdenRemota,
  operacionDeOrden,
} from "./estados.js";
import { obtenerOrden } from "./orden.js";

async function registrarClaveNotificacion(supabase, clave, pagoId) {
  if (!clave || !supabase) return;
  await supabase.from("pagos_notificaciones").upsert(
    { clave, pago_id: pagoId, aplicada: true },
    { onConflict: "clave", ignoreDuplicates: false },
  );
}

export async function aplicarEvaluacion({ pago, orden, clave = null }) {
  const supabase = clientePagos();
  if (!supabase) return { ok: false, codigo: "sin_servicio" };
  const evaluacion = evaluarOrdenRemota(pago, orden);
  const importeOk = evaluacion.ok && mismosImportes(pago.importe_ars, evaluacion.importe);
  const consistente = Boolean(evaluacion.ok && importeOk);

  if (aplicacionDuplicadaTerminal(pago, evaluacion, consistente)) {
    await registrarClaveNotificacion(supabase, clave, pago.id);
    return { ok: true, duplicada: true, estado: pago.estado, operacion: null };
  }

  const operacion = operacionDeOrden(orden);
  const { data, error } = await supabase.rpc("aplicar_resultado_pago", {
    p_pago_id: pago.id,
    p_estado: consistente ? evaluacion.estado : pago.estado,
    p_mp_estado: orden?.status || null,
    p_mp_detalle: consistente ? evaluacion.detalle : evaluacion.codigo || "inconsistente",
    p_importe: orden?.total_amount == null ? null : String(orden.total_amount),
    p_moneda: orden?.currency || null,
    p_vendedor: orden?.user_id == null ? null : String(orden.user_id),
    p_order_id: orden?.id || null,
    p_referencia: orden?.external_reference == null ? null : String(orden.external_reference),
    p_clave: clave,
    p_consistente: consistente,
  });
  if (error) return { ok: false, codigo: "persistencia" };
  if (data?.ok && operacion) {
    const guardado = await supabase
      .from("pagos")
      .update({ operacion_mp: operacion })
      .eq("id", pago.id)
      .is("operacion_mp", null);
    if (guardado.error && guardado.error.code !== "PGRST204" && guardado.error.code !== "42703") {
      console.error("[mercadopago] operacion_no_guardada");
    }
  }
  return data ? { ...data, operacion: operacion || null } : { ok: false, codigo: "persistencia" };
}

export async function reconciliarPago(pago, clave = null) {
  if (!pago?.order_id) return { ok: true, codigo: "sin_orden" };
  const orden = await obtenerOrden(pago.order_id);
  return aplicarEvaluacion({ pago, orden, clave });
}
