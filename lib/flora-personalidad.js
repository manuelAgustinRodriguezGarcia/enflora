/** Catálogo y normalización de personalidades de Flora (cliente y servidor). */

export const PERSONALIDAD_FLORA_DEFAULT = "cercana_natural";

export const PERSONALIDADES_FLORA = [
  {
    id: "cercana_natural",
    nombre: "Flora natural",
    imagen: "/images/flora-natural.png",
    descripcion:
      "Compañera de cultivo, cálida y clara. Explica todo sin sonar robótica.",
  },
  {
    id: "cercana_divertida",
    nombre: "Flora confianzuda",
    imagen: "/images/flora-confianzuda.png",
    descripcion:
      "Flora tal y como ella es: simpática, chistosa y divertida.",
  },
  {
    id: "tecnica_profesional",
    nombre: "F.L.O.R.A",
    imagen: "/images/F.L.O.R.A.png",
    descripcion:
      "Flora robótica, directa y formal, sin bromas ni confianza excesiva.",
  },
];

/** Ruta en `public/` del avatar de cada personalidad. */
export function rutaImagenPersonalidadFlora(id) {
  const normalizado = normalizarPersonalidadFlora(id).valor;
  const opcion = PERSONALIDADES_FLORA.find((p) => p.id === normalizado);
  return opcion?.imagen || PERSONALIDADES_FLORA[0].imagen;
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
