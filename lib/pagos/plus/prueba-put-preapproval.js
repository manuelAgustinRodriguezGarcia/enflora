import "server-only";

import { leerRecepcionPagos } from "@/lib/pagos/ambiente";
import { mismosImportes } from "@/lib/pagos/dinero";
import { cuerpoActualizarImportePreapproval } from "@/lib/pagos/plus/cuerpo-preapproval";
import { importePlusDecimalOrden } from "@/lib/pagos/plus/dinero";
import {
  actualizarPreapproval,
  buscarAuthorizedPaymentsPreapproval,
  obtenerPreapproval,
  obtenerUsuarioMercadoPago,
} from "@/lib/pagos/plus/preapproval-api";

/**
 * Prueba controlada de PUT /preapproval en sandbox (PLAN 420).
 * Secuencia: GET 6552 → PUT 6804 → GET 6804 → PUT 6552 → GET 6552.
 *
 * El ID de suscripción y los importes están FIJOS: no se aceptan por parámetro.
 * Sin autorización explícita (`autorizacion`) solo se hacen GET (dry-run).
 */
export const PRUEBA_PUT = Object.freeze({
  preapprovalId: "d4039c1610894346925cef3997470afc",
  suscripcionId: "2d239f9f-2986-4c25-86ad-c31904dec8a5",
  importeOriginal: 6552,
  importeTemporal: 6804,
  moneda: "ARS",
  horasMinimasAntesCobro: 72,
  autorizacion: "SANDBOX-d4039c16-6552-6804",
  intentosRestauracion: 3,
});

/** Campos que el PUT NO debe tocar: se comparan antes/después. */
function camposInvariantes(remoto) {
  const ar = remoto?.auto_recurring || {};
  return {
    status: remoto?.status ?? null,
    next_payment_date: remoto?.next_payment_date ?? null,
    external_reference: remoto?.external_reference ?? null,
    collector_id: remoto?.collector_id ?? null,
    payer_id: remoto?.payer_id ?? null,
    payer_email: remoto?.payer_email ?? null,
    card_id: remoto?.card_id ?? null,
    payment_method_id: remoto?.payment_method_id ?? null,
    back_url: remoto?.back_url ?? null,
    frequency: ar.frequency ?? null,
    frequency_type: ar.frequency_type ?? null,
    start_date: ar.start_date ?? null,
    end_date: ar.end_date ?? null,
    currency_id: ar.currency_id ?? null,
  };
}

function diferencias(antes, despues) {
  return Object.keys(antes).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]));
}

function importeDe(remoto) {
  return remoto?.auto_recurring?.transaction_amount;
}

function esImporte(remoto, esperado) {
  const actual = importeDe(remoto);
  return actual != null && mismosImportes(esperado.toFixed(2), String(actual));
}

/** El token de MP termina en `-<id de usuario/collector>`; no se imprime el token. */
function usuarioDeToken(token) {
  const m = /-(\d+)$/.exec(String(token || "").trim());
  return m ? m[1] : null;
}

/** En dry-run (y como defensa en profundidad) el fetch solo puede hacer GET. */
function fetchSoloLectura(fetchFn = fetch) {
  return async (url, init) => {
    const metodo = String(init?.method || "GET").toUpperCase();
    if (metodo !== "GET") throw new Error(`dry_run_metodo_prohibido_${metodo}`);
    return fetchFn(url, init);
  };
}

async function esperar(ms) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

async function snapshotSupabase(supabase) {
  if (!supabase) return null;
  const subs = await supabase
    .from("plus_suscripciones")
    .select("id, ambiente, estado_interno, importe_ars, preapproval_id, periodo_vigente_hasta")
    .eq("preapproval_id", PRUEBA_PUT.preapprovalId);
  const pagos = await supabase
    .from("plus_pagos_recurrentes")
    .select("id, authorized_payment_id, estado_interno")
    .eq("suscripcion_id", PRUEBA_PUT.suscripcionId);
  if (subs.error || pagos.error) throw new Error("supabase_lectura_fallida");
  return { suscripciones: subs.data || [], pagos: pagos.data || [] };
}

function idsPagosMp(respuesta) {
  const lista = Array.isArray(respuesta?.results) ? respuesta.results : [];
  return lista.map((p) => String(p.id)).sort();
}

/**
 * @returns {Promise<object>} resultado serializable (sin secretos).
 */
export async function ejecutarPruebaPutPreapproval({
  env = process.env,
  fetchFn,
  ahora = new Date(),
  autorizacion = null,
  supabase = null,
  obtenerCotizacion = null,
  pausaMs = 1000,
} = {}) {
  const real = autorizacion !== null && autorizacion !== undefined;
  const informe = {
    modo: real ? "real" : "dry-run",
    preapprovalId: PRUEBA_PUT.preapprovalId,
    suscripcionId: PRUEBA_PUT.suscripcionId,
    ok: false,
    codigo: null,
    pasos: [],
    verificaciones: {},
    putEjecutados: [],
    restaurado: null,
  };
  const paso = (nombre, detalle = {}) => informe.pasos.push({ paso: nombre, ...detalle });
  const falla = (codigo, extra = {}) => {
    informe.ok = false;
    informe.codigo = codigo;
    Object.assign(informe, extra);
    return informe;
  };

  // ── 1. Seguridad previa (sin red) ──────────────────────────────────────────
  if (real && autorizacion !== PRUEBA_PUT.autorizacion) return falla("autorizacion_invalida");

  if (env.NODE_ENV === "production") return falla("produccion_rechazada");
  if (String(env.MERCADOPAGO_ENV || "").trim() !== "prueba") return falla("ambiente_no_es_prueba");
  if (env.PAYMENTS_LIVE_ENABLED === "true") return falla("cobros_reales_habilitados");
  const lectura = leerRecepcionPagos(env);
  if (!lectura.ok) return falla(lectura.codigo);
  if (lectura.ambiente !== "prueba" || lectura.cobrosReales) return falla("ambiente_no_es_prueba");
  const token = env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return falla("falta_access_token");
  if (real && !supabase) return falla("supabase_requerido_para_ejecucion_real");
  paso("seguridad_previa", { ambiente: lectura.ambiente });

  const fetchBase = fetchFn || fetch;
  const fetchLectura = fetchSoloLectura(fetchBase);
  const fetchGuardado = real ? fetchBase : fetchLectura;

  // ── 2. Estado inicial (solo GET) ───────────────────────────────────────────
  let inicial;
  let pagosMpAntes;
  let supabaseAntes;
  try {
    inicial = await obtenerPreapproval(PRUEBA_PUT.preapprovalId, { fetchFn: fetchLectura });
    pagosMpAntes = idsPagosMp(
      await buscarAuthorizedPaymentsPreapproval(PRUEBA_PUT.preapprovalId, { fetchFn: fetchLectura }),
    );
    supabaseAntes = await snapshotSupabase(supabase);
  } catch (error) {
    return falla("lectura_inicial_fallida", { detalle: error?.message || null });
  }
  paso("get_inicial", {
    status: inicial?.status ?? null,
    importe: importeDe(inicial) ?? null,
    moneda: inicial?.auto_recurring?.currency_id ?? null,
    proximoCobro: inicial?.next_payment_date ?? null,
    pagosAutorizadosMp: pagosMpAntes.length,
  });

  const proximo = inicial?.next_payment_date ? new Date(inicial.next_payment_date) : null;
  const horasHastaCobro =
    proximo && !Number.isNaN(proximo.getTime()) ? (proximo.getTime() - ahora.getTime()) / 3600000 : null;
  const usuarioToken = usuarioDeToken(token);
  let vendedor = null;
  try {
    vendedor = await obtenerUsuarioMercadoPago("me", { fetchFn: fetchLectura });
  } catch (error) {
    return falla("lectura_usuarios_fallida", { detalle: error?.message || null });
  }
  const filaLocal = supabaseAntes?.suscripciones?.[0] ?? null;

  const v = {
    idRemotoCoincide: String(inicial?.id || "") === PRUEBA_PUT.preapprovalId,
    estadoAuthorized: String(inicial?.status || "").toLowerCase() === "authorized",
    monedaArs: inicial?.auto_recurring?.currency_id === PRUEBA_PUT.moneda,
    importeInicial6552: esImporte(inicial, PRUEBA_PUT.importeOriginal),
    cobroNoInminente: horasHastaCobro !== null && horasHastaCobro > PRUEBA_PUT.horasMinimasAntesCobro,
    horasHastaCobro: horasHastaCobro === null ? null : Math.round(horasHastaCobro * 10) / 10,
    // El token pertenece a un usuario de prueba (tag `test_user` en GET /users/me) y es el
    // cobrador de la suscripción. MP oculta el pagador (payer_email vacío, nickname "@id"),
    // pero una cuenta vendedora de prueba solo puede ser cobrada por compradores de prueba.
    credencialesDePrueba:
      usuarioToken !== null &&
      String(inicial?.collector_id ?? "") === usuarioToken &&
      String(vendedor?.id ?? "") === usuarioToken &&
      Array.isArray(vendedor?.tags) &&
      vendedor.tags.includes("test_user"),
    supabase: supabase
      ? {
          unaFila: supabaseAntes.suscripciones.length === 1,
          esLaEsperada:
            filaLocal?.id === PRUEBA_PUT.suscripcionId &&
            filaLocal?.preapproval_id === PRUEBA_PUT.preapprovalId &&
            filaLocal?.ambiente === "prueba",
          activa: filaLocal?.estado_interno === "activa",
          importeLocal: filaLocal?.importe_ars ?? null,
        }
      : "no_verificado_sin_cliente_supabase",
  };
  informe.verificaciones.previas = v;

  const previasOk =
    v.idRemotoCoincide &&
    v.estadoAuthorized &&
    v.monedaArs &&
    v.importeInicial6552 &&
    v.cobroNoInminente &&
    v.credencialesDePrueba &&
    (v.supabase === "no_verificado_sin_cliente_supabase" ||
      (v.supabase.unaFila && v.supabase.esLaEsperada && v.supabase.activa));
  if (!previasOk) return falla("validacion_previa_fallida");

  // Comparación informativa con BNA (no bloquea: la cotización puede haber cambiado).
  if (obtenerCotizacion) {
    try {
      const cot = await obtenerCotizacion(ahora);
      const importeBna = cot?.ok ? importePlusDecimalOrden(cot.cotizacion.venta) : null;
      informe.verificaciones.bna = cot?.ok
        ? {
            disponible: true,
            importeCalculadoArs: importeBna,
            coincideConImporteOriginal: importeBna !== null && esImporte(inicial, Number(importeBna)),
          }
        : { disponible: false, codigo: cot?.codigo || null };
    } catch (error) {
      informe.verificaciones.bna = { disponible: false, codigo: error?.message || "bna_error" };
    }
  }

  const base = camposInvariantes(inicial);
  const cuerpoTemporal = cuerpoActualizarImportePreapproval(PRUEBA_PUT.importeTemporal);
  const cuerpoRestaurar = cuerpoActualizarImportePreapproval(PRUEBA_PUT.importeOriginal);
  informe.putPrevistos = [
    { orden: 1, ruta: `/preapproval/${PRUEBA_PUT.preapprovalId}`, cuerpo: cuerpoTemporal.body },
    { orden: 2, ruta: `/preapproval/${PRUEBA_PUT.preapprovalId}`, cuerpo: cuerpoRestaurar.body },
  ];

  if (!real) {
    paso("dry_run_sin_put");
    informe.ok = true;
    informe.ejecutado = false;
    return informe;
  }

  // ── 3. Ejecución real con restauración garantizada ─────────────────────────
  const clave = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  async function putImporte(cuerpo, etiqueta) {
    informe.putEjecutados.push({ etiqueta, importe: cuerpo.auto_recurring.transaction_amount });
    await actualizarPreapproval(PRUEBA_PUT.preapprovalId, cuerpo, {
      fetchFn: fetchGuardado,
      idempotencyKey: `prueba-put-${etiqueta}-${clave()}`,
    });
  }

  async function restaurar() {
    let ultimoError = null;
    for (let intento = 1; intento <= PRUEBA_PUT.intentosRestauracion; intento += 1) {
      try {
        await putImporte(cuerpoRestaurar.body, `restaurar-${intento}`);
        const remoto = await obtenerPreapproval(PRUEBA_PUT.preapprovalId, { fetchFn: fetchGuardado });
        if (esImporte(remoto, PRUEBA_PUT.importeOriginal)) return { ok: true, intento, remoto };
        ultimoError = "restauracion_no_confirmada";
      } catch (error) {
        ultimoError = error?.message || "restauracion_error";
      }
      await esperar(pausaMs);
    }
    return { ok: false, codigo: ultimoError };
  }

  let falloOriginal = null;
  let confirmadoTemporal = null;
  try {
    await putImporte(cuerpoTemporal.body, "temporal");
    paso("put_temporal", { importe: PRUEBA_PUT.importeTemporal });
    confirmadoTemporal = await obtenerPreapproval(PRUEBA_PUT.preapprovalId, { fetchFn: fetchGuardado });
    if (!esImporte(confirmadoTemporal, PRUEBA_PUT.importeTemporal)) {
      falloOriginal = "get_no_confirma_importe_temporal";
    } else {
      const cambios = diferencias(base, camposInvariantes(confirmadoTemporal));
      paso("get_confirma_temporal", { importe: importeDe(confirmadoTemporal), camposAlterados: cambios });
      if (cambios.length) falloOriginal = "put_altero_campos_no_permitidos";
    }
  } catch (error) {
    falloOriginal = error?.message || "put_temporal_fallido";
    paso("error_antes_de_restaurar", { codigo: falloOriginal });
  }

  // Restauración (siempre, incluso si el primer PUT "falló": MP pudo haberlo aplicado).
  const restauracion = await restaurar();
  if (!restauracion.ok) {
    informe.restaurado = false;
    return falla("restauracion_fallida", {
      requiereIntervencionManual: true,
      importeEsperado: PRUEBA_PUT.importeOriginal,
      causaOriginal: falloOriginal,
      detalle: restauracion.codigo,
    });
  }
  informe.restaurado = true;
  paso("restaurado", { intento: restauracion.intento, importe: importeDe(restauracion.remoto) });
  if (falloOriginal) return falla(falloOriginal);

  // ── 4. Verificaciones posteriores ──────────────────────────────────────────
  let pagosMpDespues;
  let supabaseDespues;
  try {
    pagosMpDespues = idsPagosMp(
      await buscarAuthorizedPaymentsPreapproval(PRUEBA_PUT.preapprovalId, { fetchFn: fetchLectura }),
    );
    supabaseDespues = await snapshotSupabase(supabase);
  } catch (error) {
    return falla("verificacion_posterior_fallida", { detalle: error?.message || null });
  }
  const camposFinales = diferencias(base, camposInvariantes(restauracion.remoto));
  const filaDespues = supabaseDespues.suscripciones[0] ?? null;
  const posteriores = {
    importeFinal6552: esImporte(restauracion.remoto, PRUEBA_PUT.importeOriginal),
    camposAlterados: camposFinales,
    sinPagoNuevoMp: JSON.stringify(pagosMpAntes) === JSON.stringify(pagosMpDespues),
    sinFilasNuevasSupabase:
      supabaseDespues.suscripciones.length === supabaseAntes.suscripciones.length &&
      supabaseDespues.pagos.length === supabaseAntes.pagos.length,
    plusActivo: filaDespues?.estado_interno === "activa",
    importeLocalFinal: filaDespues?.importe_ars ?? null,
  };
  informe.verificaciones.posteriores = posteriores;
  const posterioresOk =
    posteriores.importeFinal6552 &&
    posteriores.camposAlterados.length === 0 &&
    posteriores.sinPagoNuevoMp &&
    posteriores.sinFilasNuevasSupabase &&
    posteriores.plusActivo;
  if (!posterioresOk) return falla("verificacion_posterior_fallida");

  informe.ok = true;
  informe.codigo = null;
  return informe;
}
