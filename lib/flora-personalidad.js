/** Catálogo y normalización de personalidades de Flora (cliente y servidor). */

export const PERSONALIDAD_FLORA_DEFAULT = "cercana_natural";

export const PERSONALIDADES_FLORA = [
  {
    id: "cercana_natural",
    nombre: "Flora natural",
    descripcion:
      "Compañera de cultivo, cálida y clara. Explica todo sin sonar robótica.",
    ejemplo:
      "¡Buenas! Estuve mirando tus registros y todo está en orden. ¿Querés que comparemos con la semana pasada?",
  },
  {
    id: "cercana_divertida",
    nombre: "Flora confianzuda",
    descripcion:
      "Flora tal y como ella es: simpática, chistosa y divertida.",
    ejemplo:
      "¡Che muy bien! Esas plantas vienen piola. Estuve mirando tus registros y todo viene bastante parejito.",
  },
  {
    id: "tecnica_profesional",
    nombre: "F.L.O.R.A",
    descripcion:
      "Flora robótica, directa y formal, sin bromas ni confianza excesiva.",
    ejemplo:
      "Reporte: Los registros muestran estabilidad durante el período analizado. No se detectan variaciones significativas en las mediciones disponibles.",
  },
];

/** Ruta en `public/` para el avatar cuadrado de cada personalidad (WebP recomendado). */
export function rutaImagenPersonalidadFlora(id) {
  const normalizado = normalizarPersonalidadFlora(id).valor;
  return `/images/flora/personalidades/${normalizado}.webp`;
}

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
