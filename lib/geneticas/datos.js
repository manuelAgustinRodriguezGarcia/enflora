import {
  BUCKET_IMAGENES_GENETICA,
  detalleDesdeFila,
  esEsquemaAusente,
  esUuid,
  patronBusqueda,
  rutaImagenGenetica,
  rutaImagenGeneticaValida,
  validarBytesImagenGenetica,
} from "@/lib/geneticas/reglas";

const COLUMNAS =
  "id, usuario_id, origen, id_externo, slug, nombre, imagen_ruta, thc_valor, thc_min, thc_max, cbd_valor, cbd_min, cbd_max, sabor, aroma";
const COLUMNAS_CON_URL = `${COLUMNAS}, imagen_url`;

function esColumnaImagenUrlAusente(error) {
  const texto = `${error?.message || ""} ${error?.code || ""} ${error?.details || ""}`;
  return /imagen_url/i.test(texto);
}

async function seleccionar(supabase, aplicar) {
  const amplia = await aplicar(supabase.from("geneticas").select(COLUMNAS_CON_URL));
  if (!esColumnaImagenUrlAusente(amplia.error)) return amplia;
  return aplicar(supabase.from("geneticas").select(COLUMNAS));
}

function detalleConFoto(detalle, ficha) {
  if (!detalle || !ficha?.imagenUrl) return detalle;
  return { ...detalle, imagenUrl: ficha.imagenUrl };
}

function patronExacto(nombre) {
  return String(nombre || "").replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

function camposCannabinoides(ficha) {
  return {
    thc_valor: ficha.thc?.valor ?? null,
    thc_min: ficha.thc?.min ?? null,
    thc_max: ficha.thc?.max ?? null,
    cbd_valor: ficha.cbd?.valor ?? null,
    cbd_min: ficha.cbd?.min ?? null,
    cbd_max: ficha.cbd?.max ?? null,
    sabor: ficha.sabor ?? null,
    aroma: ficha.aroma ?? null,
  };
}

async function firmarDetalle(supabase, fila) {
  let imagenUrl = "";
  if (fila.imagen_ruta && rutaImagenGeneticaValida(fila.imagen_ruta, fila.usuario_id)) {
    const { data, error } = await supabase.storage
      .from(BUCKET_IMAGENES_GENETICA)
      .createSignedUrl(fila.imagen_ruta, 60 * 60);
    if (!error && data?.signedUrl) imagenUrl = data.signedUrl;
  }
  return detalleDesdeFila(fila, imagenUrl);
}

async function buscarPersonalizada(supabase, usuarioId, nombre) {
  const { data, error } = await seleccionar(supabase, (consulta) =>
    consulta
      .eq("usuario_id", usuarioId)
      .eq("origen", "personalizada")
      .ilike("nombre", patronExacto(nombre))
      .maybeSingle()
  );
  if (error) return { error };
  return { fila: data || null };
}

export async function buscarGeneticasPropias(supabase, usuarioId, texto) {
  const { data, error } = await supabase
    .from("geneticas")
    .select("id, origen, nombre, slug, id_externo")
    .eq("usuario_id", usuarioId)
    .ilike("nombre", patronBusqueda(texto))
    .order("nombre", { ascending: true })
    .limit(8);

  if (error) {
    if (esEsquemaAusente(error)) return [];
    return { error: true };
  }
  return (data || []).map((fila) => ({
    id: fila.id,
    origen: fila.origen,
    nombre: fila.nombre,
    slug: fila.slug,
    idExterno: fila.id_externo,
  }));
}

export async function leerDetalle(supabase, usuarioId, id) {
  if (!esUuid(id)) return null;
  const { data, error } = await seleccionar(supabase, (consulta) =>
    consulta.eq("id", id).eq("usuario_id", usuarioId).maybeSingle()
  );
  if (error || !data) return null;
  return firmarDetalle(supabase, data);
}

export async function leerDetallePlanta(supabase, usuarioId, plantaId) {
  if (!esUuid(plantaId)) return null;
  const vinculo = await supabase.from("plantas").select("genetica_id").eq("id", plantaId).maybeSingle();
  if (vinculo.error || !vinculo.data?.genetica_id) return null;
  return leerDetalle(supabase, usuarioId, vinculo.data.genetica_id);
}

async function escribirStrain(supabase, campos, existenteId, usuarioId) {
  const guardar = (fila, columnas) => {
    const consulta = existenteId
      ? supabase.from("geneticas").update(fila).eq("id", existenteId).eq("usuario_id", usuarioId)
      : supabase.from("geneticas").insert(fila);
    return consulta.select(columnas).single();
  };
  const conUrl = { ...campos, imagen_url: campos.imagen_url || null };
  const primero = await guardar(conUrl, COLUMNAS_CON_URL);
  if (!esColumnaImagenUrlAusente(primero.error)) return primero;
  const { imagen_url, ...sinUrl } = conUrl;
  return guardar(sinUrl, COLUMNAS);
}

export async function guardarCopiaStrain(supabase, usuarioId, ficha) {
  const campos = {
    usuario_id: usuarioId,
    origen: "strainapi",
    id_externo: ficha.idExterno,
    slug: ficha.slug,
    nombre: ficha.nombre,
    imagen_ruta: null,
    imagen_url: ficha.imagenUrl || null,
    ...camposCannabinoides(ficha),
  };

  const { data: existente, error: errorBusqueda } = await supabase
    .from("geneticas")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("origen", "strainapi")
    .eq("slug", ficha.slug)
    .maybeSingle();

  if (errorBusqueda) {
    if (esEsquemaAusente(errorBusqueda)) {
      return { error: "Falta aplicar la migración de genéticas en Supabase." };
    }
    return { error: "No se pudo guardar la genética." };
  }

  if (existente?.id) {
    const { data, error } = await escribirStrain(supabase, campos, existente.id, usuarioId);
    if (error || !data) return { error: "No se pudo guardar la genética." };
    return { detalle: detalleConFoto(await firmarDetalle(supabase, data), ficha) };
  }

  const { data, error } = await escribirStrain(supabase, campos, "", usuarioId);
  if (error?.code === "23505") {
    const { data: repetida } = await seleccionar(supabase, (consulta) =>
      consulta.eq("usuario_id", usuarioId).eq("origen", "strainapi").eq("slug", ficha.slug).maybeSingle()
    );
    if (repetida) return { detalle: detalleConFoto(await firmarDetalle(supabase, repetida), ficha) };
  }
  if (error || !data) {
    if (esEsquemaAusente(error)) return { error: "Falta aplicar la migración de genéticas en Supabase." };
    return { error: "No se pudo guardar la genética." };
  }
  return { detalle: detalleConFoto(await firmarDetalle(supabase, data), ficha) };
}

async function quitarImagen(supabase, ruta) {
  if (!ruta) return;
  await supabase.storage.from(BUCKET_IMAGENES_GENETICA).remove([ruta]);
}

export async function crearGeneticaPersonalizada(supabase, usuarioId, datos, bytes) {
  const previa = await buscarPersonalizada(supabase, usuarioId, datos.nombre);
  if (previa.error) {
    if (esEsquemaAusente(previa.error)) {
      return { error: "Falta aplicar la migración de genéticas en Supabase." };
    }
    return { error: "No se pudo guardar la genética." };
  }
  if (previa.fila) {
    return { detalle: await firmarDetalle(supabase, previa.fila), reutilizada: true };
  }

  const id = crypto.randomUUID();
  let ruta = null;
  if (bytes) {
    const validacion = validarBytesImagenGenetica(bytes);
    if (validacion.error) return { error: validacion.error };
    ruta = rutaImagenGenetica(usuarioId, id, validacion.extension);
    const subida = await supabase.storage.from(BUCKET_IMAGENES_GENETICA).upload(ruta, bytes, {
      contentType: validacion.tipo,
      upsert: false,
    });
    if (subida.error) {
      return { error: "No se pudo guardar la imagen. Probá de nuevo o guardá la genética sin foto." };
    }
  }

  const fila = {
    id,
    usuario_id: usuarioId,
    origen: "personalizada",
    id_externo: null,
    slug: null,
    nombre: datos.nombre,
    imagen_ruta: ruta,
    thc_valor: datos.thc,
    thc_min: null,
    thc_max: null,
    cbd_valor: datos.cbd,
    cbd_min: null,
    cbd_max: null,
    sabor: datos.sabor,
    aroma: datos.aroma,
  };

  const { data, error } = await supabase.from("geneticas").insert(fila).select(COLUMNAS).single();
  if (!error && data) {
    return { detalle: await firmarDetalle(supabase, data), reutilizada: false };
  }

  await quitarImagen(supabase, ruta);
  if (error?.code === "23505") {
    const repetida = await buscarPersonalizada(supabase, usuarioId, datos.nombre);
    if (repetida.fila) return { detalle: await firmarDetalle(supabase, repetida.fila), reutilizada: true };
  }
  if (esEsquemaAusente(error)) return { error: "Falta aplicar la migración de genéticas en Supabase." };
  return { error: "No se pudo guardar la genética." };
}
