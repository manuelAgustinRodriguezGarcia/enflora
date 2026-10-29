export const LIMITES_TITULO_FLORA = 120;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sugerirTituloSolucion(pregunta) {
  const limpio = String(pregunta ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!limpio) return "Consulta con Flora";
  const recorte = limpio.length > 72 ? `${limpio.slice(0, 69)}…` : limpio;
  return recorte.charAt(0).toUpperCase() + recorte.slice(1);
}

export function validarTituloSolucion(titulo) {
  const s = String(titulo ?? "").trim();
  if (!s) return { ok: false, error: "El título no puede estar vacío.", valor: "" };
  if (s.length > LIMITES_TITULO_FLORA) {
    return { ok: false, error: "El título es demasiado largo.", valor: "" };
  }
  return { ok: true, error: "", valor: s };
}

export function uuidSolucionOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") {
    return { ok: true, valor: null };
  }
  const s = String(valor).trim();
  if (!UUID_RE.test(s)) return { ok: false, error: `${campo} no es válido.` };
  return { ok: true, valor: s };
}

export { UUID_RE as UUID_FLORA_BIBLIOTECA_RE };
