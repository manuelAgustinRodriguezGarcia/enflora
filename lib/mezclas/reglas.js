import { esEtapa } from "@/lib/etapas";
import { esMetodoBase } from "@/lib/metodos";
import {
  LIMITE_CARACTERISTICAS,
  LIMITE_COMPONENTES,
  LIMITE_FABRICANTE,
  LIMITE_METODO,
  LIMITE_NOMBRE,
  LIMITE_NOTAS,
  TIPOS_PRODUCTO,
  UNIDADES_COMPONENTE,
  UNIDADES_VOLUMEN,
  VOLUMEN_MAXIMO,
  cantidadesEquivalentes,
  esUnidadPorLitro,
  litrosDe,
  parsearCantidad,
  redondearCantidad,
} from "@/lib/mezclas/calculo";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MENSAJES_MEZCLA = [
  "No hay sesión.",
  "La mezcla no es válida.",
  "La mezcla requiere un riego o una fertilización.",
  "Una medición ambiental no lleva mezcla.",
  "No se puede usar un producto de otro usuario.",
  "No se puede usar una receta de otro usuario.",
  "El volumen de la mezcla no es válido.",
  "Hay un componente de mezcla que no es válido.",
  "La cantidad del componente no es válida.",
  "La unidad del componente no es válida.",
  "Hay un componente duplicado.",
  "El pH de la mezcla no es válido.",
  "La EC de la mezcla no es válida.",
  "Los PPM de la mezcla no son válidos.",
  "El pH de la mezcla no coincide con el parámetro.",
  "La EC de la mezcla no coincide con el parámetro.",
  "Los PPM de la mezcla no coinciden con el parámetro.",
  "El nombre del producto es obligatorio.",
  "El tipo de producto no es válido.",
  "El fabricante del producto es demasiado largo.",
  "Las características del producto son demasiado largas.",
  "No se encontró el producto.",
  "No se encontró la receta.",
  "El nombre de la receta es obligatorio.",
  "La receta necesita un volumen de agua.",
  "La receta necesita al menos un componente.",
  "Las observaciones de la receta son demasiado largas.",
  "Falta aplicar supabase/mezclas.sql en Supabase.",
];

const ESQUEMA_AUSENTE =
  /could not find the function|schema cache|productos_cultivo|recetas_mezcla|receta_componentes|registro_mezclas|p_mezcla/i;

export const MEDICIONES_MEZCLA = [
  {
    campo: "ph",
    clave: "nativa:ph",
    claveNativa: "ph",
    nombre: "pH",
    unidad: null,
    decimales: 2,
    min: 0,
    max: 14,
    error: "El pH de la mezcla no es válido.",
    conflicto: "El pH de la mezcla no coincide con el parámetro.",
  },
  {
    campo: "ec",
    clave: "nativa:ec",
    claveNativa: "ec",
    nombre: "EC",
    unidad: null,
    decimales: 3,
    min: 0,
    max: 100,
    error: "La EC de la mezcla no es válida.",
    conflicto: "La EC de la mezcla no coincide con el parámetro.",
  },
  {
    campo: "ppm",
    clave: "nativa:ppm",
    claveNativa: "ppm",
    nombre: "PPM",
    unidad: "ppm",
    decimales: 2,
    min: 0,
    max: 100000,
    error: "Los PPM de la mezcla no son válidos.",
    conflicto: "Los PPM de la mezcla no coinciden con el parámetro.",
  },
];

export function mensajeErrorMezcla(error) {
  const texto = error?.message || "";
  if (ESQUEMA_AUSENTE.test(texto)) {
    return "Falta aplicar supabase/mezclas.sql en Supabase.";
  }
  return MENSAJES_MEZCLA.find((mensaje) => texto.includes(mensaje)) || "";
}

export function esUuidMezcla(valor) {
  return UUID.test(String(valor || "").trim());
}

export function mezclaVacia() {
  return {
    incluir: false,
    recetaId: "",
    volumen: "",
    unidadVolumen: "L",
    componentes: [],
    origen: null,
    ph: "",
    ec: "",
    ppm: "",
    metodo: "",
    etapa: "",
  };
}

export function accionesTienenMezcla(acciones) {
  return (acciones || []).some(
    (item) =>
      item?.origen === "nativa" &&
      (item.clave_nativa === "riego" || item.clave_nativa === "fertilizacion")
  );
}

export function medicionNormalizada(valor, decimales, min, max) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = parsearCantidad(valor);
  if (numero === null) return undefined;
  const redondo = redondearCantidad(numero, decimales);
  if (redondo === null || redondo < min || (max !== null && redondo > max)) return undefined;
  return redondo;
}

function limpiarTexto(valor, maximo) {
  const texto = String(valor || "").trim();
  if (!texto) return { valor: null };
  if (texto.length > maximo) return { error: true };
  return { valor: texto };
}

export function validarProducto(entrada) {
  const nombre = String(entrada?.nombre || "").trim();
  if (!nombre || nombre.length > LIMITE_NOMBRE) {
    return { error: "El nombre del producto es obligatorio." };
  }
  const tipo = String(entrada?.tipo || "").trim();
  if (!TIPOS_PRODUCTO.some((item) => item.valor === tipo)) {
    return { error: "El tipo de producto no es válido." };
  }
  const fabricante = limpiarTexto(entrada?.fabricante, LIMITE_FABRICANTE);
  if (fabricante.error) return { error: "El fabricante del producto es demasiado largo." };
  const caracteristicas = limpiarTexto(entrada?.caracteristicas, LIMITE_CARACTERISTICAS);
  if (caracteristicas.error) {
    return { error: "Las características del producto son demasiado largas." };
  }
  return {
    error: "",
    producto: {
      nombre,
      fabricante: fabricante.valor,
      tipo,
      caracteristicas: caracteristicas.valor,
    },
  };
}

export function nombreCopia(nombre) {
  const base = `Copia de ${String(nombre || "").trim()}`.trim();
  return base.length <= LIMITE_NOMBRE ? base : base.slice(0, LIMITE_NOMBRE).trim();
}

export function clonarReceta(receta, nuevoId = () => crypto.randomUUID()) {
  const id = nuevoId();
  return {
    ...receta,
    id,
    nombre: nombreCopia(receta?.nombre),
    activa: true,
    componentes: (receta?.componentes || []).map((item) => ({
      ...item,
      id: nuevoId(),
      receta_id: id,
    })),
  };
}

export function referenciasDeOtroUsuario({ usuarioId, receta, productos }) {
  if (!usuarioId) return "No hay sesión.";
  if (receta?.usuario_id && receta.usuario_id !== usuarioId) {
    return "No se puede usar una receta de otro usuario.";
  }
  for (const producto of productos || []) {
    if (!producto?.usuario_id || producto.usuario_id !== usuarioId) {
      return "No se puede usar un producto de otro usuario.";
    }
  }
  return "";
}

function componentesNormalizados(lista, { exigirProducto }) {
  if (!Array.isArray(lista)) return { error: "Hay un componente de mezcla que no es válido." };
  if (lista.length > LIMITE_COMPONENTES) {
    return { error: "Hay un componente de mezcla que no es válido." };
  }
  const vistos = new Set();
  const componentes = [];
  lista.forEach((item, indice) => {
    if (componentes.error) return;
    const productoId = String(item?.productoId || item?.producto_id || "").trim();
    if (exigirProducto && !esUuidMezcla(productoId)) {
      componentes.error = "Hay un componente de mezcla que no es válido.";
      return;
    }
    if (productoId && vistos.has(productoId)) {
      componentes.error = "Hay un componente duplicado.";
      return;
    }
    if (productoId) vistos.add(productoId);
    const unidad = String(item?.unidad || "").trim();
    if (!UNIDADES_COMPONENTE.includes(unidad)) {
      componentes.error = "La unidad del componente no es válida.";
      return;
    }
    const cantidad = parsearCantidad(item?.cantidad);
    const redonda = cantidad === null ? null : redondearCantidad(cantidad);
    if (redonda === null || redonda <= 0 || redonda > VOLUMEN_MAXIMO) {
      componentes.error = "La cantidad del componente no es válida.";
      return;
    }
    componentes.push({
      productoId,
      orden: indice,
      cantidad: redonda,
      unidad,
    });
  });
  if (componentes.error) return { error: componentes.error };
  return { componentes };
}

export function validarReceta(entrada, productosPropios = []) {
  const nombre = String(entrada?.nombre || "").trim();
  if (!nombre || nombre.length > LIMITE_NOMBRE) {
    return { error: "El nombre de la receta es obligatorio." };
  }
  const volumen = parsearCantidad(entrada?.volumenAgua ?? entrada?.volumen_agua ?? entrada?.volumen);
  const unidad = String(entrada?.unidadVolumen || entrada?.unidad_volumen || "").trim();
  if (
    volumen === null ||
    volumen <= 0 ||
    volumen > VOLUMEN_MAXIMO ||
    !UNIDADES_VOLUMEN.includes(unidad)
  ) {
    return { error: "La receta necesita un volumen de agua." };
  }
  const componentesOk = componentesNormalizados(entrada?.componentes, { exigirProducto: true });
  if (componentesOk.error) return { error: componentesOk.error };
  if (componentesOk.componentes.length < 1) {
    return { error: "La receta necesita al menos un componente." };
  }
  const ajenos = referenciasDeOtroUsuario({
    usuarioId: entrada?.usuarioId || productosPropios[0]?.usuario_id || "local",
    productos: componentesOk.componentes.map((item) => {
      const propio = productosPropios.find((producto) => producto.id === item.productoId);
      return propio || { id: item.productoId, usuario_id: null };
    }),
  });
  if (ajenos && entrada?.usuarioId) return { error: ajenos };
  if (productosPropios.length > 0) {
    for (const item of componentesOk.componentes) {
      if (!productosPropios.some((producto) => producto.id === item.productoId)) {
        return { error: "No se puede usar un producto de otro usuario." };
      }
    }
  }

  const mediciones = {};
  for (const medicion of MEDICIONES_MEZCLA) {
    const valor = medicionNormalizada(
      entrada?.[medicion.campo],
      medicion.decimales,
      medicion.min,
      medicion.max
    );
    if (valor === undefined) return { error: medicion.error };
    mediciones[medicion.campo] = valor;
  }

  const metodoLimpio = limpiarTexto(entrada?.metodo, LIMITE_METODO);
  if (metodoLimpio.error) return { error: "La mezcla no es válida." };
  if (metodoLimpio.valor && !esMetodoBase(metodoLimpio.valor) && metodoLimpio.valor.length > LIMITE_METODO) {
    return { error: "La mezcla no es válida." };
  }
  const etapa = String(entrada?.etapa || "").trim();
  if (etapa && !esEtapa(etapa)) return { error: "La mezcla no es válida." };
  const notas = limpiarTexto(entrada?.notas ?? entrada?.observaciones, LIMITE_NOTAS);
  if (notas.error) return { error: "Las observaciones de la receta son demasiado largas." };

  return {
    error: "",
    receta: {
      nombre,
      volumen_agua: redondearCantidad(volumen),
      unidad_volumen: unidad,
      ph: mediciones.ph,
      ec: mediciones.ec,
      ppm: mediciones.ppm,
      metodo: metodoLimpio.valor,
      etapa: etapa || null,
      notas: notas.valor,
      componentes: componentesOk.componentes.map((item) => ({
        producto_id: item.productoId,
        orden: item.orden,
        cantidad: item.cantidad,
        unidad: item.unidad,
      })),
    },
  };
}

function origenNormalizado(origen) {
  if (origen === null || origen === undefined) return { origen: null };
  const lista = origen?.componentes;
  if (!Array.isArray(lista)) return { error: "La mezcla no es válida." };
  const componentesOk = componentesNormalizados(lista, { exigirProducto: true });
  if (componentesOk.error) return { error: "La mezcla no es válida." };
  return {
    origen: {
      componentes: componentesOk.componentes.map((item) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
        unidad: item.unidad,
      })),
    },
  };
}

export function mezclaAjustada(borrador) {
  const origen = borrador?.origen;
  if (!origen || !Array.isArray(origen.componentes)) return false;
  const actual = borrador?.componentes || [];
  if (origen.componentes.length !== actual.length) return true;
  for (const item of actual) {
    const productoId = item.productoId || item.producto_id;
    const base = origen.componentes.find(
      (componente) => (componente.productoId || componente.producto_id) === productoId
    );
    if (!base) return true;
    const unidadBase = base.unidad;
    const unidadActual = item.unidad;
    if (unidadBase !== unidadActual) return true;
    const cantidadBase = base.cantidad;
    const cantidadActual = item.cantidad;
    if (!cantidadesEquivalentes(cantidadBase, cantidadActual)) return true;
  }
  return false;
}

function volumenDe(entrada) {
  const volumen = parsearCantidad(entrada?.volumen ?? entrada?.volumen_agua);
  const unidad = String(entrada?.unidadVolumen || entrada?.unidad_volumen || "").trim();
  if (volumen === null || volumen <= 0 || volumen > VOLUMEN_MAXIMO || !UNIDADES_VOLUMEN.includes(unidad)) {
    return { error: "El volumen de la mezcla no es válido." };
  }
  return { volumen: redondearCantidad(volumen), unidad };
}

export function canonizarMezcla(borrador) {
  const volumenOk = volumenDe(borrador);
  if (volumenOk.error) return volumenOk;
  const componentesOk = componentesNormalizados(borrador?.componentes, { exigirProducto: true });
  if (componentesOk.error) return componentesOk;
  const origenOk = origenNormalizado(borrador?.origen);
  if (origenOk.error) return origenOk;

  const mediciones = {};
  for (const medicion of MEDICIONES_MEZCLA) {
    const valor = medicionNormalizada(
      borrador?.[medicion.campo],
      medicion.decimales,
      medicion.min,
      medicion.max
    );
    if (valor === undefined) return { error: medicion.error };
    mediciones[medicion.campo] = valor;
  }

  const metodoLimpio = limpiarTexto(borrador?.metodo, LIMITE_METODO);
  if (metodoLimpio.error) return { error: "La mezcla no es válida." };
  const etapa = String(borrador?.etapa || "").trim();
  if (etapa && !esEtapa(etapa)) return { error: "La mezcla no es válida." };
  const recetaId = String(borrador?.recetaId || borrador?.receta_id || "").trim();
  if (recetaId && !esUuidMezcla(recetaId)) return { error: "La mezcla no es válida." };
  if (!recetaId && origenOk.origen) return { error: "La mezcla no es válida." };

  const comparable = {
    incluir: true,
    recetaId,
    volumen: String(volumenOk.volumen),
    unidadVolumen: volumenOk.unidad,
    componentes: componentesOk.componentes,
    origen: origenOk.origen
      ? {
          componentes: origenOk.origen.componentes.map((item) => ({
            productoId: item.producto_id,
            cantidad: item.cantidad,
            unidad: item.unidad,
          })),
        }
      : null,
    ph: mediciones.ph === null ? "" : String(mediciones.ph),
    ec: mediciones.ec === null ? "" : String(mediciones.ec),
    ppm: mediciones.ppm === null ? "" : String(mediciones.ppm),
    metodo: metodoLimpio.valor || "",
    etapa,
  };

  return {
    error: "",
    comparable,
    payload: {
      receta_id: recetaId || null,
      volumen_agua: volumenOk.volumen,
      unidad_volumen: volumenOk.unidad,
      ph: mediciones.ph,
      ec: mediciones.ec,
      ppm: mediciones.ppm,
      metodo: metodoLimpio.valor,
      etapa: etapa || null,
      origen: origenOk.origen,
      componentes: componentesOk.componentes.map((item) => ({
        producto_id: item.productoId,
        orden: item.orden,
        cantidad: item.cantidad,
        unidad: item.unidad,
      })),
    },
  };
}

export function firmaMezcla(borrador) {
  if (!borrador?.incluir) return "";
  const canonico = canonizarMezcla(borrador);
  if (canonico.error) return `invalida:${canonico.error}`;
  return JSON.stringify(canonico.comparable);
}

export function construirPayloadMezcla({
  borrador,
  firmaInicial = "",
  acciones,
  aplicaA,
  habiaMezcla = false,
}) {
  const admite = aplicaA === "plantas" && accionesTienenMezcla(acciones);
  if (!admite) {
    return habiaMezcla ? { error: "", mezcla: { aplicar: false } } : { error: "", mezcla: null };
  }
  if (!borrador?.incluir) {
    return habiaMezcla ? { error: "", mezcla: { aplicar: false } } : { error: "", mezcla: null };
  }
  const canonico = canonizarMezcla(borrador);
  if (canonico.error) return { error: canonico.error, mezcla: null };
  if (firmaInicial && firmaMezcla(borrador) === firmaInicial) {
    return { error: "", mezcla: null };
  }
  return { error: "", mezcla: canonico.payload };
}

export function validarPayloadMezcla(mezcla, { acciones = [], aplicaA = "plantas" } = {}) {
  if (mezcla === null || mezcla === undefined) return { error: "", mezcla: null };
  if (mezcla?.aplicar === false) return { error: "", mezcla: { aplicar: false } };
  if (aplicaA !== "plantas") return { error: "Una medición ambiental no lleva mezcla." };
  if (!accionesTienenMezcla(acciones)) {
    return { error: "La mezcla requiere un riego o una fertilización." };
  }
  const canonico = canonizarMezcla({
    incluir: true,
    recetaId: mezcla.receta_id,
    volumen: mezcla.volumen_agua,
    unidadVolumen: mezcla.unidad_volumen,
    componentes: (mezcla.componentes || []).map((item) => ({
      productoId: item.producto_id,
      cantidad: item.cantidad,
      unidad: item.unidad,
    })),
    origen: mezcla.origen
      ? {
          componentes: (mezcla.origen.componentes || []).map((item) => ({
            productoId: item.producto_id,
            cantidad: item.cantidad,
            unidad: item.unidad,
          })),
        }
      : null,
    ph: mezcla.ph,
    ec: mezcla.ec,
    ppm: mezcla.ppm,
    metodo: mezcla.metodo,
    etapa: mezcla.etapa,
  });
  if (canonico.error) return { error: canonico.error, mezcla: null };
  return { error: "", mezcla: canonico.payload };
}

export function fusionarMedicionesMezcla(parametros, mezcla) {
  const lista = [...(parametros || [])];
  if (!mezcla || mezcla.aplicar === false) return { error: "", parametros: lista };

  for (const medicion of MEDICIONES_MEZCLA) {
    const valor = mezcla[medicion.campo];
    if (valor === null || valor === undefined || valor === "") continue;
    const existente = lista.find(
      (item) => item.origen === "nativa" && item.clave_nativa === medicion.claveNativa
    );
    if (existente) {
      if (!cantidadesEquivalentes(existente.valor_numero, valor)) {
        return { error: medicion.conflicto, parametros: lista };
      }
      continue;
    }
    lista.push({
      origen: "nativa",
      clave_nativa: medicion.claveNativa,
      opcion_id: null,
      nombre: medicion.nombre,
      tipo_valor: "numero",
      valor_numero: valor,
      valor_texto: null,
      unidad: medicion.unidad,
    });
  }

  return { error: "", parametros: lista };
}

export function borradorDesdeReceta(receta) {
  const componentes = [...(receta?.componentes || receta?.receta_componentes || [])].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
  );
  const origen = componentes.map((item) => ({
    productoId: item.producto_id,
    cantidad: Number(item.cantidad),
    unidad: item.unidad,
  }));
  return {
    incluir: true,
    recetaId: receta.id,
    volumen: String(receta.volumen_agua),
    unidadVolumen: receta.unidad_volumen || "L",
    componentes: origen.map((item) => ({ ...item })),
    origen: { componentes: origen.map((item) => ({ ...item })) },
    ph: receta.ph === null || receta.ph === undefined ? "" : String(receta.ph),
    ec: receta.ec === null || receta.ec === undefined ? "" : String(receta.ec),
    ppm: receta.ppm === null || receta.ppm === undefined ? "" : String(receta.ppm),
    metodo: receta.metodo || "",
    etapa: receta.etapa || "",
  };
}

export function campoMedicion(clave) {
  return MEDICIONES_MEZCLA.find((item) => item.clave === clave)?.campo || "";
}

export function borradorDesdeSnapshot(mezcla) {
  if (!mezcla || typeof mezcla !== "object" || Array.isArray(mezcla)) return null;
  const filas = [...(mezcla.registro_mezcla_componentes || [])].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
  );
  const litros = litrosDe(mezcla.volumen_agua, mezcla.unidad_volumen);
  const componentes = filas.map((fila) => {
    const unidad = fila.unidad_receta || fila.unidad_aplicada;
    const aplicada = Number(fila.cantidad_aplicada);
    const cantidad =
      (unidad === "ml/L" || unidad === "g/L") && litros
        ? redondearCantidad(aplicada / litros)
        : redondearCantidad(aplicada);
    return {
      productoId: fila.producto_id || "",
      cantidad,
      unidad,
    };
  });
  const origen = Array.isArray(mezcla.origen?.componentes)
    ? {
        componentes: mezcla.origen.componentes.map((item) => ({
          productoId: item.producto_id || item.productoId,
          cantidad: Number(item.cantidad),
          unidad: item.unidad,
        })),
      }
    : null;

  return {
    incluir: true,
    recetaId: mezcla.receta_id || "",
    volumen: String(mezcla.volumen_agua),
    unidadVolumen: mezcla.unidad_volumen || "L",
    componentes,
    origen,
    ph: mezcla.ph === null || mezcla.ph === undefined ? "" : String(mezcla.ph),
    ec: mezcla.ec === null || mezcla.ec === undefined ? "" : String(mezcla.ec),
    ppm: mezcla.ppm === null || mezcla.ppm === undefined ? "" : String(mezcla.ppm),
    metodo: mezcla.metodo || "",
    etapa: mezcla.etapa || "",
  };
}

export function congelarComponente(producto, dosis) {
  return {
    producto_id: producto.id,
    nombre_producto: producto.nombre,
    fabricante: producto.fabricante || null,
    tipo_producto: producto.tipo,
    cantidad_aplicada: dosis.cantidad_aplicada,
    unidad_aplicada: dosis.unidad_aplicada,
    cantidad_receta: dosis.cantidad_receta,
    unidad_receta: dosis.unidad_receta,
  };
}

export function esDosisPorLitro(unidad) {
  return esUnidadPorLitro(unidad);
}
