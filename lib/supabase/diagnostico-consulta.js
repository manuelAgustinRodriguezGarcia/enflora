import "server-only";

/** Clasificación segura de fallos de lectura (sin PII). */

export function clasificarErrorConsulta(error, { httpStatus } = {}) {
  if (!error) {
    return { tipo: "ok", reintentable: false };
  }

  const codigo = String(error.code || "").trim();
  const mensaje = String(error.message || error.details || "").toLowerCase();
  const status = Number(httpStatus) || 0;

  if (
    codigo === "PGRST301" ||
    /jwt expired|invalid jwt|no suitable key|not authenticated|session/i.test(mensaje)
  ) {
    return { tipo: "autorizacion", reintentable: true, codigo, httpStatus: status || 401 };
  }

  if (codigo === "42501" || /permission denied|row-level security|rls/i.test(mensaje)) {
    return { tipo: "rls", reintentable: false, codigo, httpStatus: status || 403 };
  }

  if (/fetch failed|network|econnreset|etimedout|socket|failed to fetch|timeout/i.test(mensaje)) {
    return { tipo: "red", reintentable: true, codigo, httpStatus: status };
  }

  if (status >= 500 || codigo.startsWith("5") || /internal server error|service unavailable|gateway/i.test(mensaje)) {
    return { tipo: "servidor", reintentable: true, codigo, httpStatus: status || 503 };
  }

  if (/timeout/i.test(mensaje)) {
    return { tipo: "timeout", reintentable: true, codigo, httpStatus: status };
  }

  return { tipo: "interno", reintentable: false, codigo, httpStatus: status };
}

export function consultaEsReintetable(clasificado) {
  return Boolean(clasificado?.reintentable);
}

export function esperarReintento(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function registrarDiagnosticoCarga(recurso, payload) {
  console.error(
    `[enflora-carga:${recurso}]`,
    JSON.stringify({
      ...payload,
      recurso,
    }),
  );
}
