import {
  BUCKET_IMAGENES_GENETICA,
  detalleDesdeFila,
  esEsquemaAusente,
  esUuid,
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

function patronExacto(nombre) {
  return String(nombre || "").replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
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
