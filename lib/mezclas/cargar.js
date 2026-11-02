const SELECT_PRODUCTOS = `
  id,
  usuario_id,
  nombre,
  fabricante,
  tipo,
  caracteristicas,
  activo
`;

const SELECT_RECETAS = `
  id,
  usuario_id,
  nombre,
  volumen_agua,
  unidad_volumen,
  ph,
  ec,
  ppm,
  metodo,
  etapa,
  notas,
  activa,
  receta_componentes (
    id,
    producto_id,
    orden,
    cantidad,
    unidad
  )
`;

export function errorDeCatalogoAusente(error) {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return (
    /productos_cultivo|recetas_mezcla|receta_componentes|registro_mezclas/i.test(texto) ||
    ["PGRST200", "PGRST205", "42P01", "PGRST204"].includes(error?.code)
  );
}

function ordenarComponentes(recetas) {
  return (recetas || []).map((receta) => ({
    ...receta,
    componentes: [...(receta.receta_componentes || [])].sort(
      (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
    ),
  }));
}

export async function cargarCatalogoMezclas(supabase) {
  const productos = await supabase
    .from("productos_cultivo")
    .select(SELECT_PRODUCTOS)
    .order("nombre");

  if (productos.error) {
    if (errorDeCatalogoAusente(productos.error)) {
      return { disponible: false, productos: [], recetas: [] };
    }
    return { disponible: false, productos: [], recetas: [], error: true };
  }

  const recetas = await supabase.from("recetas_mezcla").select(SELECT_RECETAS).order("nombre");
  if (recetas.error) {
    if (errorDeCatalogoAusente(recetas.error)) {
      return { disponible: false, productos: [], recetas: [] };
    }
    return { disponible: false, productos: productos.data || [], recetas: [], error: true };
  }

  return {
    disponible: true,
    productos: productos.data || [],
    recetas: ordenarComponentes(recetas.data),
  };
}

export async function cargarRecetaMezcla(supabase, recetaId) {
  const { data, error } = await supabase
    .from("recetas_mezcla")
    .select(SELECT_RECETAS)
    .eq("id", recetaId)
    .maybeSingle();

  if (error) {
    return { disponible: !errorDeCatalogoAusente(error), receta: null, error: true };
  }
  if (!data) return { disponible: true, receta: null, error: false };
  const [receta] = ordenarComponentes([data]);
  return { disponible: true, receta, error: false };
}
