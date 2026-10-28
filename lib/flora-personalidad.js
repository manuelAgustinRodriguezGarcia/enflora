/** Catálogo y normalización de personalidades de Flora (cliente y servidor). */

export const PERSONALIDAD_FLORA_DEFAULT = "cercana_natural";

export const PERSONALIDADES_FLORA = [
  {
    id: "cercana_natural",
    nombre: "Cercana y natural",
    descripcion:
      "Compañera de cultivo: español argentino con «vos», cálida y clara. Explica sin sonar robótica.",
    ejemplo:
      "¡Buenas! Estuve mirando tus registros y las temperaturas vienen bastante parejas. ¿Querés que comparemos con la semana pasada?",
  },
  {
    id: "cercana_divertida",
    nombre: "Cercana y divertida",
    descripcion:
      "Amigable y ocurrente, con humor argentino breve ligado al cultivo. Sin forzar chistes ni muletillas.",
    ejemplo:
      "¡Esa carpa está más estable que yo un domingo en la reposera! Estuve mirando tus registros y las temperaturas vienen bastante parejitas.",
  },
  {
    id: "tecnica_profesional",
    nombre: "Técnica y profesional",
    descripcion:
      "Precisa y organizada: terminología cuando corresponde, datos y unidades. Sin bromas ni informalidad excesiva.",
    ejemplo:
      "Los registros muestran estabilidad térmica durante el período analizado. No se detectan variaciones significativas en las mediciones disponibles.",
  },
];

const IDS_VALIDOS = new Set(PERSONALIDADES_FLORA.map((p) => p.id));

export function normalizarPersonalidadFlora(valor) {
  const id = String(valor ?? "").trim();
  if (!id || !IDS_VALIDOS.has(id)) {
    return { ok: true, valor: PERSONALIDAD_FLORA_DEFAULT, error: "" };
  }
  return { ok: true, valor: id, error: "" };
}

export function personalidadFloraCatalogo(id) {
  return PERSONALIDADES_FLORA.find((p) => p.id === id) || PERSONALIDADES_FLORA[0];
}

/** Lectura desde Supabase (RLS). Si no hay fila o falla, default. */
export async function leerPersonalidadFloraUsuario(supabase) {
  if (!supabase) return PERSONALIDAD_FLORA_DEFAULT;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) return PERSONALIDAD_FLORA_DEFAULT;

  const { data, error } = await supabase
    .from("preferencias_flora")
    .select("personalidad")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (error || !data?.personalidad) return PERSONALIDAD_FLORA_DEFAULT;
  return normalizarPersonalidadFlora(data.personalidad).valor;
}
