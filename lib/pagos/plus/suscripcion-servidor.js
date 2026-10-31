import "server-only";

import { correoPayerOrden, leerAmbientePagos, urlPublica } from "@/lib/pagos/ambiente";
import { obtenerCotizacionBilleteVendedor } from "@/lib/pagos/cotizacion-bna";
import { escala4ADecimal, mismosImportes } from "@/lib/pagos/dinero";
import { cuerpoPreapprovalPlusPendiente, cuerpoActualizarImportePreapproval } from "@/lib/pagos/plus/cuerpo-preapproval";
import { ESTADOS_PLUS_INTERNO, PRECIO_PLUS_USD } from "@/lib/pagos/plus/constantes";
import { importePlusDecimalOrden, validarCoherenciaImportePlus } from "@/lib/pagos/plus/dinero";
import { estadoInternoDesdePreapprovalMp } from "@/lib/pagos/plus/estados";
import {
  actualizarPreapproval,
  crearPreapprovalPlus,
  obtenerPreapproval,
} from "@/lib/pagos/plus/preapproval-api";

export function gateAltaPlus(env = process.env) {
  const lectura = leerAmbientePagos(env);
  if (!lectura.ok) return { ok: false, codigo: lectura.codigo };
  if (lectura.ambiente === "produccion" && env.PLUS_LIVE_ENABLED !== "true") {
    return { ok: false, codigo: "plus_produccion_desactivado" };
  }
  return { ok: true, ambiente: lectura.ambiente };
}

export async function prepararAltaPlus({
  supabase,
  usuarioId,
  emailUsuario,
  env = process.env,
  ejecutarMp = false,
  fetchFn,
  suscripcionId: suscripcionIdParam,
  backUrl,
}) {
  const gate = gateAltaPlus(env);
  if (!gate.ok) return gate;

  const evaluada = await obtenerCotizacionBilleteVendedor();
  if (!evaluada.ok) return { ok: false, codigo: evaluada.codigo || "cotizacion_no_disponible" };
  const { cotizacion } = evaluada;

  const importeDecimal = importePlusDecimalOrden(cotizacion.venta);
  if (!importeDecimal) return { ok: false, codigo: "importe_invalido" };

  const coherencia = validarCoherenciaImportePlus({
    importeDecimal,
    escalaVenta: cotizacion.venta,
  });
  if (!coherencia.ok) return coherencia;

  const correo = correoPayerOrden({ ambiente: gate.ambiente, emailUsuario, env });
  if (!correo.email) return { ok: false, codigo: correo.codigo || "comprador_invalido" };

  const suscripcionId = suscripcionIdParam || crypto.randomUUID();
  const retorno =
    backUrl ||
    `${urlPublica(env).replace(/\/$/, "")}/pagos/plus/resultado?suscripcion=${suscripcionId}`;
  const cuerpo = cuerpoPreapprovalPlusPendiente({
    externalReference: suscripcionId,
    payerEmail: correo.email,
    importeDecimalArs: importeDecimal,
    backUrl: retorno,
  });
  if (!cuerpo.ok) return cuerpo;

  const importeMp = cuerpo.body?.auto_recurring?.transaction_amount;
  if (!mismosImportes(importeDecimal, importeMp)) {
    return { ok: false, codigo: "importe_incoherente", esperado: importeDecimal, recibido: importeMp };
  }

  if (!ejecutarMp) {
    return {
      ok: true,
      simulado: true,
      suscripcionId,
      ambiente: gate.ambiente,
      cuerpoMp: cuerpo.body,
      importeDecimal,
      cotizacion,
    };
  }

  const remoto = await crearPreapprovalPlus(cuerpo.body, {
    fetchFn,
    idempotencyKey: `plus-alta-${suscripcionId}`,
  });

  const { error } = await supabase.from("plus_suscripciones").insert({
    id: suscripcionId,
    usuario_id: usuarioId,
    ambiente: gate.ambiente,
    external_reference: suscripcionId,
    preapproval_id: remoto.id,
    estado_interno: estadoInternoDesdePreapprovalMp(remoto.status) || ESTADOS_PLUS_INTERNO.pendienteCheckout,
    estado_mp: remoto.status,
    precio_usd: PRECIO_PLUS_USD,
    importe_ars: importeDecimal,
    cotizacion_valor: Number.parseFloat(escala4ADecimal(cotizacion.venta)),
    cotizacion_fuente: cotizacion.fuente,
    cotizacion_publicada_en: cotizacion.publicadaEn,
    cotizacion_tipo: "billete_vendedor",
    init_point: remoto.init_point,
    back_url: retorno,
    proxima_renovacion: remoto.next_payment_date || null,
  });

  if (error) return { ok: false, codigo: "persistencia_fallida", detalle: error.message };

  return {
    ok: true,
    suscripcionId,
    initPoint: remoto.init_point,
    preapprovalId: remoto.id,
  };
}

export function interpretarPreapprovalRemoto(remoto) {
  return {
    preapprovalId: remoto?.id || "",
    estadoMp: remoto?.status || "",
    estadoInterno: estadoInternoDesdePreapprovalMp(remoto?.status),
    initPoint: remoto?.init_point || "",
    proximaRenovacion: remoto?.next_payment_date || null,
    importeMp: remoto?.auto_recurring?.transaction_amount ?? null,
  };
}

export async function sincronizarImportePreapproval({
  preapprovalId,
  importeDecimal,
  fetchFn,
  confirmar = true,
}) {
  const put = cuerpoActualizarImportePreapproval(importeDecimal);
  if (!put.ok) return put;

  try {
    await actualizarPreapproval(preapprovalId, put.body, {
      fetchFn,
      idempotencyKey: `plus-put-${preapprovalId}-${importeDecimal}`,
    });
  } catch (error) {
    return { ok: false, codigo: "put_rechazado", fase: "put", status: error?.status ?? null };
  }

  if (!confirmar) return { ok: true, confirmado: false };

  let remoto;
  try {
    remoto = await obtenerPreapproval(preapprovalId, { fetchFn });
  } catch (error) {
    return { ok: false, codigo: "confirmacion_get_fallida", fase: "get", status: error?.status ?? null };
  }
  const remotoImporte = Number(remoto?.auto_recurring?.transaction_amount);
  const esperado = Number(importeDecimal);
  if (!Number.isFinite(remotoImporte) || Math.abs(remotoImporte - esperado) > 0.01) {
    return { ok: false, codigo: "put_no_confirmado", fase: "get", remotoImporte, esperado };
  }
  return { ok: true, confirmado: true, remotoImporte };
}
