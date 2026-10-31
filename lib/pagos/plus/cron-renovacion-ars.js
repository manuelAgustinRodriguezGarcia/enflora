import "server-only";

import { leerRecepcionPagos } from "@/lib/pagos/ambiente";
import { obtenerCotizacionBilleteVendedor } from "@/lib/pagos/cotizacion-bna";
import { escala4ADecimal } from "@/lib/pagos/dinero";
import { clientePagos } from "@/lib/pagos/datos";
import { enviarAlertaAdmin } from "@/lib/pagos/plus/alertas-renovacion";
import {
  MAX_INTENTOS_PUT,
  actualizarIncidencia,
  calcularProximoIntento,
  cargarIncidencias,
  cerrarIncidencia,
  claveIncidencia,
  debeNotificar,
  decidirReintento,
  esAbierta,
  marcarVencidas,
  nivelCorrespondiente,
  normalizarFecha,
  registrarFallaLocal,
  reservarIntento,
} from "@/lib/pagos/plus/incidencias-renovacion";
import { obtenerPreapproval } from "@/lib/pagos/plus/preapproval-api";
import {
  HORAS_ANTES_RENOVACION_PUT,
  evaluarActualizacionArsPreRenovacion,
} from "@/lib/pagos/plus/renovacion-ars";
import { sincronizarImportePreapproval } from "@/lib/pagos/plus/suscripcion-servidor";

const LIMITE_LOTE = 25;
/** Errores 429/5xx consecutivos de Mercado Pago tras los cuales se frenan las escrituras. */
const ERRORES_MP_PARA_CORTE = 2;

function datosCotizacion(cotizacion) {
  return {
    cotizacion_valor: cotizacion ? Number.parseFloat(escala4ADecimal(cotizacion.venta)) : null,
    cotizacion_fuente: cotizacion?.fuente || null,
    cotizacion_publicada_en: cotizacion?.publicadaEn || null,
  };
}

/** Defensa en profundidad: en dry-run el fetch real solo puede hacer GET. */
function fetchSoloLectura(fetchFn = fetch) {
  return async (url, init) => {
    const metodo = String(init?.method || "GET").toUpperCase();
    if (metodo !== "GET") throw new Error(`dry_run_metodo_prohibido_${metodo}`);
    return fetchFn(url, init);
  };
}

/**
 * Fetch simulado para PUT + GET de confirmación (nunca toca la red).
 * simulacion: { putOk?: boolean (default true), importeGet?: number }
 */
function fetchSimulado(simulacion, importePut) {
  return async (_url, init) => {
    const metodo = String(init?.method || "GET").toUpperCase();
    if (metodo === "PUT") {
      if (simulacion.putOk === false) {
        return new Response(JSON.stringify({ message: "put_simulado_fallido" }), { status: 500 });
      }
      return new Response(JSON.stringify({ id: "simulado" }), { status: 200 });
    }
    const importe = simulacion.importeGet ?? Number(importePut);
    return new Response(JSON.stringify({ auto_recurring: { transaction_amount: importe } }), {
      status: 200,
    });
  };
}

function esErrorDeCarga(status) {
  return status === 429 || (Number.isInteger(status) && status >= 500);
}

/**
 * Job pre-renovación: PUT importe ARS con cotización BNA en ventana 72 h.
 * La fecha de renovación, el estado y el importe vigente salen de GET /preapproval (MP).
 *
 * Seguridad operativa (PLAN 420):
 * - Cada renovación afectada es UNA incidencia en `plus_cotizacion_auditoria` (se actualiza,
 *   no se duplica) con intentos, error, importes y estado final.
 * - Reintentos acotados: máx. MAX_INTENTOS_PUT con espera creciente; nunca PUT si MP ya
 *   tiene el importe; el intento se reserva de forma atómica (corridas simultáneas).
 * - Si MP responde 429/5xx de forma repetida se frenan las escrituras del resto del lote.
 * - Las alertas son correos administrativos (nunca push a usuarios) y no se repiten por nivel.
 * - Este job NO pausa, cancela ni cambia fechas de cobro.
 *
 * dryRun: solo GET reales; no hay PUT, ni escrituras en Supabase, ni alertas. Devuelve
 * `operaciones` con lo que se ejecutaría. `simulacion` permite simular PUT/GET sin red.
 * `ahora` es el reloj inyectable (tests y simulación de ventana).
 * `notificar` (inyectable) envía el resumen a administración.
 */
export async function ejecutarCronRenovacionImportePlus({
  supabase = clientePagos(),
  env = process.env,
  ahora = new Date(),
  fetchFn,
  dryRun = false,
  simulacion = null,
  candidatas: candidatasInyectadas = null,
  obtenerCotizacion = obtenerCotizacionBilleteVendedor,
  notificar = enviarAlertaAdmin,
} = {}) {
  const lectura = leerRecepcionPagos(env);
  if (!lectura.ok) return { ok: false, codigo: lectura.codigo };
  const ambienteActual = lectura.ambiente;

  if (!dryRun && !supabase) return { ok: false, codigo: "sin_servicio" };

  const fetchLectura = dryRun ? fetchSoloLectura(fetchFn) : fetchFn;
  const cotizacion = await obtenerCotizacion(ahora);
  const evaluada = cotizacion.ok
    ? { ok: true, cotizacion: cotizacion.cotizacion, edadDias: cotizacion.edadDias }
    : cotizacion;

  let candidatas = candidatasInyectadas;
  let loteCompleto = false;
  if (!candidatas) {
    if (!supabase) return { ok: false, codigo: "sin_servicio" };
    const { data, error } = await supabase
      .from("plus_suscripciones")
      .select("id, preapproval_id, estado_interno, proxima_renovacion, importe_ars, ambiente")
      .eq("estado_interno", "activa")
      .eq("ambiente", ambienteActual)
      .not("preapproval_id", "is", null)
      .order("proxima_renovacion", { ascending: true, nullsFirst: true })
      .limit(LIMITE_LOTE);
    if (error) return { ok: false, codigo: "lectura_fallida" };
    candidatas = data || [];
    loteCompleto = candidatas.length >= LIMITE_LOTE;
    if (loteCompleto) console.error("[plus-renovacion] lote_completo_posibles_suscripciones_sin_evaluar");
  }

  const resumen = { evaluadas: 0, puts: 0, omitidas: 0, bloqueadas: 0, fallidas: 0, diferidas: 0 };
  const operaciones = [];
  const eventos = [];
  const tocadas = new Set();

  let porClave = new Map();
  let auditoriaDisponible = true;
  if (!dryRun) {
    const cargada = await cargarIncidencias(supabase, { ambiente: ambienteActual, ahora });
    auditoriaDisponible = cargada.ok;
    porClave = cargada.porClave;
    if (!auditoriaDisponible) {
      console.error("[plus-renovacion] auditoria_no_disponible_sin_limite_de_intentos");
      eventos.push({
        tipo: "sistema",
        nivel: "critico",
        fila: { codigo_error: "auditoria_no_disponible", estado_final: "pendiente" },
        horasHasta: null,
      });
    }
  }
  const persistir = !dryRun && auditoriaDisponible;

  function considerarAlerta(fila, horasHasta, preapprovalId) {
    const nivel = nivelCorrespondiente({
      estadoFinal: fila.estado_final,
      horasHasta,
      evaluaciones: fila.evaluaciones,
    });
    if (!debeNotificar(nivel, fila.alerta_nivel)) return;
    console.error("[plus-renovacion] incidencia", {
      nivel,
      codigo: fila.codigo_error,
      suscripcion: String(fila.suscripcion_id || "").slice(0, 8),
      intentos: fila.intentos,
    });
    eventos.push({ tipo: "incidencia", nivel, fila, horasHasta, preapprovalId, maxIntentos: MAX_INTENTOS_PUT });
  }

  async function resolver(fila, { estadoFinal, detalle, extra, horasHasta, preapprovalId }) {
    if (!fila || !esAbierta(fila)) return;
    const cerrada = await cerrarIncidencia(supabase, fila, { estadoFinal, detalle, extra }, ahora);
    if (cerrada) {
      porClave.set(cerrada.clave_incidencia, cerrada);
      if (fila.alerta_nivel) eventos.push({ tipo: "resuelta", fila: cerrada, horasHasta, preapprovalId });
    }
  }

  async function fallaLocal(suscripcion, { ref, horasHasta, codigo, detalle, extra = {} }) {
    const clave = claveIncidencia(suscripcion.id, ref);
    tocadas.add(clave);
    if (!persistir) return;
    const fila = await registrarFallaLocal(supabase, {
      incidencia: porClave.get(clave),
      base: {
        clave_incidencia: clave,
        suscripcion_id: suscripcion.id,
        ambiente: ambienteActual,
        renovacion_ref: normalizarFecha(ref),
        importe_ars_anterior: suscripcion.importe_ars,
        ...extra,
      },
      ahora,
      codigo,
      detalle,
    });
    if (!fila) return;
    porClave.set(clave, fila);
    considerarAlerta(fila, horasHasta, suscripcion.preapproval_id);
  }

  let erroresMpSeguidos = 0;
  let corteMp = false;

  for (const suscripcion of candidatas) {
    resumen.evaluadas += 1;

    let remoto;
    try {
      remoto = await obtenerPreapproval(suscripcion.preapproval_id, { fetchFn: fetchLectura });
    } catch (error) {
      resumen.fallidas += 1;
      operaciones.push({ suscripcionId: suscripcion.id, accion: "get_mp_fallido", detalle: error?.message });
      const local = suscripcion.proxima_renovacion ? new Date(suscripcion.proxima_renovacion) : null;
      const horasLocal = local && !Number.isNaN(local.getTime()) ? (local.getTime() - ahora.getTime()) / 3600000 : null;
      // Lejos del cobro (según la fecha local) no hay riesgo inmediato: no se registra incidencia.
      if (horasLocal != null && horasLocal > HORAS_ANTES_RENOVACION_PUT) continue;
      await fallaLocal(suscripcion, {
        ref: suscripcion.proxima_renovacion,
        horasHasta: horasLocal,
        codigo: "get_mp_fallido",
        detalle: "get_mp_fallido",
      });
      continue;
    }

    const plan = evaluarActualizacionArsPreRenovacion({
      suscripcion,
      remoto,
      cotizacion: evaluada,
      ahora,
      ambienteActual,
    });
    const meta = {
      suscripcionId: suscripcion.id,
      preapprovalId: suscripcion.preapproval_id,
      estadoMp: remoto?.status ?? null,
      proximaRenovacionMp: remoto?.next_payment_date ?? null,
      importeMp: remoto?.auto_recurring?.transaction_amount ?? null,
    };
    const ref = normalizarFecha(remoto?.next_payment_date);
    const clave = claveIncidencia(suscripcion.id, ref);
    const horasHasta = plan.horasHastaRenovacion ?? null;
    const importeRemoto = meta.importeMp != null ? Number(meta.importeMp) : null;

    if (plan.accion === "omitir") {
      resumen.omitidas += 1;
      operaciones.push({ ...meta, accion: "omitir", motivo: plan.motivo, horasHastaRenovacion: plan.horasHastaRenovacion });
      if (!persistir) continue;
      if (plan.motivo === "importe_ya_vigente") {
        tocadas.add(clave);
        await resolver(porClave.get(clave), {
          estadoFinal: "resuelto",
          detalle: "importe_ya_vigente",
          extra: { importe_remoto_ars: importeRemoto, preapproval_put_ok: true },
          horasHasta,
          preapprovalId: suscripcion.preapproval_id,
        });
      } else if (["mp_no_autorizada", "suscripcion_no_activa", "ambiente_distinto"].includes(plan.motivo)) {
        for (const fila of [...porClave.values()]) {
          if (fila.suscripcion_id !== suscripcion.id) continue;
          tocadas.add(fila.clave_incidencia);
          await resolver(fila, {
            estadoFinal: "descartado",
            detalle: plan.motivo,
            horasHasta,
            preapprovalId: suscripcion.preapproval_id,
          });
        }
      }
      continue;
    }

    if (plan.accion === "bloqueado") {
      resumen.bloqueadas += 1;
      operaciones.push({ ...meta, accion: "bloqueado", codigo: plan.codigo, horasHastaRenovacion: plan.horasHastaRenovacion });
      await fallaLocal(suscripcion, {
        ref,
        horasHasta,
        codigo: plan.codigo || "bloqueado",
        detalle: plan.mensaje || plan.codigo || "bloqueado",
        extra: { importe_remoto_ars: importeRemoto },
      });
      continue;
    }

    const putPrevisto = {
      metodo: "PUT",
      ruta: `/preapproval/${suscripcion.preapproval_id}`,
      cuerpo: { auto_recurring: { transaction_amount: Number(plan.importeDecimal), currency_id: "ARS" } },
    };

    if (dryRun) {
      const operacion = {
        ...meta,
        accion: "put_preapproval",
        dryRun: true,
        importeNuevo: plan.importeDecimal,
        horasHastaRenovacion: plan.horasHastaRenovacion,
        cotizacionVenta: escala4ADecimal(plan.cotizacion.venta),
        putPrevisto,
        ejecutado: false,
      };
      if (simulacion) {
        const sync = await sincronizarImportePreapproval({
          preapprovalId: suscripcion.preapproval_id,
          importeDecimal: plan.importeDecimal,
          fetchFn: fetchSimulado(simulacion, plan.importeDecimal),
          confirmar: true,
        }).catch((error) => ({ ok: false, codigo: error?.message || "put_simulado_fallido" }));
        operacion.simulacion = { ok: sync.ok, codigo: sync.codigo || null, remotoImporte: sync.remotoImporte ?? null };
        if (sync.ok) resumen.puts += 1;
        else resumen.fallidas += 1;
      } else {
        resumen.puts += 1;
      }
      operaciones.push(operacion);
      continue;
    }

    // --- PUT real: reintentos acotados, protección de MP y reserva atómica del intento ---
    tocadas.add(clave);
    const incidencia = persistir ? porClave.get(clave) : null;
    const decision = decidirReintento({ incidencia, ahora });
    if (!decision.permitido) {
      resumen.diferidas += 1;
      operaciones.push({ ...meta, accion: decision.motivo, proximoIntentoEn: decision.proximoIntentoEn ?? null });
      if (incidencia) considerarAlerta(incidencia, horasHasta, suscripcion.preapproval_id);
      continue;
    }

    if (corteMp) {
      resumen.diferidas += 1;
      operaciones.push({ ...meta, accion: "diferido_proteccion_mp" });
      await fallaLocal(suscripcion, {
        ref,
        horasHasta,
        codigo: "mp_proteccion_activada",
        detalle: "escrituras_frenadas_por_errores_mp",
        extra: { importe_remoto_ars: importeRemoto },
      });
      continue;
    }

    const base = {
      clave_incidencia: clave,
      suscripcion_id: suscripcion.id,
      ambiente: ambienteActual,
      renovacion_ref: ref,
      importe_ars_anterior: suscripcion.importe_ars,
      importe_ars_nuevo: plan.importeDecimal,
      importe_remoto_ars: importeRemoto,
      ...datosCotizacion(plan.cotizacion),
    };

    let fila = null;
    if (persistir) {
      const reserva = await reservarIntento(supabase, { incidencia, base, ahora });
      if (!reserva.ok && reserva.motivo === "intento_en_curso") {
        resumen.omitidas += 1;
        operaciones.push({ ...meta, accion: "omitir", motivo: "intento_en_curso_otra_ejecucion" });
        continue;
      }
      if (reserva.ok) {
        fila = reserva.fila;
        porClave.set(clave, fila);
      }
    }

    let sync;
    try {
      sync = await sincronizarImportePreapproval({
        preapprovalId: suscripcion.preapproval_id,
        importeDecimal: plan.importeDecimal,
        fetchFn,
        confirmar: true,
      });
    } catch (error) {
      sync = { ok: false, codigo: error?.message || "put_rechazado", fase: "put" };
    }

    if (!sync.ok) {
      resumen.fallidas += 1;
      operaciones.push({ ...meta, accion: "put_fallido", codigo: sync.codigo, fase: sync.fase ?? null });
      erroresMpSeguidos = esErrorDeCarga(sync.status) ? erroresMpSeguidos + 1 : 0;
      if (sync.status === 429 || erroresMpSeguidos >= ERRORES_MP_PARA_CORTE) corteMp = true;
      if (!fila) continue;
      const intentos = fila.intentos ?? 1;
      const agotado = intentos >= MAX_INTENTOS_PUT;
      const actualizada = await actualizarIncidencia(
        supabase,
        fila,
        {
          estado_final: agotado ? "agotado" : "pendiente",
          codigo_error: sync.codigo || "put_fallido",
          detalle: `${sync.codigo || "put_fallido"}${sync.fase ? ` (fase ${sync.fase})` : ""}${sync.status ? ` http ${sync.status}` : ""}`,
          importe_remoto_ars: Number.isFinite(sync.remotoImporte) ? sync.remotoImporte : importeRemoto,
          preapproval_put_ok: false,
          proximo_intento_en: agotado ? null : calcularProximoIntento({ intentos, ahora, horasHasta }),
        },
        ahora,
      );
      if (actualizada) {
        porClave.set(clave, actualizada);
        considerarAlerta(actualizada, horasHasta, suscripcion.preapproval_id);
      }
      continue;
    }

    erroresMpSeguidos = 0;
    resumen.puts += 1;
    operaciones.push({ ...meta, accion: "put_ok", importeNuevo: plan.importeDecimal });
    await supabase
      .from("plus_suscripciones")
      .update({
        importe_ars: plan.importeDecimal,
        ...datosCotizacion(plan.cotizacion),
        proxima_renovacion: remoto?.next_payment_date || suscripcion.proxima_renovacion,
        actualizado_en: ahora.toISOString(),
      })
      .eq("id", suscripcion.id);

    if (fila) {
      await resolver(fila, {
        estadoFinal: "resuelto",
        detalle: "put_confirmado",
        extra: { importe_remoto_ars: sync.remotoImporte ?? Number(plan.importeDecimal), preapproval_put_ok: true },
        horasHasta,
        preapprovalId: suscripcion.preapproval_id,
      });
    }
  }

  let alertas = { eventos: 0, enviada: false, motivo: "sin_eventos" };
  if (!dryRun) {
    if (persistir) {
      for (const vencida of await marcarVencidas(supabase, { porClave, tocadas, ahora })) {
        eventos.push({ tipo: "vencida", fila: vencida, horasHasta: null });
      }
    }
    if (eventos.length) {
      const envio = await notificar(eventos, { env, ahora });
      alertas = { eventos: eventos.length, enviada: Boolean(envio?.enviada), motivo: envio?.motivo ?? null };
      if (envio?.enviada && persistir) {
        for (const evento of eventos) {
          if (evento.tipo !== "incidencia" || !evento.fila?.id) continue;
          await actualizarIncidencia(
            supabase,
            evento.fila,
            { alerta_nivel: evento.nivel, alertada_en: ahora.toISOString() },
            ahora,
          );
        }
      }
    }
  }

  return {
    ok: true,
    dryRun,
    ambiente: ambienteActual,
    ...resumen,
    cotizacionOk: evaluada.ok,
    cotizacionCodigo: evaluada.ok ? null : evaluada.codigo || null,
    auditoriaDisponible,
    loteCompleto,
    cortePorErroresMp: corteMp,
    alertas,
    operaciones,
  };
}
