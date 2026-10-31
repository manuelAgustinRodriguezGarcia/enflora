import { textoArAEscala4 } from "../../lib/pagos/dinero.js";

export const SUB_ID = "2d239f9f-2986-4c25-86ad-c31904dec8a5";
export const PRE_ID = "d4039c1610894346925cef3997470afc";
export const PROXIMA = "2026-11-30T19:00:55.000-04:00"; // = 2026-11-30T23:00:55Z
export const AHORA_EN_VENTANA = new Date("2026-11-28T15:00:00Z"); // 56 h antes del cobro
export const AHORA_FUERA = new Date("2026-11-20T15:00:00Z");

export const env = {
  NODE_ENV: "development",
  MERCADOPAGO_ENV: "prueba",
  MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
  PAYMENTS_LIVE_ENABLED: "",
};

export function cotizacionBna(valorTexto, publicadaEn = AHORA_EN_VENTANA.toISOString()) {
  return async () => ({
    ok: true,
    edadDias: 0.1,
    cotizacion: {
      venta: textoArAEscala4(valorTexto),
      tipo: "billete_vendedor",
      punta: "vendedor",
      publicadaEn,
      fuente: "Banco Nación",
    },
  });
}

export function suscripcion(extra = {}) {
  return {
    id: SUB_ID,
    preapproval_id: PRE_ID,
    estado_interno: "activa",
    ambiente: "prueba",
    importe_ars: "6552.00",
    proxima_renovacion: null,
    ...extra,
  };
}

/**
 * Mercado Pago falso con estado mutable.
 * putFalla: true (siempre) o N (fallan los próximos N PUT). putStatus: código HTTP del fallo.
 * getFalla: todos los GET fallan. getConfirmacionFalla: falla el primer GET posterior a un PUT.
 */
export function mpFalso({
  importe = 6552,
  status = "authorized",
  next = PROXIMA,
  putFalla = false,
  putStatus = 500,
  putIgnorado = false,
  getFalla = false,
  getConfirmacionFalla = false,
  cambioFecha = null, // { trasGets, next }: MP avanza next_payment_date después de N GET
} = {}) {
  const estado = { importe, status, next, puts: [], gets: 0, putsIntentados: 0 };
  let fallasRestantes = putFalla === true ? Infinity : Number(putFalla) || 0;
  let confirmacionPendiente = false;
  let fallaConfirmacion = getConfirmacionFalla;
  const fetchFn = async (_url, init) => {
    await Promise.resolve();
    const metodo = init?.method || "GET";
    if (metodo === "PUT") {
      estado.putsIntentados += 1;
      if (fallasRestantes > 0) {
        fallasRestantes -= 1;
        return new Response(JSON.stringify({ message: "boom" }), { status: putStatus });
      }
      estado.puts.push(JSON.parse(init.body));
      if (!putIgnorado) estado.importe = JSON.parse(init.body).auto_recurring.transaction_amount;
      confirmacionPendiente = fallaConfirmacion;
      fallaConfirmacion = false;
      return new Response(JSON.stringify({ id: PRE_ID }), { status: 200 });
    }
    estado.gets += 1;
    if (cambioFecha && estado.gets > cambioFecha.trasGets) estado.next = cambioFecha.next;
    if (getFalla || confirmacionPendiente) {
      confirmacionPendiente = false;
      return new Response(JSON.stringify({ message: "get_caido" }), { status: 503 });
    }
    return new Response(
      JSON.stringify({
        id: PRE_ID,
        status: estado.status,
        next_payment_date: estado.next,
        auto_recurring: { transaction_amount: estado.importe },
      }),
      { status: 200 },
    );
  };
  return { estado, fetchFn };
}

/**
 * Mercado Pago falso con una suscripción por preapproval_id (para lotes grandes).
 * Cuenta GET y PUT por id; cada PUT aplica el importe de inmediato.
 */
export function mpMultiple(ids, { importe = 6000, next = PROXIMA } = {}) {
  const porId = new Map(ids.map((id) => [id, { importe, putsAplicados: 0, gets: 0 }]));
  const fetchFn = async (url, init) => {
    await Promise.resolve();
    const id = decodeURIComponent(String(url).split("/preapproval/")[1]);
    const s = porId.get(id);
    if (!s) return new Response(JSON.stringify({ message: "no_encontrada" }), { status: 404 });
    if ((init?.method || "GET") === "PUT") {
      s.putsAplicados += 1;
      s.importe = JSON.parse(init.body).auto_recurring.transaction_amount;
      return new Response(JSON.stringify({ id }), { status: 200 });
    }
    s.gets += 1;
    return new Response(
      JSON.stringify({ id, status: "authorized", next_payment_date: next, auto_recurring: { transaction_amount: s.importe } }),
      { status: 200 },
    );
  };
  return { porId, fetchFn, totalPuts: () => [...porId.values()].reduce((n, s) => n + s.putsAplicados, 0) };
}

/**
 * Supabase en memoria (sin red).
 * - plus_suscripciones: filtra por eq/not/gt, ordena por id y respeta limit (paginación real).
 * - plus_cotizacion_auditoria: índice único de clave_incidencia, update con filtros, select de columnas.
 * - plus_cron_heartbeat: upsert por job.
 * Opciones de fallo: fallaAuditoria (todo), esquemaAuditoria (columnas existentes: pedir otra falla),
 * fallaInsertAuditoria, fallaDesdePagina (N: la consulta N de suscripciones y siguientes fallan),
 * updateSuscripcionLanza (id: el update de esa suscripción lanza una excepción).
 */
export function supabaseFalso(
  candidatas = [suscripcion()],
  {
    auditoria = [],
    fallaAuditoria = false,
    esquemaAuditoria = null,
    fallaInsertAuditoria = false,
    fallaDesdePagina = null,
    updateSuscripcionLanza = null,
  } = {},
) {
  const escrituras = [];
  const filtros = [];
  const filas = auditoria.map((f, i) => ({ id: `aud-${i}`, ...f }));
  const heartbeats = new Map();
  let secuencia = filas.length;
  let consultasSuscripciones = 0;

  const cumple = (fila, filtrosQ) =>
    filtrosQ.every(([tipo, col, val]) => {
      if (tipo === "eq") return fila[col] === val;
      if (tipo === "is") return (fila[col] ?? null) === val;
      if (tipo === "in") return val.includes(fila[col]);
      if (tipo === "not") return fila[col] !== null && fila[col] !== undefined;
      if (tipo === "gte") return String(fila[col] ?? "") >= String(val);
      if (tipo === "gt") return String(fila[col] ?? "") > String(val);
      return true;
    });

  function ejecutarAuditoria(q) {
    if (fallaAuditoria) return { data: null, error: { code: "42P01", message: "tabla inexistente" } };
    if (q.op === "insert") {
      if (fallaInsertAuditoria) return { data: null, error: { code: "XX000", message: "insert caído" } };
      if (q.fila.clave_incidencia && filas.some((f) => f.clave_incidencia === q.fila.clave_incidencia)) {
        return { data: null, error: { code: "23505", message: "duplicado" } };
      }
      const nueva = { id: `aud-${secuencia++}`, alerta_nivel: null, intentos: 0, evaluaciones: 0, ...q.fila };
      filas.push(nueva);
      escrituras.push({ tabla: q.tabla, op: "insert", fila: { ...nueva } });
      return { data: [{ ...nueva }], error: null };
    }
    if (q.op === "update") {
      const afectadas = filas.filter((f) => cumple(f, q.filtros));
      for (const fila of afectadas) Object.assign(fila, q.fila);
      if (afectadas.length) escrituras.push({ tabla: q.tabla, op: "update", fila: { ...q.fila } });
      return { data: afectadas.map((f) => ({ ...f })), error: null };
    }
    if (esquemaAuditoria && q.columnas && q.columnas !== "*") {
      const faltan = q.columnas.split(",").map((c) => c.trim()).filter((c) => !esquemaAuditoria.includes(c));
      if (faltan.length) return { data: null, error: { code: "42703", message: `columna inexistente: ${faltan[0]}` } };
    }
    return { data: filas.filter((f) => cumple(f, q.filtros)).map((f) => ({ ...f })), error: null };
  }

  function ejecutarSuscripciones(q) {
    if (q.op === "update") {
      const id = q.filtros.find(([t, c]) => t === "eq" && c === "id")?.[2];
      if (updateSuscripcionLanza && id === updateSuscripcionLanza) throw new Error("update_caido");
      escrituras.push({ tabla: q.tabla, op: "update", fila: q.fila });
      return { data: null, error: null };
    }
    consultasSuscripciones += 1;
    if (fallaDesdePagina && consultasSuscripciones >= fallaDesdePagina) {
      return { data: null, error: { code: "XX000", message: "página caída" } };
    }
    let data = candidatas.filter((c) => cumple(c, q.filtros)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (q.limite) data = data.slice(0, q.limite);
    return { data, error: null };
  }

  function ejecutarHeartbeat(q) {
    if (q.op === "upsert") {
      heartbeats.set(q.fila.job, { ...(heartbeats.get(q.fila.job) || {}), ...q.fila });
      return { data: null, error: null };
    }
    const job = q.filtros.find(([t, c]) => t === "eq" && c === "job")?.[2];
    return { data: heartbeats.get(job) ?? null, error: null };
  }

  return {
    escrituras,
    filtros,
    auditoria: filas,
    heartbeats,
    consultasSuscripciones: () => consultasSuscripciones,
    from(tabla) {
      const q = { tabla, op: "select", fila: null, filtros: [], limite: null, columnas: null };
      const agregar = (tipo) => (col, val) => {
        q.filtros.push([tipo, col, val]);
        return api;
      };
      const api = {
        select(columnas) {
          if (q.op === "select") q.columnas = columnas ?? "*";
          return api;
        },
        order: () => api,
        limit(n) {
          q.limite = n;
          return api;
        },
        eq(col, val) {
          filtros.push([col, val]);
          q.filtros.push(["eq", col, val]);
          return api;
        },
        is: agregar("is"),
        in: agregar("in"),
        gte: agregar("gte"),
        gt: agregar("gt"),
        not(col) {
          q.filtros.push(["not", col]);
          return api;
        },
        insert(fila) {
          q.op = "insert";
          q.fila = fila;
          return api;
        },
        update(fila) {
          q.op = "update";
          q.fila = fila;
          return api;
        },
        upsert(fila) {
          q.op = "upsert";
          q.fila = fila;
          return api;
        },
        maybeSingle: () => api,
        then(resolve, reject) {
          const ejecutar =
            tabla === "plus_cotizacion_auditoria"
              ? ejecutarAuditoria
              : tabla === "plus_cron_heartbeat"
                ? ejecutarHeartbeat
                : ejecutarSuscripciones;
          return Promise.resolve().then(() => ejecutar(q)).then(resolve, reject);
        },
      };
      return api;
    },
  };
}

export function supabasePROHIBIDO() {
  return {
    from() {
      throw new Error("dry-run no debe tocar Supabase");
    },
  };
}

/** Notificador falso: registra los lotes de eventos; `enviada` configurable. */
export function notificadorFalso({ enviada = true } = {}) {
  const lotes = [];
  const notificar = async (eventos) => {
    lotes.push(eventos);
    return enviada ? { enviada: true } : { enviada: false, motivo: "envio_fallido" };
  };
  return { lotes, notificar };
}
