/**
 * Consulta y forma pública del almacenamiento administrativo.
 * Puro: no habla con Supabase y no rellena tamaños ausentes.
 */

const ZONA = "America/Argentina/Buenos_Aires";
const DESPLAZAMIENTO = "-03:00";
const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAXIMO_DIAS = 366;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EXT = "(?:webp|jpg|png)";
const REGISTRO = new RegExp(`^${UUID}/registros/${UUID}(_m)?\\.${EXT}$`, "i");
const PORTADA = new RegExp(`^${UUID}/portadas/${UUID}/${UUID}(_m)?\\.${EXT}$`, "i");
const FLORA = new RegExp(`^${UUID}/flora/${UUID}\\.${EXT}$`, "i");
const BUCKET = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MIME = /^[a-z0-9][a-z0-9.+-]{0,40}\/[a-z0-9][a-z0-9.+-]{0,40}$/;

export const RPC_RESUMEN_ALMACENAMIENTO = "resumen_almacenamiento_admin";
export const PERIODOS_ALMACENAMIENTO = Object.freeze(["7", "30", "90", "personalizado"]);
export const CATEGORIAS_ALMACENAMIENTO = Object.freeze([
  "flora",
  "miniaturas",
  "otros",
  "portadas",
  "registros",
  "sin_clasificar",
]);

const CLAVES = Object.freeze([
  "anadidos_bytes",
  "anadidos_objetos",
  "anadidos_sin_tamano",
  "bytes",
  "bytes_completos",
  "desde",
  "hasta",
  "imagenes",
  "medido_en",
  "objetos",
  "objetos_sin_mime",
  "objetos_sin_tamano",
  "ocupacion_historica_disponible",
  "ok",
  "por_bucket",
  "por_categoria",
  "por_mime",
  "promedio_bytes",
  "serie",
  "ultimo_objeto_en",
]);

const CLAVES_PROHIBIDAS = Object.freeze([
  "email",
  "metadata",
  "name",
  "owner",
  "owner_id",
  "path",
  "ruta",
  "signed",
  "url",
  "user_metadata",
  "usuario_id",
]);

const MENSAJE_MIGRACION =
  "Almacenamiento todavía no está operativo en el panel: falta aplicar supabase/admin-almacenamiento.sql. Hasta entonces no se muestran cifras.";
const MENSAJE_ERROR = "No pudimos leer el almacenamiento. No se muestran cifras parciales.";
const MENSAJE_PERIODO = "El período no es válido. Usá 7, 30 o 90 días, o un rango de hasta 366 días.";

export function mensajeAlmacenamiento(estado) {
  if (estado === "migracion") return MENSAJE_MIGRACION;
  if (estado === "error") return MENSAJE_ERROR;
  if (estado === "consulta") return MENSAJE_PERIODO;
  return "";
}

export function clasificarErrorAlmacenamiento(error) {
  const codigo = String(error?.code || "");
  const mensaje = String(error?.message || "");
  if (codigo === "PGRST202" || /could not find the function|schema cache/i.test(mensaje)) return "migracion";
  return "error";
}

export function codigoAlmacenamientoConocido(data) {
  if (!data || typeof data !== "object" || data.ok !== false) return "";
  if (data.codigo === "consulta_invalida") return data.codigo;
  return "desconocido";
}

/**
 * Clasifica un objeto por bucket y ruta, sin devolver la ruta.
 * Miniaturas y originales son excluyentes. Un patrón desconocido queda sin clasificar.
 */
export function clasificarObjetoAlmacenamiento(bucket, nombre) {
  const texto = String(nombre || "");
  if (bucket === "enflora-fotos" && REGISTRO.test(texto)) return texto.includes("_m.") ? "miniaturas" : "registros";
  if (bucket === "enflora-fotos" && PORTADA.test(texto)) return texto.includes("_m.") ? "miniaturas" : "portadas";
  if (bucket === "enflora-fotos" && FLORA.test(texto)) return "flora";
  if (bucket === "avatars" || bucket === "geneticas-imagenes") return "otros";
  return "sin_clasificar";
}

export function bytesInformados(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  const size = enteroMetadata(metadata.size);
  if (size != null) return size;
  return enteroMetadata(metadata.contentLength);
}

function enteroMetadata(valor) {
  if (typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= 10 ** 15) return valor;
  if (typeof valor === "string" && /^[0-9]{1,15}$/.test(valor)) return Number(valor);
  return null;
}

function falloConsulta(error) {
  return { ok: false, error };
}

function textoCorto(valor, maximo = 40) {
  if (valor === undefined || valor === null || valor === "") return "";
  if (typeof valor === "string") return valor.length <= maximo ? valor : null;
  if (Array.isArray(valor) && valor.length === 1 && typeof valor[0] === "string" && valor[0].length <= maximo) return valor[0];
  return null;
}

export function diaArgentina(fecha) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

export function sumarDiasCalendario(dia, cantidad) {
  const coincidencia = RE_DIA.exec(dia);
  if (!coincidencia) return null;
  const fecha = new Date(Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]) + cantidad));
  return fecha.toISOString().slice(0, 10);
}

export function inicioDiaArgentina(dia) {
  if (!RE_DIA.test(dia)) return null;
  const fecha = new Date(`${dia}T00:00:00.000${DESPLAZAMIENTO}`);
  if (Number.isNaN(fecha.getTime())) return null;
  if (diaArgentina(fecha) !== dia) return null;
  return fecha.toISOString();
}

function listarDias(desdeDia, hastaDia) {
  const dias = [];
  let cursor = desdeDia;
  while (cursor <= hastaDia) {
    dias.push(cursor);
    cursor = sumarDiasCalendario(cursor, 1);
    if (!cursor || dias.length > MAXIMO_DIAS) return null;
  }
  return dias;
}

function rangoEntreDias(desdeDia, hastaDia) {
  const dias = listarDias(desdeDia, hastaDia);
  if (!dias) return null;
  const hastaExclusivo = sumarDiasCalendario(hastaDia, 1);
  const desde = inicioDiaArgentina(desdeDia);
  const hasta = inicioDiaArgentina(hastaExclusivo);
  if (!desde || !hasta) return null;
  return { desdeDia, hastaDia, desde, hasta, dias };
}

function resolverPeriodo(bruto, ahora) {
  const periodo = bruto.periodo === "" ? "30" : bruto.periodo;
  if (periodo === null || !PERIODOS_ALMACENAMIENTO.includes(periodo)) return falloConsulta(MENSAJE_PERIODO);
  if (periodo !== "personalizado") {
    const hoy = diaArgentina(ahora);
    const desdeDia = sumarDiasCalendario(hoy, -(Number(periodo) - 1));
    const rango = rangoEntreDias(desdeDia, hoy);
    if (!rango) return falloConsulta(MENSAJE_PERIODO);
    return { ok: true, periodo, ...rango };
  }
  if (!RE_DIA.test(bruto.desde) || !RE_DIA.test(bruto.hasta)) return falloConsulta(MENSAJE_PERIODO);
  const rango = rangoEntreDias(bruto.desde, bruto.hasta);
  if (!rango) return falloConsulta(MENSAJE_PERIODO);
  return { ok: true, periodo, ...rango };
}

export function interpretarConsultaAlmacenamiento(parametros, ahora = new Date()) {
  const fuente = parametros && typeof parametros === "object" ? parametros : {};
  const bruto = {
    periodo: textoCorto(fuente.periodo),
    desde: textoCorto(fuente.desde),
    hasta: textoCorto(fuente.hasta),
  };
  if (Object.values(bruto).some((valor) => valor === null)) return falloConsulta(MENSAJE_PERIODO);
  const periodo = resolverPeriodo(bruto, ahora);
  if (!periodo.ok) return periodo;
  return {
    ok: true,
    consulta: {
      periodo: periodo.periodo,
      desdeDia: periodo.desdeDia,
      hastaDia: periodo.hastaDia,
      desde: periodo.desde,
      hasta: periodo.hasta,
      dias: periodo.dias,
    },
  };
}

export function prepararConsultaAlmacenamiento(parametros, ahora = new Date()) {
  const interpretado = interpretarConsultaAlmacenamiento(parametros, ahora);
  const consulta = interpretado.ok ? interpretado.consulta : interpretarConsultaAlmacenamiento({}, ahora).consulta;
  return { interpretado, consulta };
}

export function argumentosResumenAlmacenamiento(consulta) {
  return { p_desde: consulta.desde, p_hasta: consulta.hasta };
}

function clavesExactas(dato, claves) {
  if (!dato || typeof dato !== "object" || Array.isArray(dato)) return false;
  const presentes = Object.keys(dato);
  return presentes.length === claves.length && claves.every((clave) => Object.hasOwn(dato, clave));
}

function tieneClaveProhibida(valor) {
  if (!valor || typeof valor !== "object") return false;
  if (Array.isArray(valor)) return valor.some((item) => tieneClaveProhibida(item));
  return Object.keys(valor).some((clave) => CLAVES_PROHIBIDAS.includes(clave) || tieneClaveProhibida(valor[clave]));
}

function entero(valor) {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= Number.MAX_SAFE_INTEGER;
}

function enteroONulo(valor) {
  if (valor === null) return null;
  return entero(valor) ? valor : undefined;
}

function instante(valor) {
  if (valor === null) return null;
  if (typeof valor !== "string" || valor.length < 20 || valor.length > 40) return undefined;
  const ms = Date.parse(valor);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString();
}

function diaDe(valor) {
  if (typeof valor !== "string") return null;
  const dia = valor.slice(0, 10);
  return RE_DIA.test(dia) ? dia : null;
}

export function presentarResumenAlmacenamiento(data, consulta) {
  if (
    !clavesExactas(data, CLAVES) ||
    data.ok !== true ||
    data.ocupacion_historica_disponible !== false ||
    typeof data.bytes_completos !== "boolean" ||
    tieneClaveProhibida(data)
  ) {
    return { ok: false };
  }
  const desde = instante(data.desde);
  const hasta = instante(data.hasta);
  const medidoEn = instante(data.medido_en);
  const ultimo = instante(data.ultimo_objeto_en);
  if (
    !desde ||
    !hasta ||
    !medidoEn ||
    ultimo === undefined ||
    desde !== new Date(consulta.desde).toISOString() ||
    hasta !== new Date(consulta.hasta).toISOString()
  ) {
    return { ok: false };
  }
  const conteos = [data.objetos, data.objetos_sin_tamano, data.imagenes, data.objetos_sin_mime, data.anadidos_objetos, data.anadidos_sin_tamano];
  if (!conteos.every(entero)) return { ok: false };
  if (data.objetos_sin_tamano > data.objetos || data.anadidos_sin_tamano > data.anadidos_objetos || data.anadidos_objetos > data.objetos) {
    return { ok: false };
  }
  if (data.imagenes > data.objetos || data.objetos_sin_mime > data.objetos) return { ok: false };
  const bytes = enteroONulo(data.bytes);
  const promedio = enteroONulo(data.promedio_bytes);
  const anadidosBytes = enteroONulo(data.anadidos_bytes);
  if (bytes === undefined || promedio === undefined || anadidosBytes === undefined) return { ok: false };
  if (data.objetos === 0 && (bytes !== 0 || promedio != null || data.bytes_completos !== true)) return { ok: false };
  if (data.objetos > 0 && data.objetos_sin_tamano === 0 && (bytes == null || data.bytes_completos !== true)) return { ok: false };
  if (data.objetos_sin_tamano > 0 && data.bytes_completos !== false) return { ok: false };
  if (data.objetos_sin_tamano === data.objetos && data.objetos > 0 && bytes != null) return { ok: false };
  if (!Array.isArray(data.por_bucket) || !Array.isArray(data.por_categoria) || !Array.isArray(data.por_mime) || !Array.isArray(data.serie)) {
    return { ok: false };
  }
  if (data.serie.length !== consulta.dias.length) return { ok: false };
  const porBucket = [];
  for (const fila of data.por_bucket) {
    if (!clavesExactas(fila, ["bucket", "bytes", "objetos", "objetos_sin_tamano"]) || !BUCKET.test(fila.bucket) && fila.bucket !== "sin_clasificar") {
      return { ok: false };
    }
    const bytesFila = enteroONulo(fila.bytes);
    if (!entero(fila.objetos) || !entero(fila.objetos_sin_tamano) || bytesFila === undefined || fila.objetos_sin_tamano > fila.objetos) {
      return { ok: false };
    }
    porBucket.push({ bucket: fila.bucket, objetos: fila.objetos, bytes: bytesFila, objetosSinTamano: fila.objetos_sin_tamano });
  }
  const vistas = new Set();
  const porCategoria = [];
  for (const fila of data.por_categoria) {
    if (!clavesExactas(fila, ["bytes", "categoria", "objetos", "objetos_sin_tamano"]) || !CATEGORIAS_ALMACENAMIENTO.includes(fila.categoria)) {
      return { ok: false };
    }
    const bytesFila = enteroONulo(fila.bytes);
    if (!entero(fila.objetos) || !entero(fila.objetos_sin_tamano) || bytesFila === undefined || fila.objetos_sin_tamano > fila.objetos) {
      return { ok: false };
    }
    vistas.add(fila.categoria);
    porCategoria.push({
      categoria: fila.categoria,
      objetos: fila.objetos,
      bytes: bytesFila,
      objetosSinTamano: fila.objetos_sin_tamano,
    });
  }
  if (vistas.size !== CATEGORIAS_ALMACENAMIENTO.length) return { ok: false };
  const porMime = [];
  for (const fila of data.por_mime) {
    if (!clavesExactas(fila, ["bytes", "mime", "objetos"])) return { ok: false };
    if (fila.mime !== "sin_tipo" && !MIME.test(fila.mime)) return { ok: false };
    const bytesFila = enteroONulo(fila.bytes);
    if (!entero(fila.objetos) || bytesFila === undefined) return { ok: false };
    porMime.push({ mime: fila.mime, objetos: fila.objetos, bytes: bytesFila });
  }
  const serie = [];
  for (let i = 0; i < data.serie.length; i += 1) {
    const punto = data.serie[i];
    if (!clavesExactas(punto, ["bytes", "dia", "objetos"])) return { ok: false };
    const dia = diaDe(punto.dia);
    const bytesDia = enteroONulo(punto.bytes);
    if (dia !== consulta.dias[i] || !entero(punto.objetos) || bytesDia === undefined) return { ok: false };
    if (punto.objetos === 0 && bytesDia !== 0) return { ok: false };
    serie.push({ dia, objetos: punto.objetos, bytes: bytesDia });
  }
  const objetosCategoria = porCategoria.reduce((suma, fila) => suma + fila.objetos, 0);
  const objetosBucket = porBucket.reduce((suma, fila) => suma + fila.objetos, 0);
  if (objetosCategoria !== data.objetos || objetosBucket !== data.objetos) return { ok: false };
  return {
    ok: true,
    resumen: {
      medidoEn,
      ultimoObjetoEn: ultimo,
      objetos: data.objetos,
      bytes,
      bytesCompletos: data.bytes_completos,
      objetosSinTamano: data.objetos_sin_tamano,
      imagenes: data.imagenes,
      objetosSinMime: data.objetos_sin_mime,
      promedioBytes: promedio,
      ocupacionHistoricaDisponible: false,
      anadidosObjetos: data.anadidos_objetos,
      anadidosBytes,
      anadidosSinTamano: data.anadidos_sin_tamano,
      porBucket,
      porCategoria,
      porMime,
      serie,
    },
  };
}
