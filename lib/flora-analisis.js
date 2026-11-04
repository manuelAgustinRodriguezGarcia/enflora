import { diaArgentina, horaArgentina } from "@/lib/historial-registros";
import { revisarMedicionPlausible } from "@/lib/flora-mediciones";
import { esUnidadPorLitro } from "@/lib/mezclas/calculo";
import { componentesDeMezcla, mezclaDeRegistro } from "@/lib/mezclas/presentacion";
import { etiquetaAccionNativa, PARAMETROS_SEGUIMIENTO } from "@/lib/seguimiento";

export const TOPE_APLICACIONES_LISTADAS = 8;
export const TOPE_CARACTERES_APLICACIONES = 11_000;
export const TOPE_PRODUCTOS_RESUMEN = 40;

export const NOTAS_APLICACIONES_NUTRIENTES = [
  "Solo se incluyen mezclas aplicadas en un registro. Una receta guardada que no se usó no cuenta como aplicación.",
  "El volumen es el agua preparada en esa aplicación. No es el volumen aplicado a cada planta.",
  "ml/L, g/L y gotas/L son dosis por litro. ml, g, L y gotas son cantidades absolutas del preparado.",
  "Los nombres de producto son los guardados en el registro, no el nombre actual del catálogo.",
];

function claveParametro(fila) {
  if (!fila) return "";
  if (fila.origen === "nativa" && fila.clave_nativa) {
    return `nativa:${String(fila.clave_nativa).trim().toLowerCase()}`;
  }
  if (fila.opcion_id) return `opcion:${fila.opcion_id}`;
  const nombre = String(fila.nombre || "").trim().toLowerCase();
  return nombre ? `nombre:${nombre}` : "";
}

function valorNumericoParametro(fila) {
  if (!fila || fila.tipo_valor === "texto") return null;
  const valor = Number(fila.valor_numero);
  return Number.isFinite(valor) ? valor : null;
}

function horaLocalArgentina(fechaIso) {
  const coincidencia = /(\d{2}):(\d{2})/.exec(horaArgentina(fechaIso));
  return coincidencia ? `${coincidencia[1]}:${coincidencia[2]}` : "";
}

function momentoLocal(fechaIso) {
  return {
    fecha_local: diaArgentina(fechaIso) || null,
    hora_local: horaLocalArgentina(fechaIso) || null,
  };
}

function parametroParaModelo(fila) {
  const revision = revisarMedicionPlausible(fila?.clave_nativa || fila?.nombre, fila?.valor_numero, fila?.unidad);
  return {
    origen: fila.origen,
    clave_nativa: fila.clave_nativa || null,
    opcion_id: fila.opcion_id || null,
    nombre: fila.nombre,
    tipo_valor: fila.tipo_valor,
    valor_numero: fila.valor_numero,
    valor_texto: fila.valor_texto,
    unidad: fila.unidad,
    ...(revision.estado === "sospechoso" ? { advertencia: revision.advertencia } : {}),
  };
}

export function registroCompacto(registro) {
  if (!registro) return null;
  const fotos = registro.registro_fotos || [];
  const local = momentoLocal(registro.fecha_evento);
  return {
    id: registro.id,
    fecha_evento: registro.fecha_evento,
    fecha_local: local.fecha_local,
    hora_local: local.hora_local,
    alcance: registro.alcance,
    aplica_a: registro.aplica_a,
    unidad_cultivo_id: registro.unidad_cultivo_id,
    genetica_clave: registro.genetica_clave || null,
    genetica_etiqueta: registro.genetica_etiqueta || null,
    observacion: String(registro.observacion || "").trim() || null,
    plantas: (registro.registro_plantas || []).map((fila) => ({
      planta_id: fila.planta_id,
      nombre: fila.nombre_planta,
      numero: fila.numero_planta,
      genetica: fila.genetica_planta,
      unidad_cultivo_id: fila.unidad_cultivo_id,
      nombre_unidad: fila.nombre_unidad,
    })),
    acciones: (registro.registro_acciones || []).map((fila) => ({
      origen: fila.origen,
      clave_nativa: fila.clave_nativa || null,
      opcion_id: fila.opcion_id || null,
      nombre: fila.nombre || etiquetaAccionNativa(fila.clave_nativa),
    })),
    parametros: (registro.registro_parametros || []).map(parametroParaModelo),
    fotos: {
      cantidad: fotos.length,
      ids: fotos.map((f) => f.id).filter(Boolean),
    },
    tiene_mezcla_aplicada: Boolean(mezclaDeRegistro(registro)),
  };
}

function coincideAccion(fila, filtro) {
  if (!fila) return false;
  if (filtro.claveNativa) {
    return fila.origen === "nativa" && fila.clave_nativa === filtro.claveNativa;
  }
  if (filtro.opcionId) {
    return fila.opcion_id === filtro.opcionId;
  }
  if (filtro.nombre) {
    return String(fila.nombre || "").trim().toLowerCase() === filtro.nombre.toLowerCase();
  }
  return true;
}

export function registrosConAccion(registros, filtroAccion) {
  return (registros || []).filter((registro) =>
    (registro.registro_acciones || []).some((fila) => coincideAccion(fila, filtroAccion))
  );
}

export function buscarEventoAccion(registros, filtroAccion, { orden = "desc" } = {}) {
  const candidatos = registrosConAccion(registros, filtroAccion);
  candidatos.sort((a, b) => {
    const ta = new Date(a.fecha_evento).getTime();
    const tb = new Date(b.fecha_evento).getTime();
    return orden === "asc" ? ta - tb : tb - ta;
  });
  return candidatos[0] ? registroCompacto(candidatos[0]) : null;
}

export function contarAcciones(registros, filtroAccion) {
  let total = 0;
  for (const registro of registros || []) {
    const coinciden = (registro.registro_acciones || []).filter((fila) =>
      coincideAccion(fila, filtroAccion)
    );
    if (coinciden.length) total += 1;
  }
  return total;
}

function coincideParametroFiltro(fila, filtro) {
  if (!fila) return false;
  if (filtro.claveNativa) {
    return fila.origen === "nativa" && fila.clave_nativa === filtro.claveNativa;
  }
  if (filtro.opcionId) return fila.opcion_id === filtro.opcionId;
  if (filtro.nombre) {
    return String(fila.nombre || "").trim().toLowerCase() === filtro.nombre.toLowerCase();
  }
  return true;
}

export function medicionesParametro(registros, filtro, { registroAplicaA: leerAplicaA } = {}) {
  const puntos = [];
  for (const registro of registros || []) {
    const aplicaA = leerAplicaA ? leerAplicaA(registro) : registro.aplica_a;
    for (const fila of registro.registro_parametros || []) {
      if (filtro.aplicaA && aplicaA !== filtro.aplicaA) continue;
      if (!coincideParametroFiltro(fila, filtro)) continue;
      const numero = valorNumericoParametro(fila);
      const revision = revisarMedicionPlausible(fila.clave_nativa || fila.nombre, numero, fila.unidad);
      const local = momentoLocal(registro.fecha_evento);
      puntos.push({
        registro_id: registro.id,
        fecha_evento: registro.fecha_evento,
        dia: local.fecha_local,
        hora_local: local.hora_local,
        aplica_a: aplicaA,
        clave: claveParametro(fila),
        nombre: fila.nombre,
        origen: fila.origen,
        tipo_valor: fila.tipo_valor,
        valor_numero: numero,
        valor_texto: fila.tipo_valor === "texto" ? String(fila.valor_texto || "").trim() : null,
        unidad: fila.unidad || "",
        ...(revision.estado === "sospechoso" ? { advertencia: revision.advertencia } : {}),
      });
    }
  }
  puntos.sort((a, b) => new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime());
  return puntos;
}

export function estadisticasMediciones(puntos) {
  const numericos = (puntos || []).filter((p) => p.valor_numero !== null);
  if (!numericos.length) {
    return {
      cantidad: puntos?.length || 0,
      medicionesNumericas: 0,
      minimo: null,
      maximo: null,
      promedio: null,
      ultimo: puntos?.[0] || null,
      unidades: [],
      comparable: false,
    };
  }

  const unidades = [...new Set(numericos.map((p) => String(p.unidad || "").trim()))];
  const comparable = unidades.length <= 1;
  const valores = numericos.map((p) => p.valor_numero);
  const suma = valores.reduce((a, b) => a + b, 0);

  return {
    cantidad: puntos.length,
    medicionesNumericas: numericos.length,
    minimo: comparable ? Math.min(...valores) : null,
    maximo: comparable ? Math.max(...valores) : null,
    promedio: comparable ? suma / valores.length : null,
    ultimo: numericos[0],
    unidades,
    comparable,
  };
}

export function resumirActividadDesdeRegistros(registros, { etapas = [], periodo } = {}) {
  const dias = new Set();
  let acciones = 0;
  let mediciones = 0;
  let observaciones = 0;
  let fotos = 0;
  const frecuenciaAcciones = new Map();

  for (const registro of registros || []) {
    const dia = diaArgentina(registro.fecha_evento);
    if (dia) dias.add(dia);
    const listaAcciones = registro.registro_acciones || [];
    acciones += listaAcciones.length;
    for (const fila of listaAcciones) {
      const clave =
        fila.origen === "nativa"
          ? fila.clave_nativa
          : fila.opcion_id || String(fila.nombre || "").trim();
      frecuenciaAcciones.set(clave, (frecuenciaAcciones.get(clave) || 0) + 1);
    }
    mediciones += (registro.registro_parametros || []).length;
    if (String(registro.observacion || "").trim()) observaciones += 1;
    fotos += (registro.registro_fotos || []).length;
  }

  const riegos = contarAcciones(registros, { claveNativa: "riego" });

  return {
    periodo: periodo || null,
    registros: (registros || []).length,
    diasConActividad: dias.size,
    acciones,
    mediciones,
    observaciones,
    fotos,
    riegos,
    frecuenciaAcciones: Object.fromEntries(frecuenciaAcciones),
    cambiosEtapa: (etapas || []).length,
  };
}

export function clasificarParametroNativo(clave) {
  const nativo = PARAMETROS_SEGUIMIENTO.find((p) => p.valor === clave);
  if (!nativo) return { tipo: "personalizado", clave };
  const esAmbiente = ["temperatura", "humedad", "vpd"].includes(clave);
  return {
    tipo: esAmbiente ? "ambiente" : "planta",
    clave,
    etiqueta: nativo.etiqueta,
    unidad: nativo.unidad,
  };
}

export function agruparRegistrosPorDiaEvento(registros) {
  const mapa = new Map();
  for (const registro of registros || []) {
    const dia = diaArgentina(registro.fecha_evento);
    if (!dia) continue;
    const lista = mapa.get(dia) || [];
    lista.push(registroCompacto(registro));
    mapa.set(dia, lista);
  }
  return [...mapa.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dia, eventos]) => ({ dia, cantidad: eventos.length, eventos }));
}

function numeroRegistrado(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function medidaRegistrada(cantidad, unidad) {
  const numero = numeroRegistrado(cantidad);
  const texto = String(unidad || "").trim();
  if (numero === null || !texto) return null;
  return { cantidad: numero, unidad: texto };
}

function normalizarNombreProducto(valor) {
  return String(valor || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function componenteNutrienteCompacto(fila) {
  const nombre = String(fila?.nombre_producto || "").trim();
  if (!nombre) return null;
  const receta = medidaRegistrada(fila.cantidad_receta, fila.unidad_receta);
  const aplicada = medidaRegistrada(fila.cantidad_aplicada, fila.unidad_aplicada);
  const dosis = esUnidadPorLitro(receta?.unidad)
    ? receta
    : esUnidadPorLitro(aplicada?.unidad)
      ? aplicada
      : null;
  const absoluta = aplicada && !esUnidadPorLitro(aplicada.unidad) ? aplicada : null;
  const recetaDistinta =
    receta &&
    !esUnidadPorLitro(receta.unidad) &&
    absoluta &&
    (receta.unidad !== absoluta.unidad || receta.cantidad !== absoluta.cantidad);
  return {
    nombre_producto: nombre,
    fabricante: String(fila.fabricante || "").trim() || null,
    tipo_producto: String(fila.tipo_producto || "").trim() || null,
    dosis_por_litro: dosis,
    cantidad_absoluta: absoluta,
    ...(recetaDistinta ? { cantidad_en_receta: receta } : {}),
  };
}

export function aplicacionNutrientesDeRegistro(registro) {
  const mezcla = mezclaDeRegistro(registro);
  if (!mezcla || !registro) return null;
  const componentes = componentesDeMezcla(mezcla).map(componenteNutrienteCompacto).filter(Boolean);
  const local = momentoLocal(registro.fecha_evento);
  const mediciones = {
    ph: numeroRegistrado(mezcla.ph),
    ec: numeroRegistrado(mezcla.ec),
    ppm: numeroRegistrado(mezcla.ppm),
  };
  const advertencias = ["ph", "ec", "ppm"]
    .map((clave) => {
      const revision = revisarMedicionPlausible(clave, mediciones[clave], clave === "ppm" ? "ppm" : "");
      return revision.estado === "sospechoso" ? { clave, advertencia: revision.advertencia } : null;
    })
    .filter(Boolean);
  return {
    registro_id: registro.id,
    fecha_evento: registro.fecha_evento,
    fecha_local: local.fecha_local,
    hora_local: local.hora_local,
    alcance: registro.alcance || null,
    unidad_cultivo_id: registro.unidad_cultivo_id || null,
    plantas: (registro.registro_plantas || []).map((fila) => ({
      planta_id: fila.planta_id,
      nombre: fila.nombre_planta || null,
    })),
    acciones: (registro.registro_acciones || []).map((fila) => ({
      origen: fila.origen,
      clave_nativa: fila.clave_nativa || null,
      nombre: fila.nombre || etiquetaAccionNativa(fila.clave_nativa),
    })),
    nombre_receta: String(mezcla.nombre_receta || "").trim() || null,
    volumen_preparado: {
      cantidad: numeroRegistrado(mezcla.volumen_agua),
      unidad: mezcla.unidad_volumen || null,
      significado: "agua_preparada",
    },
    mediciones_mezcla: {
      ...mediciones,
      origen: "snapshot_de_la_aplicacion",
      ...(advertencias.length ? { advertencias } : {}),
    },
    componentes,
    fuente: "registro_aplicado",
  };
}

function claveProducto(item) {
  return `${normalizarNombreProducto(item?.nombre_producto)}||${normalizarNombreProducto(item?.fabricante)}`;
}

export function resumenProductosAplicados(registros) {
  const mapa = new Map();
  for (const registro of registros || []) {
    const mezcla = mezclaDeRegistro(registro);
    if (!mezcla || !registro) continue;
    const componentes = componentesDeMezcla(mezcla).map(componenteNutrienteCompacto).filter(Boolean);
    const vistos = new Set();
    for (const componente of componentes) {
      const clave = claveProducto(componente);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      const previo = mapa.get(clave);
      if (previo) {
        previo.aplicaciones += 1;
      } else {
        mapa.set(clave, {
          nombre_producto: componente.nombre_producto,
          fabricante: componente.fabricante,
          tipo_producto: componente.tipo_producto,
          aplicaciones: 1,
        });
      }
    }
  }
  return [...mapa.values()].sort((a, b) => b.aplicaciones - a.aplicaciones || a.nombre_producto.localeCompare(b.nombre_producto, "es"));
}

export function compararProductosAplicados(registrosA, registrosB) {
  const periodoA = resumenProductosAplicados(registrosA);
  const periodoB = resumenProductosAplicados(registrosB);
  const mapa = new Map();
  for (const item of periodoA) {
    mapa.set(claveProducto(item), {
      nombre_producto: item.nombre_producto,
      fabricante: item.fabricante,
      tipo_producto: item.tipo_producto,
      aplicaciones_a: item.aplicaciones,
      aplicaciones_b: 0,
    });
  }
  for (const item of periodoB) {
    const clave = claveProducto(item);
    const previo = mapa.get(clave);
    if (previo) {
      previo.aplicaciones_b = item.aplicaciones;
    } else {
      mapa.set(clave, {
        nombre_producto: item.nombre_producto,
        fabricante: item.fabricante,
        tipo_producto: item.tipo_producto,
        aplicaciones_a: 0,
        aplicaciones_b: item.aplicaciones,
      });
    }
  }
  return [...mapa.values()];
}

export function seleccionarProductosPorNombre(resumen, nombre) {
  const clave = normalizarNombreProducto(nombre);
  if (!clave) return [];
  return (resumen || []).filter((item) => normalizarNombreProducto(item.nombre_producto) === clave);
}

export function filtrarRegistrosDeAplicacion(registros, { claveNativa, nombreAccion, nombreProducto, nombreReceta, soloConMezcla = false } = {}) {
  const pideAccion = Boolean(claveNativa || nombreAccion);
  let lista = pideAccion
    ? registrosConAccion(registros, { claveNativa: claveNativa || "", nombre: nombreAccion || "" })
    : [...(registros || [])];
  if (soloConMezcla || nombreProducto || nombreReceta) {
    lista = lista.filter((registro) => mezclaDeRegistro(registro));
  }
  const producto = normalizarNombreProducto(nombreProducto);
  if (producto) {
    lista = lista.filter((registro) =>
      (aplicacionNutrientesDeRegistro(registro)?.componentes || []).some(
        (componente) => normalizarNombreProducto(componente.nombre_producto) === producto
      )
    );
  }
  const receta = normalizarNombreProducto(nombreReceta);
  if (receta) {
    lista = lista.filter((registro) => normalizarNombreProducto(mezclaDeRegistro(registro)?.nombre_receta) === receta);
  }
  return lista;
}

export function recortarAplicacionesNutrientes(
  aplicaciones,
  { tope = TOPE_APLICACIONES_LISTADAS, maxCaracteres = TOPE_CARACTERES_APLICACIONES } = {}
) {
  const salida = [];
  let recortado = (aplicaciones || []).length > tope;
  for (const item of (aplicaciones || []).slice(0, tope)) {
    if (JSON.stringify([...salida, item]).length > maxCaracteres) {
      recortado = true;
      break;
    }
    salida.push(item);
  }
  return { aplicaciones: salida, recortado };
}

const CLAVES_OMITIDAS_MODELO = new Set(["ids", "opcion_id", "ruta", "ruta_miniatura", "usuario_id"]);

function valorParaModelo(clave, valor) {
  if (CLAVES_OMITIDAS_MODELO.has(clave)) return undefined;
  if (valor == null || valor === "") return undefined;
  if (typeof valor === "string" && (clave === "observacion" || clave === "valor_texto") && valor.length > 180) {
    return `${valor.slice(0, 180)}…`;
  }
  if (Array.isArray(valor)) return valor.map((item) => aligerarResultadoModelo(item));
  if (typeof valor === "object") return aligerarResultadoModelo(valor);
  return valor;
}

/** Quita identificadores y vacíos que no cambian el dato que Flora tiene que citar. */
export function aligerarResultadoModelo(valor) {
  if (Array.isArray(valor)) return valor.map((item) => aligerarResultadoModelo(item));
  if (!valor || typeof valor !== "object") return valor;
  const salida = {};
  for (const [clave, item] of Object.entries(valor)) {
    const liviano = valorParaModelo(clave, item);
    if (liviano === undefined) continue;
    if (typeof liviano === "object" && !Array.isArray(liviano) && Object.keys(liviano).length === 0) continue;
    salida[clave] = liviano;
  }
  return salida;
}

function textoEstable(valor) {
  if (Array.isArray(valor)) return `[${valor.map(textoEstable).join(",")}]`;
  if (valor && typeof valor === "object") {
    return `{${Object.keys(valor)
      .sort()
      .map((clave) => `${JSON.stringify(clave)}:${textoEstable(valor[clave])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valor ?? null);
}

export function claveLlamadaHerramienta(nombre, args) {
  return `${nombre}:${textoEstable(args || {})}`;
}

export function comparacionAlcanzaParaResponder(resultado) {
  return resultado?.tipoConsulta === "comparar_periodos" && !resultado.error;
}

const CUBIERTAS_POR_COMPARACION = new Set([
  "resumir_actividad_periodo",
  "consultar_actividad_por_fechas",
]);

export function llamadaCubiertaPorComparacion(nombre, comparacionLista) {
  return Boolean(comparacionLista) && CUBIERTAS_POR_COMPARACION.has(nombre);
}

export function relacionAlcanzaParaResponder(resultado) {
  return resultado?.tipoConsulta === "evolucion_cultivo" && !resultado.error;
}

const CUBIERTAS_POR_RELACION = new Set([
  "consultar_parametros",
  "consultar_aplicaciones_nutrientes",
  "buscar_acciones_historicas",
  "consultar_actividad_por_fechas",
]);

export function llamadaCubiertaPorRelacion(nombre, relacionLista) {
  return Boolean(relacionLista) && CUBIERTAS_POR_RELACION.has(nombre);
}
