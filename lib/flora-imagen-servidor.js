import "server-only";

import {
  FLORA_CHAT_MAX_BYTES_IMAGEN,
  mimeImagenFloraPermitido,
  esUuidFotoFlora,
} from "@/lib/flora-imagen-chat";
import { BUCKET_FOTOS, rutaFotoValida, rutaPerteneceAUsuario } from "@/lib/fotos";
import { firmarRutas } from "@/lib/fotos-servidor";

const LIMITE_GALERIA_FLORA = 48;

const SELECT_FOTO_CONTEXTO = `
  id,
  ruta,
  ruta_miniatura,
  tipo_mime,
  tamano_bytes,
  descripcion,
  registro:registros (
    id,
    unidad_cultivo_id,
    fecha_evento,
    aplica_a,
    unidad:unidades_cultivo ( id, nombre ),
    registro_plantas (
      planta_id,
      nombre_planta,
      planta:plantas ( id, nombre )
    )
  )
`;

function filasPlantasRegistro(registro) {
  return registro?.registro_plantas || registro?.plantas || [];
}

function nombrePlantaDesdeRegistro(registro) {
  const filas = filasPlantasRegistro(registro);
  if (filas.length === 1) {
    const fila = filas[0];
    const desdePlanta = String(fila?.planta?.nombre || "").trim();
    if (desdePlanta) return desdePlanta;
    return String(fila?.nombre_planta || "").trim();
  }
  if (filas.length > 1) return "Varias plantas";
  return "";
}

export function textoContextoImagenEnflora(fila) {
  const registro = fila?.registro;
  if (!registro) {
    return "El usuario adjuntó una fotografía ya guardada en ENFLORA (sin metadatos de registro).";
  }
  const partes = [
    "El usuario adjuntó una fotografía de su galería privada ENFLORA.",
    registro.fecha_evento ? `Fecha del registro: ${registro.fecha_evento}.` : "",
    registro.unidad?.nombre ? `Unidad: ${registro.unidad.nombre}.` : "",
    nombrePlantaDesdeRegistro(registro) ? `Planta(s): ${nombrePlantaDesdeRegistro(registro)}.` : "",
    registro.aplica_a === "ambiente" ? "Aplica a ambiente de la unidad." : "",
    registro.unidad_cultivo_id
      ? `unidad_cultivo_id (para herramientas): ${registro.unidad_cultivo_id}.`
      : "",
  ];
  const filasPl = filasPlantasRegistro(registro);
  const plantaIdUnica =
    filasPl.length === 1 ? String(filasPl[0]?.planta_id || filasPl[0]?.planta?.id || "") : "";
  if (plantaIdUnica) partes.push(`planta_id (para herramientas): ${plantaIdUnica}.`);
  partes.push(
    "Usá herramientas de cultivo solo si necesitás datos más allá de lo visual. No asumas otra planta distinta a la indicada.",
  );
  return partes.filter(Boolean).join(" ");
}

export function entidadesDesdeFotoEnflora(fila) {
  const registro = fila?.registro;
  if (!registro) return { unidadCultivoId: "", plantaId: "", fotoRegistroId: fila?.id || "" };
  const filasPl = filasPlantasRegistro(registro);
  const plantaId =
    filasPl.length === 1 ? String(filasPl[0]?.planta_id || filasPl[0]?.planta?.id || "") : "";
  return {
    unidadCultivoId: String(registro.unidad_cultivo_id || ""),
    plantaId,
    fotoRegistroId: String(fila?.id || ""),
  };
}

async function bytesDesdeStorage(supabase, ruta, usuarioId) {
  if (!rutaFotoValida(ruta) || !rutaPerteneceAUsuario(ruta, usuarioId)) {
    return { ok: false, error: "La ruta de la foto no es válida.", bytes: null, mimeType: "" };
  }
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS).download(ruta);
  if (error || !data) {
    return { ok: false, error: "No se pudo leer la fotografía.", bytes: null, mimeType: "" };
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.length > FLORA_CHAT_MAX_BYTES_IMAGEN) {
    return {
      ok: false,
      error: "La fotografía supera el tamaño permitido para el análisis.",
      bytes: null,
      mimeType: "",
    };
  }
  return { ok: true, error: "", bytes: buffer, mimeType: "" };
}

export async function resolverImagenParaGemini(supabase, usuarioId, adjunto) {
  if (!adjunto) return { ok: true, partesImagen: null, contexto: null, entidades: null, error: "" };

  if (adjunto.origen === "transitoria") {
    let buffer;
    try {
      buffer = Buffer.from(adjunto.datosBase64, "base64");
    } catch {
      return { ok: false, error: "La imagen no se pudo decodificar.", partesImagen: null };
    }
    if (!buffer.length || buffer.length > FLORA_CHAT_MAX_BYTES_IMAGEN) {
      return { ok: false, error: "La imagen es demasiado pesada.", partesImagen: null };
    }
    if (!mimeImagenFloraPermitido(adjunto.mimeType)) {
      return { ok: false, error: "Formato de imagen no permitido.", partesImagen: null };
    }
    return {
      ok: true,
      error: "",
      partesImagen: {
        mimeType: adjunto.mimeType,
        data: buffer.toString("base64"),
      },
      contexto: null,
      entidades: { unidadCultivoId: "", plantaId: "", fotoRegistroId: "", transitoria: true },
    };
  }

  if (adjunto.origen === "enflora") {
    if (!esUuidFotoFlora(adjunto.fotoId)) {
      return { ok: false, error: "La foto no es válida.", partesImagen: null };
    }
    const { data: fila, error } = await supabase
      .from("registro_fotos")
      .select(SELECT_FOTO_CONTEXTO)
      .eq("id", adjunto.fotoId)
      .maybeSingle();

    if (error || !fila?.ruta) {
      return { ok: false, error: "No encontramos esa fotografía o no tenés acceso.", partesImagen: null };
    }

    const mimeType = String(fila.tipo_mime || "").toLowerCase();
    if (!mimeImagenFloraPermitido(mimeType)) {
      return { ok: false, error: "Formato de imagen no permitido.", partesImagen: null };
    }

    const descarga = await bytesDesdeStorage(supabase, fila.ruta, usuarioId);
    if (!descarga.ok) {
      return { ok: false, error: descarga.error, partesImagen: null };
    }

    return {
      ok: true,
      error: "",
      partesImagen: {
        mimeType,
        data: descarga.bytes.toString("base64"),
      },
      contexto: textoContextoImagenEnflora(fila),
      entidades: entidadesDesdeFotoEnflora(fila),
    };
  }

  return { ok: false, error: "Adjunto no reconocido.", partesImagen: null };
}

export async function listarFotosGaleriaFlora(
  supabase,
  { limite = LIMITE_GALERIA_FLORA, pagina = 0 } = {},
) {
  const limiteSeguro = Math.min(Math.max(1, limite), 100);
  const paginaSegura = Math.max(0, pagina);
  const desde = paginaSegura * limiteSeguro;
  const hasta = desde + limiteSeguro - 1;

  const { data, error, count } = await supabase
    .from("registro_fotos")
    .select(
      `
      id,
      ruta_miniatura,
      orden,
      registro:registros (
        fecha_evento,
        aplica_a,
        unidad:unidades_cultivo ( nombre ),
        registro_plantas ( nombre_planta, planta_id, planta:plantas ( nombre ) )
      )
    `,
      { count: "exact" },
    )
    .order("fecha_creacion", { ascending: false })
    .range(desde, hasta);

  if (error) {
    return {
      ok: false,
      error: "No se pudieron cargar las fotos.",
      fotos: [],
      total: 0,
    };
  }

  const rutas = (data || []).map((f) => f.ruta_miniatura).filter(Boolean);
  const urls = await firmarRutas(supabase, rutas, 600);

  const fotos = (data || []).map((fila) => {
    const registro = fila.registro;
    return {
      id: fila.id,
      url_miniatura: urls.get(fila.ruta_miniatura) || "",
      fecha_evento: registro?.fecha_evento || "",
      aplica_a: registro?.aplica_a || "",
      unidad_nombre: registro?.unidad?.nombre || "",
      planta_etiqueta: nombrePlantaDesdeRegistro(registro),
    };
  });

  return {
    ok: true,
    error: "",
    fotos,
    total: count ?? fotos.length,
    pagina: paginaSegura,
    limite: limiteSeguro,
  };
}

export async function resolverAdjuntosParaGemini(supabase, usuarioId, adjuntos) {
  const lista = Array.isArray(adjuntos) ? adjuntos.filter(Boolean) : [];
  if (lista.length === 0) {
    return { ok: true, error: "", partesImagen: [], contextos: [], entidades: null };
  }

  const partesImagen = [];
  const contextos = [];
  let entidadesAcum = null;

  for (const adjunto of lista) {
    const resuelto = await resolverImagenParaGemini(supabase, usuarioId, adjunto);
    if (!resuelto.ok) {
      return {
        ok: false,
        error: resuelto.error || "No se pudo usar la imagen.",
        partesImagen: [],
        contextos: [],
        entidades: null,
      };
    }
    if (resuelto.partesImagen) partesImagen.push(resuelto.partesImagen);
    if (resuelto.contexto) contextos.push(resuelto.contexto);
    if (resuelto.entidades) {
      entidadesAcum = entidadesAcum || {
        unidadCultivoId: "",
        plantaId: "",
        fotoRegistroId: "",
        transitoria: false,
      };
      if (resuelto.entidades.unidadCultivoId) {
        entidadesAcum.unidadCultivoId = resuelto.entidades.unidadCultivoId;
      }
      if (resuelto.entidades.plantaId) entidadesAcum.plantaId = resuelto.entidades.plantaId;
      if (resuelto.entidades.fotoRegistroId) {
        entidadesAcum.fotoRegistroId = resuelto.entidades.fotoRegistroId;
      }
      if (resuelto.entidades.transitoria) entidadesAcum.transitoria = true;
    }
  }

  return { ok: true, error: "", partesImagen, contextos, entidades: entidadesAcum };
}

export function construirPartesUsuarioGemini(textoUsuario, partesImagen) {
  const lista = Array.isArray(partesImagen)
    ? partesImagen
    : partesImagen?.data
      ? [partesImagen]
      : [];
  const partes = lista.map((item) => ({
    inlineData: {
      mimeType: item.mimeType,
      data: item.data,
    },
  }));
  partes.push({ text: textoUsuario });
  return partes;
}

export async function miniaturaFotoEnfloraSiPropia(supabase, fotoId) {
  if (!esUuidFotoFlora(fotoId)) {
    return { ok: false, url: "", etiqueta: "" };
  }
  const { data: fila, error } = await supabase
    .from("registro_fotos")
    .select(
      `
      id,
      ruta_miniatura,
      registro:registros (
        fecha_evento,
        unidad:unidades_cultivo ( nombre ),
        registro_plantas ( nombre_planta, planta_id, planta:plantas ( nombre ) )
      )
    `,
    )
    .eq("id", fotoId)
    .maybeSingle();

  if (error || !fila?.ruta_miniatura) {
    return { ok: false, url: "", etiqueta: "" };
  }

  const urls = await firmarRutas(supabase, [fila.ruta_miniatura], 600);
  const registro = fila.registro;
  const etiqueta = [registro?.unidad?.nombre, nombrePlantaDesdeRegistro(registro)]
    .filter(Boolean)
    .join(" · ");

  return {
    ok: true,
    url: urls.get(fila.ruta_miniatura) || "",
    etiqueta,
  };
}
