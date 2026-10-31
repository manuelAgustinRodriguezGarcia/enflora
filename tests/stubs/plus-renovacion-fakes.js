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
 * Supabase en memoria: plus_suscripciones devuelve las candidatas; plus_cotizacion_auditoria
 * se comporta como la tabla real (índice único de clave_incidencia, update con filtros).
 * fallaAuditoria: toda operación sobre la auditoría devuelve error (migración sin aplicar).
 */
export function supabaseFalso(candidatas = [suscripcion()], { auditoria = [], fallaAuditoria = false } = {}) {
  const escrituras = [];
  const filtros = [];
  const filas = auditoria.map((f, i) => ({ id: `aud-${i}`, ...f }));
  let secuencia = filas.length;

  function ejecutarAuditoria(q) {
    if (fallaAuditoria) return { data: null, error: { code: "42703", message: "columna inexistente" } };
    const coincide = (fila) =>
      q.filtros.every(([tipo, col, val]) => {
        if (tipo === "eq") return fila[col] === val;
        if (tipo === "not") return fila[col] !== null && fila[col] !== undefined;
        if (tipo === "gte") return String(fila[col] ?? "") >= String(val);
        return true;
      });
    if (q.op === "insert") {
      if (q.fila.clave_incidencia && filas.some((f) => f.clave_incidencia === q.fila.clave_incidencia)) {
        return { data: null, error: { code: "23505", message: "duplicado" } };
      }
      const nueva = { id: `aud-${secuencia++}`, alerta_nivel: null, intentos: 0, evaluaciones: 0, ...q.fila };
      filas.push(nueva);
      escrituras.push({ tabla: q.tabla, op: "insert", fila: { ...nueva } });
      return { data: [{ ...nueva }], error: null };
    }
    if (q.op === "update") {
      const afectadas = filas.filter(coincide);
      for (const fila of afectadas) Object.assign(fila, q.fila);
      if (afectadas.length) escrituras.push({ tabla: q.tabla, op: "update", fila: { ...q.fila } });
      return { data: afectadas.map((f) => ({ ...f })), error: null };
    }
    return { data: filas.filter(coincide).map((f) => ({ ...f })), error: null };
  }

  function ejecutarSuscripciones(q) {
    if (q.op === "update") {
      escrituras.push({ tabla: q.tabla, op: "update", fila: q.fila });
      return { data: null, error: null };
    }
    return { data: candidatas, error: null };
  }

  return {
    escrituras,
    filtros,
    auditoria: filas,
    from(tabla) {
      const q = { tabla, op: "select", fila: null, filtros: [] };
      const api = {
        select: () => api,
        order: () => api,
        limit: () => api,
        eq(col, val) {
          filtros.push([col, val]);
          q.filtros.push(["eq", col, val]);
          return api;
        },
        not(col) {
          q.filtros.push(["not", col]);
          return api;
        },
        gte(col, val) {
          q.filtros.push(["gte", col, val]);
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
        then(resolve, reject) {
          const ejecutar = tabla === "plus_cotizacion_auditoria" ? ejecutarAuditoria : ejecutarSuscripciones;
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
