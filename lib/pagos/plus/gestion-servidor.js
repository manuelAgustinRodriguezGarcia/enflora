import "server-only";

import { autorizarCompraPiloto, leerAmbientePagos, normalizarCorreoPago, urlPublica } from "@/lib/pagos/ambiente";
import { consultarPlusActivo } from "@/lib/pagos/plus/leer-plus-activo";
import { ESTADOS_PLUS_INTERNO } from "@/lib/pagos/plus/constantes";
import {
  aplicarPreapprovalRemoto,
} from "@/lib/pagos/plus/aplicar-webhook-suscripcion";
import {
  actualizarPreapproval,
  obtenerPreapproval,
} from "@/lib/pagos/plus/preapproval-api";
import { prepararAltaPlus } from "@/lib/pagos/plus/suscripcion-servidor";
import { sincronizarAuthorizedPaymentsPreapproval } from "@/lib/pagos/plus/sincronizar-pagos";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ESTADOS_ABIERTOS = [
  ESTADOS_PLUS_INTERNO.borrador,
  ESTADOS_PLUS_INTERNO.pendienteCheckout,
  ESTADOS_PLUS_INTERNO.activa,
  ESTADOS_PLUS_INTERNO.pausada,
  ESTADOS_PLUS_INTERNO.pastDue,
];

export async function buscarSuscripcionAbierta(supabase, usuarioId, ambiente) {
  const { data, error } = await supabase
    .from("plus_suscripciones")
    .select("*")
    .eq("usuario_id", usuarioId)
    .eq("ambiente", ambiente)
    .in("estado_interno", ESTADOS_ABIERTOS)
    .order("creada_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { suscripcion: null, error };
  return { suscripcion: data, error: null };
}

/**
 * Retorno MP puede omitir ?suscripcion=. Resuelve por query o una única suscripción abierta del usuario.
 */
export async function resolverSuscripcionIdRetornoPlus({
  supabase,
  usuarioId,
  suscripcionIdParam,
  env = process.env,
}) {
  const param = String(suscripcionIdParam || "").trim();
  const lectura = leerAmbientePagos(env);
  if (!lectura.ok) return { ok: false, codigo: lectura.codigo };

  if (UUID.test(param)) {
    const { data, error } = await supabase
      .from("plus_suscripciones")
      .select("id")
      .eq("id", param)
      .eq("usuario_id", usuarioId)
      .eq("ambiente", lectura.ambiente)
      .maybeSingle();
    if (error) return { ok: false, codigo: "sin_servicio" };
    if (!data?.id) return { ok: false, codigo: "suscripcion_ausente" };
    return { ok: true, suscripcionId: data.id, inferida: false };
  }

  const { data: candidatas, error: errorLista } = await supabase
    .from("plus_suscripciones")
    .select("id, estado_interno, creada_en")
    .eq("usuario_id", usuarioId)
    .eq("ambiente", lectura.ambiente)
    .in("estado_interno", ESTADOS_ABIERTOS)
    .order("creada_en", { ascending: false })
    .limit(5);

  if (errorLista) return { ok: false, codigo: "sin_servicio" };
  if (!candidatas?.length) return { ok: false, codigo: "suscripcion_ausente" };
  if (candidatas.length > 1) {
    return { ok: false, codigo: "retorno_ambiguo", candidatas: candidatas.length };
  }
  return { ok: true, suscripcionId: candidatas[0].id, inferida: true };
}

export async function leerResumenPlusUsuario(supabase, usuarioId, env = process.env) {
  const lectura = leerAmbientePagos(env);
  if (!lectura.ok) return { ok: false, codigo: lectura.codigo };

  const plus = await consultarPlusActivo(supabase, usuarioId, env);
  const { suscripcion } = await buscarSuscripcionAbierta(supabase, usuarioId, lectura.ambiente);

  let ultimoPago = null;
  if (suscripcion?.id) {
    const { data: pagos } = await supabase
      .from("plus_pagos_recurrentes")
      .select(
        "estado_interno, importe_ars, importe_cobrado_ars, periodo_hasta, acreditado_en, creado_en",
      )
      .eq("suscripcion_id", suscripcion.id)
      .order("creado_en", { ascending: false })
      .limit(5);
    ultimoPago = pagos?.[0] || null;
  }

  return {
    ok: true,
    ambiente: lectura.ambiente,
    beneficiosActivos: plus.activo,
    suscripcion,
    ultimoPago,
    dbDisponible: plus.dbDisponible,
  };
}

/**
 * Alta checkout sandbox: evita duplicados por índice único usuario+ambiente en estados abiertos.
 */
export async function iniciarCheckoutPlus({
  supabase,
  usuarioId,
  emailUsuario,
  correoPago,
  continuarPendiente = false,
  env = process.env,
  fetchFn,
}) {
  const lectura = leerAmbientePagos(env);
  if (!lectura.ok) return { ok: false, codigo: lectura.codigo };

  const piloto = autorizarCompraPiloto(usuarioId, env);
  if (!piloto.ok) return { ok: false, codigo: piloto.codigo };

  const plus = await consultarPlusActivo(supabase, usuarioId, env);
  if (plus.activo) return { ok: false, codigo: "plus_ya_activo" };

  // Correo de pago: el ingresado por el usuario; si no se envía, el de login.
  const correoElegido = normalizarCorreoPago(correoPago ?? emailUsuario);
  if (!continuarPendiente && !correoElegido) return { ok: false, codigo: "correo_pago_invalido" };

  const { suscripcion: abierta } = await buscarSuscripcionAbierta(
    supabase,
    usuarioId,
    lectura.ambiente,
  );

  if (abierta?.estado_interno === ESTADOS_PLUS_INTERNO.pendienteCheckout && !continuarPendiente) {
    // Un checkout pendiente pertenece a otro payer_email: no se reutiliza; hay que cancelarlo antes.
    return { ok: false, codigo: "intento_pendiente", suscripcionId: abierta.id };
  }

  if (abierta?.init_point && abierta.estado_interno === ESTADOS_PLUS_INTERNO.pendienteCheckout) {
    return {
      ok: true,
      reutilizada: true,
      suscripcionId: abierta.id,
      initPoint: abierta.init_point,
    };
  }

  if (abierta && abierta.estado_interno !== ESTADOS_PLUS_INTERNO.borrador) {
    if (abierta.estado_interno === ESTADOS_PLUS_INTERNO.activa) {
      return { ok: false, codigo: "suscripcion_en_curso" };
    }
    if (abierta.init_point) {
      return {
        ok: true,
        reutilizada: true,
        suscripcionId: abierta.id,
        initPoint: abierta.init_point,
      };
    }
  }

  const suscripcionId = crypto.randomUUID();
  const base = urlPublica(env).replace(/\/$/, "");
  const backUrl = `${base}/pagos/plus/resultado?suscripcion=${suscripcionId}`;

  const alta = await prepararAltaPlus({
    supabase,
    usuarioId,
    emailUsuario: correoElegido,
    env,
    ejecutarMp: true,
    fetchFn,
    suscripcionId,
    backUrl,
  });

  if (!alta.ok) return alta;
  return {
    ok: true,
    suscripcionId: alta.suscripcionId,
    initPoint: alta.initPoint,
    preapprovalId: alta.preapprovalId,
  };
}

export async function reconciliarSuscripcionPlus({
  supabase,
  suscripcionId,
  usuarioId,
  env = process.env,
  fetchFn,
}) {
  const lectura = leerAmbientePagos(env);
  if (!lectura.ok) return { ok: false, codigo: lectura.codigo };

  const { data: suscripcion, error } = await supabase
    .from("plus_suscripciones")
    .select("*")
    .eq("id", suscripcionId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (error || !suscripcion) return { ok: false, codigo: "suscripcion_ausente" };
  if (suscripcion.ambiente !== lectura.ambiente) return { ok: false, codigo: "ambiente_distinto" };
  if (!suscripcion.preapproval_id) return { ok: true, sincronizado: false, motivo: "sin_preapproval" };

  let remoto;
  try {
    remoto = await obtenerPreapproval(suscripcion.preapproval_id, { fetchFn });
  } catch {
    return { ok: false, codigo: "mp_no_disponible" };
  }

  const syncPre = await aplicarPreapprovalRemoto({
    supabase,
    suscripcion,
    remoto,
    clave: null,
    ambiente: lectura.ambiente,
  });
  if (!syncPre.ok) return syncPre;

  const syncPagos = await sincronizarAuthorizedPaymentsPreapproval({
    supabase,
    suscripcion,
    ambiente: lectura.ambiente,
    fetchFn,
  });
  if (!syncPagos.ok) return syncPagos;

  const plus = await consultarPlusActivo(supabase, usuarioId, env);
  return {
    ok: true,
    sincronizado: true,
    beneficiosActivos: plus.activo,
    pagosSync: syncPagos.pagosSync,
    estadoInterno: syncPre.estadoInterno,
  };
}

export async function cancelarSuscripcionPlus({
  supabase,
  suscripcionId,
  usuarioId,
  soloIntentoPendiente = false,
  env = process.env,
  fetchFn,
}) {
  const lectura = leerAmbientePagos(env);
  if (!lectura.ok) return { ok: false, codigo: lectura.codigo };

  const { data: suscripcion, error } = await supabase
    .from("plus_suscripciones")
    .select("*")
    .eq("id", suscripcionId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (error || !suscripcion) return { ok: false, codigo: "suscripcion_ausente" };
  if (suscripcion.ambiente !== lectura.ambiente) return { ok: false, codigo: "ambiente_distinto" };
  if (!suscripcion.preapproval_id) return { ok: false, codigo: "sin_preapproval" };
  if (suscripcion.estado_interno === ESTADOS_PLUS_INTERNO.cancelada) {
    return { ok: true, yaCancelada: true };
  }

  if (soloIntentoPendiente) {
    // Esta acción solo cierra un checkout sin autorizar. No cancela suscripciones vigentes.
    if (suscripcion.estado_interno !== ESTADOS_PLUS_INTERNO.pendienteCheckout) {
      return { ok: false, codigo: "intento_no_cancelable" };
    }
    const { data: pagos, error: errorPagos } = await supabase
      .from("plus_pagos_recurrentes")
      .select("id")
      .eq("suscripcion_id", suscripcion.id)
      .eq("estado_interno", "acreditado")
      .limit(1);
    if (errorPagos) return { ok: false, codigo: "sin_servicio" };
    if (pagos?.length) return { ok: false, codigo: "intento_no_cancelable" };

    let actual;
    try {
      actual = await obtenerPreapproval(suscripcion.preapproval_id, { fetchFn });
    } catch {
      return { ok: false, codigo: "mp_no_disponible" };
    }
    if (actual?.status !== "pending") {
      await aplicarPreapprovalRemoto({
        supabase,
        suscripcion,
        remoto: actual,
        clave: null,
        ambiente: lectura.ambiente,
      });
      return { ok: false, codigo: "intento_no_cancelable" };
    }
  }

  try {
    await actualizarPreapproval(
      suscripcion.preapproval_id,
      { status: "cancelled" },
      { fetchFn, idempotencyKey: `plus-cancel-${suscripcionId}` },
    );
  } catch {
    return { ok: false, codigo: "mp_cancel_fallido" };
  }

  let remoto;
  try {
    remoto = await obtenerPreapproval(suscripcion.preapproval_id, { fetchFn });
  } catch {
    remoto = { status: "cancelled" };
  }

  const vigenteHastaFin = Boolean(suscripcion.periodo_vigente_hasta);
  const { error: errorUpd } = await supabase
    .from("plus_suscripciones")
    .update({
      estado_mp: remoto.status || "cancelled",
      estado_interno: ESTADOS_PLUS_INTERNO.cancelada,
      cancelada_en: new Date().toISOString(),
      vigente_hasta_fin_periodo: vigenteHastaFin,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", suscripcion.id);

  if (errorUpd) return { ok: false, codigo: "persistencia" };

  return { ok: true, vigenteHastaFinPeriodo: vigenteHastaFin };
}
