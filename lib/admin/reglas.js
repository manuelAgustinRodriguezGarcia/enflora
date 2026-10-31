/**
 * Reglas puras de autorización administrativa. Sin I/O, sin Next ni Supabase: se pueden
 * ejecutar en tests y en scripts. La parte que habla con Supabase Auth vive en nucleo.js.
 *
 * Fuente de verdad inicial: listas de UUID en variables de entorno (sin migraciones).
 *   ADMIN_IDS            autoriza todos los módulos.
 *   ADMIN_IDS_<MÓDULO>   autoriza solo ese módulo (p. ej. ADMIN_IDS_EXPO, ADMIN_IDS_FLORA_IA).
 *
 * Formato: UUID completos separados por coma. Cualquier otra cosa (comillas, punto y coma,
 * espacios internos, saltos de línea, UUID truncados) se IGNORA y no concede acceso (fail-closed);
 * `diagnosticarConfiguracionAdmin` permite avisarlo sin revelar ningún valor.
 */

export const MODULOS_ADMIN = Object.freeze([
  "dashboard",
  "usuarios",
  "planes",
  "flora_ia",
  "almacenamiento",
  "notificaciones",
  "partners",
  "expo",
]);

export const VARIABLE_ADMIN_GLOBAL = "ADMIN_IDS";

export const MOTIVOS_ADMIN = Object.freeze({
  sinSesion: "sin_sesion",
  sesionInvalida: "sesion_invalida",
  anonimo: "anonimo",
  correoSinConfirmar: "correo_sin_confirmar",
  noAutorizado: "no_autorizado",
  moduloInvalido: "modulo_invalido",
  sinCredencial: "sin_credencial",
  moduloIncorrecto: "modulo_incorrecto",
  credencialExpirada: "credencial_expirada",
});

const ESTADO_POR_MOTIVO = Object.freeze({
  [MOTIVOS_ADMIN.sinSesion]: 401,
  [MOTIVOS_ADMIN.sesionInvalida]: 401,
  [MOTIVOS_ADMIN.anonimo]: 403,
  [MOTIVOS_ADMIN.correoSinConfirmar]: 403,
  [MOTIVOS_ADMIN.noAutorizado]: 403,
  [MOTIVOS_ADMIN.moduloInvalido]: 403,
  [MOTIVOS_ADMIN.sinCredencial]: 403,
  [MOTIVOS_ADMIN.moduloIncorrecto]: 403,
  [MOTIVOS_ADMIN.credencialExpirada]: 403,
});

export const VIA_ADMIN = Object.freeze({
  uuid: "uuid",
  respaldo: "respaldo",
});

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUuid(valor) {
  return typeof valor === "string" && UUID.test(valor);
}

export function esModuloAdmin(modulo) {
  return typeof modulo === "string" && MODULOS_ADMIN.includes(modulo);
}

export function variableAdminDeModulo(modulo) {
  if (!esModuloAdmin(modulo)) return null;
  return `${VARIABLE_ADMIN_GLOBAL}_${modulo.toUpperCase()}`;
}

export function estadoHttpDeMotivo(motivo) {
  return ESTADO_POR_MOTIVO[motivo] ?? 403;
}

/**
 * Analiza una lista de UUID de una variable de entorno. Devuelve solo conteos y los UUID válidos
 * (en minúsculas y sin repetir); nunca se debe registrar el contenido de la variable.
 *
 * Una entrada se acepta únicamente si, tras quitar espacios en los extremos, es un UUID completo.
 * Las demás se descartan y se clasifican (una sola categoría por entrada):
 *   comillas, saltoInterno, separador (`;`, `|` o espacios internos), truncado, malformado.
 * Además se cuentan las entradas vacías y las que traían saltos de línea (aunque sean válidas).
 */
export function analizarListaIds(valor) {
  const crudo = typeof valor === "string" ? valor : valor === undefined || valor === null ? "" : String(valor);
  const resultado = {
    definida: crudo.trim() !== "",
    validos: [],
    invalidas: 0,
    duplicados: 0,
    problemas: { comillas: 0, saltosDeLinea: 0, saltoInterno: 0, separador: 0, truncado: 0, malformado: 0, vacias: 0 },
  };
  if (!resultado.definida) return resultado;

  const vistos = new Set();
  for (const bruto of crudo.split(",")) {
    const entrada = bruto.trim();
    if (/[\r\n]/.test(bruto)) resultado.problemas.saltosDeLinea += 1;
    if (!entrada) {
      resultado.problemas.vacias += 1;
      continue;
    }

    const minusculas = entrada.toLowerCase();
    if (UUID.test(minusculas)) {
      if (vistos.has(minusculas)) resultado.duplicados += 1;
      else {
        vistos.add(minusculas);
        resultado.validos.push(minusculas);
      }
      continue;
    }

    resultado.invalidas += 1;
    if (/["'`]/.test(entrada)) resultado.problemas.comillas += 1;
    else if (/[\r\n]/.test(entrada)) resultado.problemas.saltoInterno += 1;
    else if (/[;|\s]/.test(entrada)) resultado.problemas.separador += 1;
    else if (/^[0-9a-f-]+$/i.test(entrada) && entrada.length < 36) resultado.problemas.truncado += 1;
    else resultado.problemas.malformado += 1;
  }
  return resultado;
}

/** UUID válidos, en minúsculas y sin repetir. Las entradas mal formadas se ignoran (fail-closed). */
export function normalizarIds(valor) {
  return analizarListaIds(valor).validos;
}

export function contarEntradasInvalidas(valor) {
  return analizarListaIds(valor).invalidas;
}

function resumenProblemas(analisis) {
  const partes = [];
  const { problemas } = analisis;
  if (analisis.invalidas) partes.push(`${analisis.invalidas} entradas inválidas`);
  if (problemas.comillas) partes.push(`${problemas.comillas} con comillas`);
  if (problemas.saltoInterno) partes.push(`${problemas.saltoInterno} con salto de línea interno`);
  if (problemas.separador) partes.push(`${problemas.separador} con separador incorrecto (usar solo coma)`);
  if (problemas.truncado) partes.push(`${problemas.truncado} truncadas`);
  if (problemas.malformado) partes.push(`${problemas.malformado} mal formadas`);
  if (problemas.saltosDeLinea) partes.push(`${problemas.saltosDeLinea} con saltos de línea`);
  if (problemas.vacias) partes.push(`${problemas.vacias} vacías`);
  if (analisis.definida && analisis.validos.length === 0) partes.push("ningún UUID válido");
  return partes.join(", ");
}

/**
 * Diagnóstico de las variables administrativas definidas. Solo conteos y texto genérico: no incluye
 * UUID ni fragmentos de ellos. `variables` limita el análisis (por defecto, todas).
 */
export function diagnosticarConfiguracionAdmin(env = process.env, variables = null) {
  const nombres = variables ?? [VARIABLE_ADMIN_GLOBAL, ...MODULOS_ADMIN.map(variableAdminDeModulo)];
  const hallazgos = [];
  for (const variable of nombres) {
    const analisis = analizarListaIds(env?.[variable]);
    if (!analisis.definida && !analisis.problemas.vacias) continue;
    const resumen = resumenProblemas(analisis);
    hallazgos.push({
      variable,
      definida: analisis.definida,
      validos: analisis.validos.length,
      invalidas: analisis.invalidas,
      duplicados: analisis.duplicados,
      problemas: { ...analisis.problemas },
      conProblemas: resumen !== "",
      resumen,
    });
  }
  return hallazgos;
}

export function idsAutorizadosParaModulo(modulo, env = process.env) {
  const variable = variableAdminDeModulo(modulo);
  if (!variable) return new Set();
  return new Set([
    ...normalizarIds(env?.[VARIABLE_ADMIN_GLOBAL]),
    ...normalizarIds(env?.[variable]),
  ]);
}

/**
 * Devuelve el motivo por el que la cuenta no puede ser administrativa, o null si la cuenta es
 * válida. Un usuario es válido solo si Auth lo identifica, no es anónimo y confirmó su correo.
 */
export function motivoCuentaNoValida(usuario) {
  if (!usuario || typeof usuario !== "object") return MOTIVOS_ADMIN.sinSesion;
  const id = String(usuario.id || "").trim().toLowerCase();
  if (!UUID.test(id)) return MOTIVOS_ADMIN.sesionInvalida;
  if (usuario.is_anonymous === true) return MOTIVOS_ADMIN.anonimo;
  const confirmado = usuario.email_confirmed_at;
  if (!confirmado || !Number.isFinite(Date.parse(confirmado))) return MOTIVOS_ADMIN.correoSinConfirmar;
  return null;
}

/**
 * Evalúa si `usuario` puede operar en `modulo`. Es una función pura de reglas: la aplicación NO
 * la usa con identidades propias; obtiene la identidad de Supabase Auth en nucleo.js.
 *
 * `respaldo` es un mecanismo anterior opcional, usado durante una transición. Solo se consulta
 * cuando la cuenta ya pasó las validaciones (no anónima, correo confirmado) y debe responder
 * exactamente `true`. Quien lo pasa es responsable de retirarlo.
 */
export function evaluarAdmin(usuario, modulo, { env = process.env, respaldo = null } = {}) {
  if (!esModuloAdmin(modulo)) return { ok: false, motivo: MOTIVOS_ADMIN.moduloInvalido };

  const invalido = motivoCuentaNoValida(usuario);
  if (invalido) return { ok: false, motivo: invalido };

  const id = String(usuario.id).trim().toLowerCase();
  if (idsAutorizadosParaModulo(modulo, env).has(id)) {
    return { ok: true, id, modulo, via: VIA_ADMIN.uuid };
  }

  if (typeof respaldo === "function" && respaldo(usuario) === true) {
    return { ok: true, id, modulo, via: VIA_ADMIN.respaldo };
  }

  return { ok: false, motivo: MOTIVOS_ADMIN.noAutorizado };
}
