function entrecomillar(nombre) {
  return `«${nombre}»`;
}

function unirNombres(nombres) {
  const unicos = [...new Set(nombres.filter(Boolean))];
  if (unicos.length <= 1) return entrecomillar(unicos[0] || "sin nombre");
  if (unicos.length === 2) return `${entrecomillar(unicos[0])} y ${entrecomillar(unicos[1])}`;
  const ultimo = unicos[unicos.length - 1];
  return `${unicos.slice(0, -1).map(entrecomillar).join(", ")} y ${entrecomillar(ultimo)}`;
}

function vinculoLegible(vinculo) {
  const unidad = vinculo?.unidad || "una unidad";
  const ciclo = vinculo?.ciclo || "un ciclo de licencia";
  return `la unidad ${entrecomillar(unidad)} tiene el ciclo de licencia ${entrecomillar(ciclo)}`;
}

export function textoCiclosQueBloqueanEspacio(nombreEspacio, vinculos) {
  const espacio = nombreEspacio?.trim() || "este espacio";
  const lista = Array.isArray(vinculos) ? vinculos.filter((vinculo) => vinculo?.unidad || vinculo?.ciclo) : [];
  const cierre = "Ese ciclo conserva el pago de la licencia y no se borra junto con el espacio.";

  if (lista.length === 1) {
    return `No se puede eliminar ${espacio} porque ${vinculoLegible(lista[0])}. ${cierre}`;
  }

  if (lista.length > 1) {
    const detalle = lista.map(vinculoLegible).join("; ");
    return `No se puede eliminar ${espacio} porque ${detalle}. Esos ciclos conservan el pago de la licencia y no se borran junto con el espacio.`;
  }

  return `No se puede eliminar ${espacio} porque una de sus unidades tiene un ciclo de licencia. ${cierre}`;
}

export function textoCiclosQueBloqueanUnidad(nombreUnidad, ciclos) {
  const unidad = nombreUnidad?.trim() || "esta unidad";
  const nombres = [...new Set((Array.isArray(ciclos) ? ciclos : []).map((ciclo) => ciclo?.nombre).filter(Boolean))];
  const cierre = "Ese ciclo conserva el pago de la licencia y no se borra junto con la unidad.";

  if (nombres.length === 1) {
    return `No se puede eliminar ${unidad} porque tiene el ciclo de licencia ${entrecomillar(nombres[0])}. ${cierre}`;
  }

  if (nombres.length > 1) {
    return `No se puede eliminar ${unidad} porque tiene los ciclos de licencia ${unirNombres(nombres)}. Esos ciclos conservan el pago de la licencia y no se borran junto con la unidad.`;
  }

  return `No se puede eliminar ${unidad} porque tiene un ciclo de licencia. ${cierre}`;
}

function esCicloDeLicencia(error) {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return /ciclos_cultivo|unidad_ancla/i.test(texto);
}

export function textoErrorBorrado(sujeto, error) {
  const codigo = String(error?.code || "");
  const licencia =
    sujeto === "espacio"
      ? textoCiclosQueBloqueanEspacio("", [])
      : textoCiclosQueBloqueanUnidad("", []);

  if (codigo === "23503" && esCicloDeLicencia(error)) return licencia;
  if (codigo === "23503") {
    return sujeto === "espacio"
      ? "No se puede eliminar este espacio porque hay datos vinculados que lo impiden."
      : "No se puede eliminar esta unidad porque hay datos vinculados que lo impiden.";
  }
  if (codigo === "42501") {
    return sujeto === "espacio"
      ? "No tenés permiso para eliminar este espacio."
      : "No tenés permiso para eliminar esta unidad.";
  }

  switch (sujeto) {
    case "espacio":
      return "No se pudo eliminar el espacio. La conexión falló antes de borrarlo; volvé a intentar.";
    case "unidad":
      return "No se pudo eliminar la unidad. La conexión falló antes de borrarla; volvé a intentar.";
    default: {
      const pendiente = sujeto;
      throw new Error(`Sujeto de borrado no contemplado: ${pendiente}`);
    }
  }
}

export function tablaDeCiclosAusente(error) {
  const texto = `${error?.code || ""} ${error?.message || ""}`;
  return /42P01|PGRST205/i.test(texto);
}

function registrarFallo(origen, error) {
  console.error(origen, error?.code || "", error?.message || "");
}

async function vinculosDeLicencia(supabase, unidades) {
  const ids = unidades.map((unidad) => unidad.id).filter(Boolean);
  if (!ids.length) return { vinculos: [] };

  const { data, error } = await supabase
    .from("ciclos_cultivo")
    .select("nombre, unidad_ancla_id")
    .in("unidad_ancla_id", ids);

  if (error) {
    if (tablaDeCiclosAusente(error)) return { vinculos: [] };
    registrarFallo("ciclos_cultivo", error);
    return { error: "No se pudo comprobar si hay un ciclo de licencia. Volvé a intentar." };
  }

  const nombres = new Map(unidades.map((unidad) => [unidad.id, unidad.nombre]));
  return {
    vinculos: (data || []).map((ciclo) => ({
      ciclo: ciclo.nombre,
      unidad: nombres.get(ciclo.unidad_ancla_id) || "",
    })),
  };
}

export async function bloqueoPorCiclosDeEspacio(supabase, espacioId) {
  const { data: espacio, error: errorEspacio } = await supabase
    .from("espacios")
    .select("id, nombre")
    .eq("id", espacioId)
    .maybeSingle();

  if (errorEspacio) {
    registrarFallo("leer espacio", errorEspacio);
    return { error: "No se pudo leer el espacio. Volvé a intentar." };
  }
  if (!espacio) return { error: "No se encontró el espacio." };

  const { data: unidades, error: errorUnidades } = await supabase
    .from("unidades_cultivo")
    .select("id, nombre")
    .eq("espacio_id", espacioId);

  if (errorUnidades) {
    registrarFallo("leer unidades", errorUnidades);
    return { error: "No se pudieron leer las unidades de este espacio. Volvé a intentar." };
  }

  const consulta = await vinculosDeLicencia(supabase, unidades || []);
  if (consulta.error) return { error: consulta.error };
  if (consulta.vinculos.length) {
    return { error: textoCiclosQueBloqueanEspacio(espacio.nombre, consulta.vinculos) };
  }
  return null;
}

export async function bloqueoPorCiclosDeUnidad(supabase, unidadId, espacioId) {
  const { data: unidad, error } = await supabase
    .from("unidades_cultivo")
    .select("id, nombre")
    .eq("id", unidadId)
    .eq("espacio_id", espacioId)
    .maybeSingle();

  if (error) {
    registrarFallo("leer unidad", error);
    return { error: "No se pudo leer la unidad. Volvé a intentar." };
  }
  if (!unidad) return { error: "No se encontró la unidad." };

  const consulta = await vinculosDeLicencia(supabase, [unidad]);
  if (consulta.error) return { error: consulta.error };
  if (consulta.vinculos.length) {
    return { error: textoCiclosQueBloqueanUnidad(unidad.nombre, consulta.vinculos.map((vinculo) => ({ nombre: vinculo.ciclo }))) };
  }
  return null;
}
