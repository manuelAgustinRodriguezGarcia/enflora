import "server-only";

import { leerRecepcionPagos } from "@/lib/pagos/ambiente";
import { obtenerCotizacionBilleteVendedor } from "@/lib/pagos/cotizacion-bna";
import { escala4ADecimal, mismosImportes } from "@/lib/pagos/dinero";
import { clientePagos } from "@/lib/pagos/datos";
import { enviarAlertaAdmin } from "@/lib/pagos/plus/alertas-renovacion";
import { registrarHeartbeat } from "@/lib/pagos/plus/heartbeat-cron";
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
  reservarAlerta,
  reservarIntento,
  revertirAlerta,
} from "@/lib/pagos/plus/incidencias-renovacion";
import {
  leerSuscripcionesElegibles,
  ordenarPorUrgencia,
  sinDuplicados,
} from "@/lib/pagos/plus/lectura-suscripciones";
import { obtenerPreapproval } from "@/lib/pagos/plus/preapproval-api";
import {
  HORAS_ANTES_RENOVACION_PUT,
  MARGEN_MINIMO_PUT_MIN,
  evaluarActualizacionArsPreRenovacion,
} from "@/lib/pagos/plus/renovacion-ars";
import { sincronizarImportePreapproval } from "@/lib/pagos/plus/suscripcion-servidor";

/** Presupuesto de tiempo por corrida (la ruta declara maxDuration = 60 s). */
export const PRESUPUESTO_MS_DEFECTO = 40000;
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

function eventoSistema(codigo, nivel = "critico") {
  return { tipo: "sistema", nivel, fila: { codigo_error: codigo, estado_final: "pendiente" }, horasHasta: null };
}

/**
 * Job pre-renovación: PUT importe ARS con cotización BNA en ventana 72 h.
 * La fecha de renovación, el estado y el importe vigente salen de GET /preapproval (MP).
 *
 * Garantías (PLAN 420):
 * - Fail-closed: sin el esquema de auditoría (tabla/columnas) NO se hace ningún PUT; la corrida
 *   termina con `auditoria_no_disponible`, alerta por correo (sin depender de la BD) y heartbeat.
 * - No hay PUT sobre renovaciones vencidas ni en el margen previo al cobro, y antes de cada PUT
 *   se vuelve a leer MP: si la fecha o el estado cambiaron se bloquea y se registra incidencia.
 * - Lectura paginada por clave de TODAS las suscripciones elegibles, sin repetir ids, ordenadas
 *   por urgencia y con presupuesto de tiempo; si se agota queda registrado qué faltó.
 * - Reintentos acotados (MAX_INTENTOS_PUT, espera creciente), reserva atómica del intento,
 *   alertas reservadas atómicamente (sin correos duplicados) y heartbeat de cada corrida.
 * - NO pausa, cancela ni cambia fechas de cobro. No hay tolerancia automática de importe.
 *
 * dryRun: solo GET reales; sin PUT, sin escrituras en Supabase ni alertas.
 * `ahora`, `reloj`, `presupuestoMs`, `tamanoPagina`, `notificar` son inyectables (tests).
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
  tamanoPagina,
  presupuestoMs = PRESUPUESTO_MS_DEFECTO,
  reloj = Date.now,
} = {}) {
  const lectura = leerRecepcionPagos(env);
  if (!lectura.ok) return { ok: false, codigo: lectura.codigo };
  const ambienteActual = lectura.ambiente;

  if (!dryRun && !supabase) return { ok: false, codigo: "sin_servicio" };

  const inicio = reloj();
  const eventos = [];
  const persistir = !dryRun;

  async function cerrarCorrida({ resultado, estadoHeartbeat, resumenHeartbeat }) {
    let alertas = { eventos: 0, enviada: false, motivo: "sin_eventos" };
    if (persistir) {
      const aEnviar = [];
      const reservadas = [];
      for (const evento of eventos) {
        if (evento.tipo === "incidencia" && evento.fila?.id) {
          if (!(await reservarAlerta(supabase, evento.fila, evento.nivel, new Date(ahora)))) continue;
          reservadas.push(evento);
        }
        aEnviar.push(evento);
      }
      if (aEnviar.length) {
        const envio = await notificar(aEnviar, { env, ahora });
        alertas = { eventos: aEnviar.length, enviada: Boolean(envio?.enviada), motivo: envio?.motivo ?? null };
        if (!envio?.enviada) {
          for (const evento of reservadas) await revertirAlerta(supabase, evento.fila, evento.nivel);
        }
      }
      await registrarHeartbeat(supabase, {
        ambiente: ambienteActual,
        ahora,
        estado: estadoHeartbeat,
        resumen: resumenHeartbeat,
      });
    }
    return { ...resultado, alertas };
  }

  // --- Fail-closed: sin esquema de auditoría no se hace ningún PUT -------------------------
  let porClave = new Map();
  if (persistir) {
    const cargada = await cargarIncidencias(supabase, { ambiente: ambienteActual, ahora });
    if (!cargada.ok) {
      console.error("[plus-renovacion] auditoria_no_disponible_cron_detenido");
      eventos.push(eventoSistema("auditoria_no_disponible"));
      return cerrarCorrida({
        resultado: { ok: false, codigo: "auditoria_no_disponible", ambiente: ambienteActual, puts: 0 },
        estadoHeartbeat: "fallida",
        resumenHeartbeat: { codigo: "auditoria_no_disponible" },
      });
    }
    porClave = cargada.porClave;
  }

  const fetchLectura = dryRun ? fetchSoloLectura(fetchFn) : fetchFn;
  const cotizacion = await obtenerCotizacion(ahora);
  const evaluada = cotizacion.ok
    ? { ok: true, cotizacion: cotizacion.cotizacion, edadDias: cotizacion.edadDias }
    : cotizacion;

  // --- Lectura paginada de elegibles ---------------------------------------------------------
  let candidatas;
  let infoLectura = { paginas: 0, parcial: false, limiteAlcanzado: false, total: 0 };
  if (candidatasInyectadas) {
    candidatas = sinDuplicados(candidatasInyectadas);
    infoLectura = { ...infoLectura, total: candidatas.length };
  } else {
    if (!supabase) return { ok: false, codigo: "sin_servicio" };
    const leidas = await leerSuscripcionesElegibles(supabase, { ambiente: ambienteActual, tamanoPagina });
    if (leidas.parcial && leidas.paginas === 0) {
      return cerrarCorrida({
        resultado: { ok: false, codigo: "lectura_fallida", ambiente: ambienteActual },
        estadoHeartbeat: "fallida",
        resumenHeartbeat: { codigo: "lectura_fallida" },
      });
    }
    candidatas = ordenarPorUrgencia(leidas.candidatas);
    infoLectura = {
      paginas: leidas.paginas,
      parcial: leidas.parcial,
      limiteAlcanzado: leidas.limiteAlcanzado,
      total: candidatas.length,
    };
    if (leidas.parcial) {
      console.error("[plus-renovacion] lectura_parcial_de_suscripciones");
      eventos.push(eventoSistema("lectura_parcial"));
    }
    if (leidas.limiteAlcanzado) {
      console.error("[plus-renovacion] limite_de_suscripciones_por_corrida");
      eventos.push(eventoSistema("limite_corrida"));
    }
  }

  const resumen = { evaluadas: 0, puts: 0, omitidas: 0, bloqueadas: 0, fallidas: 0, diferidas: 0, errores: 0 };
  const operaciones = [];
  const tocadas = new Set();
  const procesadas = new Set();

  let erroresMpSeguidos = 0;
  let corteMp = false;
  let detenidoPorAuditoria = false;

  function considerarAlerta(fila, horasHasta, preapprovalId) {
    const nivel = nivelCorrespondiente({
      estadoFinal: fila.estado_final,
      horasHasta,
      evaluaciones: fila.evaluaciones,
      codigo: fila.codigo_error,
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

  async function procesarSuscripcion(suscripcion) {
    let remoto;
    try {
      remoto = await obtenerPreapproval(suscripcion.preapproval_id, { fetchFn: fetchLectura });
    } catch (error) {
      resumen.fallidas += 1;
      operaciones.push({ suscripcionId: suscripcion.id, accion: "get_mp_fallido", detalle: error?.message });
      const local = suscripcion.proxima_renovacion ? new Date(suscripcion.proxima_renovacion) : null;
      const horasLocal = local && !Number.isNaN(local.getTime()) ? (local.getTime() - ahora.getTime()) / 3600000 : null;
      // Lejos del cobro (según la fecha local) no hay riesgo inmediato: no se registra incidencia.
      if (horasLocal != null && horasLocal > HORAS_ANTES_RENOVACION_PUT) return;
      await fallaLocal(suscripcion, {
        ref: suscripcion.proxima_renovacion,
        horasHasta: horasLocal,
        codigo: "get_mp_fallido",
        detalle: "get_mp_fallido",
      });
      return;
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
      if (!persistir) return;
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
      return;
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
      return;
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
      return;
    }

    // --- PUT real: reintentos acotados, protección de MP y reserva atómica del intento ---
    tocadas.add(clave);
    const incidencia = porClave.get(clave);
    const decision = decidirReintento({ incidencia, ahora });
    if (!decision.permitido) {
      resumen.diferidas += 1;
      operaciones.push({ ...meta, accion: decision.motivo, proximoIntentoEn: decision.proximoIntentoEn ?? null });
      if (incidencia) considerarAlerta(incidencia, horasHasta, suscripcion.preapproval_id);
      return;
    }

    if (detenidoPorAuditoria) {
      resumen.diferidas += 1;
      operaciones.push({ ...meta, accion: "detenido_por_auditoria" });
      return;
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
      return;
    }

    // Estado remoto actualizado justo antes de escribir: ¿sigue siendo el mismo período?
    let fresco;
    try {
      fresco = await obtenerPreapproval(suscripcion.preapproval_id, { fetchFn });
    } catch {
      resumen.fallidas += 1;
      operaciones.push({ ...meta, accion: "get_mp_fallido", fase: "previo_a_put" });
      await fallaLocal(suscripcion, { ref, horasHasta, codigo: "get_mp_fallido", detalle: "get_previo_a_put_fallido" });
      return;
    }
    const refFresca = normalizarFecha(fresco?.next_payment_date);
    const estadoFresco = String(fresco?.status || "").toLowerCase();
    const msFresco = refFresca ? new Date(refFresca).getTime() - (ahora.getTime() + (reloj() - inicio)) : null;
    let codigoIncierto = null;
    if (estadoFresco !== "authorized") codigoIncierto = "estado_mp_cambio";
    else if (refFresca !== ref) codigoIncierto = "proxima_fecha_cambio";
    else if (msFresco != null && msFresco <= 0) codigoIncierto = "renovacion_vencida";
    else if (msFresco != null && msFresco < MARGEN_MINIMO_PUT_MIN * 60000) codigoIncierto = "cobro_inminente";
    if (codigoIncierto) {
      resumen.bloqueadas += 1;
      operaciones.push({
        ...meta,
        accion: "bloqueado",
        codigo: codigoIncierto,
        proximaRenovacionMpActual: fresco?.next_payment_date ?? null,
        estadoMpActual: fresco?.status ?? null,
      });
      await fallaLocal(suscripcion, {
        ref,
        horasHasta,
        codigo: codigoIncierto,
        detalle: `${codigoIncierto}: ${ref} -> ${refFresca} (${estadoFresco || "sin estado"})`,
        extra: { importe_remoto_ars: importeRemoto },
      });
      return;
    }
    const importeFresco = fresco?.auto_recurring?.transaction_amount;
    if (importeFresco != null && mismosImportes(plan.importeDecimal, importeFresco)) {
      resumen.omitidas += 1;
      operaciones.push({ ...meta, accion: "omitir", motivo: "importe_ya_vigente" });
      await resolver(incidencia, {
        estadoFinal: "resuelto",
        detalle: "importe_ya_vigente",
        extra: { importe_remoto_ars: Number(importeFresco), preapproval_put_ok: true },
        horasHasta,
        preapprovalId: suscripcion.preapproval_id,
      });
      return;
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

    const reserva = await reservarIntento(supabase, { incidencia, base, ahora });
    if (!reserva.ok) {
      if (reserva.motivo === "intento_en_curso") {
        resumen.omitidas += 1;
        operaciones.push({ ...meta, accion: "omitir", motivo: "intento_en_curso_otra_ejecucion" });
        return;
      }
      // La reserva no se pudo persistir: sin protección contra duplicados NO se hace el PUT.
      detenidoPorAuditoria = true;
      resumen.fallidas += 1;
      operaciones.push({ ...meta, accion: "reserva_fallida" });
      console.error("[plus-renovacion] reserva_de_intento_fallida_sin_put");
      eventos.push(eventoSistema("reserva_fallida"));
      return;
    }
    const fila = reserva.fila;
    porClave.set(clave, fila);

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
      return;
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

    await resolver(fila, {
      estadoFinal: "resuelto",
      detalle: "put_confirmado",
      extra: { importe_remoto_ars: sync.remotoImporte ?? Number(plan.importeDecimal), preapproval_put_ok: true },
      horasHasta,
      preapprovalId: suscripcion.preapproval_id,
    });
  }

  let truncada = false;
  let sinProcesar = 0;
  for (let i = 0; i < candidatas.length; i += 1) {
    const suscripcion = candidatas[i];
    if (procesadas.has(suscripcion.id)) continue;
    if (reloj() - inicio > presupuestoMs) {
      truncada = true;
      sinProcesar = candidatas.length - i;
      console.error("[plus-renovacion] corrida_truncada_por_tiempo", { sinProcesar });
      eventos.push(eventoSistema("corrida_truncada"));
      break;
    }
    procesadas.add(suscripcion.id);
    resumen.evaluadas += 1;
    try {
      await procesarSuscripcion(suscripcion);
    } catch (error) {
      resumen.errores += 1;
      operaciones.push({ suscripcionId: suscripcion?.id ?? null, accion: "error_inesperado" });
      console.error("[plus-renovacion] error_inesperado", error instanceof Error ? error.name : "desconocido");
      if (!eventos.some((e) => e.fila?.codigo_error === "error_inesperado")) eventos.push(eventoSistema("error_inesperado", "urgente"));
    }
  }

  if (persistir) {
    // Una corrida truncada no puede dar por vencida una incidencia que simplemente no evaluó.
    const noEvaluadas = new Set(candidatas.filter((c) => !procesadas.has(c.id)).map((c) => c.id));
    for (const fila of porClave.values()) if (noEvaluadas.has(fila.suscripcion_id)) tocadas.add(fila.clave_incidencia);
    if (!infoLectura.parcial && !infoLectura.limiteAlcanzado) {
      for (const vencida of await marcarVencidas(supabase, { porClave, tocadas, ahora })) {
        eventos.push({ tipo: "vencida", fila: vencida, horasHasta: null });
      }
    }
  }

  const advertencias = truncada || infoLectura.parcial || infoLectura.limiteAlcanzado || resumen.errores > 0 || detenidoPorAuditoria;
  const resultado = {
    ok: true,
    dryRun,
    ambiente: ambienteActual,
    ...resumen,
    cotizacionOk: evaluada.ok,
    cotizacionCodigo: evaluada.ok ? null : evaluada.codigo || null,
    lectura: infoLectura,
    truncada,
    sinProcesar,
    detenidoPorAuditoria,
    cortePorErroresMp: corteMp,
    operaciones,
  };
  if (dryRun) return { ...resultado, alertas: { eventos: 0, enviada: false, motivo: "dry_run" } };
  return cerrarCorrida({
    resultado,
    estadoHeartbeat: advertencias ? "parcial" : "ok",
    resumenHeartbeat: {
      evaluadas: resumen.evaluadas,
      puts: resumen.puts,
      bloqueadas: resumen.bloqueadas,
      fallidas: resumen.fallidas,
      errores: resumen.errores,
      truncada,
      sinProcesar,
    },
  });
}
