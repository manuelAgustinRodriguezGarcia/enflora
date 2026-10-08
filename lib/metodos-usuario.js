import { esMetodoBase } from "@/lib/metodos";

const METODOS_ANTERIORES = new Set(["fotoperiodica", "autofloreciente"]);

export async function guardarMetodosPersonalizados(supabase, usuarioId, nombres) {
  const candidatos = [];
  const vistos = new Set();

  for (const nombre of nombres) {
    const limpio = String(nombre || "").trim();
    if (!limpio || esMetodoBase(limpio) || METODOS_ANTERIORES.has(limpio) || vistos.has(limpio)) {
      continue;
    }
    vistos.add(limpio);
    candidatos.push(limpio);
  }

  if (!candidatos.length) return null;

  const { data, error } = await supabase
    .from("metodos_personalizados")
    .select("nombre")
    .eq("usuario_id", usuarioId);

  if (error) return error;

  const ya = new Set((data || []).map((fila) => fila.nombre));
  const faltan = candidatos.filter((nombre) => !ya.has(nombre));
  if (!faltan.length) return null;

  const { error: errorInsert } = await supabase.from("metodos_personalizados").insert(
    faltan.map((nombre) => ({ usuario_id: usuarioId, nombre }))
  );

  if (errorInsert?.code === "23505") return null;
  return errorInsert;
}
