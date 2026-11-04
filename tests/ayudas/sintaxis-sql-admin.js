import assert from "node:assert/strict";

/**
 * Construcciones que PostgreSQL rechaza al crear la función.
 * COALESCE, NULLIF, GREATEST y LEAST son sintaxis del parser.
 * No existen como pg_catalog.coalesce, pg_catalog.nullif, pg_catalog.greatest ni pg_catalog.least.
 * Los alias SQL bigint, integer, int, boolean, smallint, real, decimal, float y serial
 * no son nombres de tipo en pg_catalog. Los nombres reales (int8, int4, bool, float4) sí.
 */
const REGLAS = [
  ["coalesce calificado", /pg_catalog\.coalesce\s*\(/i],
  ["nullif calificado", /pg_catalog\.nullif\s*\(/i],
  ["greatest calificado", /pg_catalog\.greatest\s*\(/i],
  ["least calificado", /pg_catalog\.least\s*\(/i],
  ["cast bigint", /::\s*pg_catalog\.bigint\b/i],
  ["cast integer", /::\s*pg_catalog\.integer\b/i],
  ["cast int", /::\s*pg_catalog\.int\b/i],
  ["cast boolean", /::\s*pg_catalog\.boolean\b/i],
  ["cast smallint", /::\s*pg_catalog\.smallint\b/i],
  ["cast real", /::\s*pg_catalog\.real\b/i],
  ["cast decimal", /::\s*pg_catalog\.decimal\b/i],
  ["cast float", /::\s*pg_catalog\.float\b/i],
  ["cast serial", /::\s*pg_catalog\.(?:big)?serial\b/i],
];

export const MUESTRAS_SQL_INVALIDAS = Object.freeze([
  ["coalesce calificado", "select pg_catalog.coalesce(u.is_anonymous, false);"],
  ["nullif calificado", "select pg_catalog.nullif(p.operacion_mp, '');"],
  ["greatest calificado", "select pg_catalog.greatest(f.pagos_acreditados - 1, 0);"],
  ["least calificado", "select pg_catalog.least(1, 0);"],
  ["cast bigint", "select pg_catalog.round(p.importe_ars * 100)::pg_catalog.bigint;"],
  ["cast integer", "select 1::pg_catalog.integer;"],
  ["cast int", "select 1::pg_catalog.int;"],
  ["cast boolean", "select true::pg_catalog.boolean;"],
  ["cast smallint", "select 1::pg_catalog.smallint;"],
  ["cast real", "select 1::pg_catalog.real;"],
  ["cast decimal", "select 1::pg_catalog.decimal;"],
  ["cast float", "select 1::pg_catalog.float;"],
  ["cast serial", "select 1::pg_catalog.serial;"],
  ["comentario ignorado", "-- pg_catalog.coalesce(true, false)\nselect coalesce(true, false)::bigint;"],
]);

export function cuerpoSql(sql) {
  return sql.replace(/--.*$/gm, "");
}

export function hallazgosSqlAdministrativo(sql) {
  const cuerpo = cuerpoSql(sql);
  return REGLAS.filter(([, regla]) => regla.test(cuerpo)).map(([nombre]) => nombre);
}

export function afirmarSqlAdministrativo(sql, archivo) {
  const cuerpo = cuerpoSql(sql);
  const hallazgos = hallazgosSqlAdministrativo(sql);
  assert.deepEqual(hallazgos, [], `${archivo}: ${hallazgos.join(", ")}`);
  assert.match(cuerpo, /\bcoalesce\s*\(/, `${archivo}: la migración tiene que seguir usando coalesce`);
  assert.match(cuerpo, /::bigint\b/, `${archivo}: los conteos siguen en bigint`);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/);
}
