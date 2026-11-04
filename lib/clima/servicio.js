import { avisosDesdePronostico } from "@/lib/clima/alertas";
import { almacenCompartido } from "@/lib/clima/almacen";
import {
  DIAS_PRONOSTICO,
  PROVEEDOR_CLIMA,
  TEXTO_ATRIBUCION,
  TEXTO_DESCARGO,
  TTL_BUSQUEDA_MS,
  TTL_PRONOSTICO_MS,
  limitesClima,
  mensajeClima,
  umbralesClima,
} from "@/lib/clima/constantes";
import { climaGuardadoValido, normalizarBusqueda, normalizarPronostico } from "@/lib/clima/normalizar";
import { clasificarFallo, consultarProveedor, crearConsultaBusqueda, crearConsultaPronostico } from "@/lib/clima/proveedor";
import { etiquetaLocalidad } from "@/lib/clima/texto";
import {
  claveBusqueda,
  clavePronostico,
  consultaValida,
  coordenadaValida,
  idLugarValido,
  ventanaDia,
  ventanaHora,
} from "@/lib/clima/validar";

function fallo(codigo) {
  return { ok: false, codigo, mensaje: mensajeClima(codigo) };
}

function presentar(base, umbrales, consultaEn) {
  return {
    ...base,
    proveedor: PROVEEDOR_CLIMA.id,
    consultaEn,
    diasDisponibles: base.dias.length,
    diasPedidos: DIAS_PRONOSTICO,
    avisosEnflora: avisosDesdePronostico(base.dias, umbrales),
    atribucion: {
      nombre: PROVEEDOR_CLIMA.nombre,
      url: PROVEEDOR_CLIMA.url,
      texto: TEXTO_ATRIBUCION,
      descargo: TEXTO_DESCARGO,
    },
  };
}

async function reservarCupo(almacen, partes) {
  for (const parte of partes) {
    const uso = await almacen.leerConsumo(parte.alcance, parte.ventana);
    if (uso >= parte.limite) return false;
  }
  const tomados = [];
  for (const parte of partes) {
    const resultado = await almacen.consumir(parte.alcance, parte.ventana, parte.limite);
    if (!resultado?.permitido) {
      for (const previo of tomados) await almacen.devolver(previo.alcance, previo.ventana);
      return false;
    }
    tomados.push(parte);
  }
  return true;
}

function cupos({ usuarioId, ahora, limites, tipo }) {
  const dia = ventanaDia(ahora);
  if (tipo === "busqueda") {
    return [
      { alcance: `busqueda:${usuarioId}`, ventana: ventanaHora(ahora), limite: limites.busquedaHora },
      { alcance: "global", ventana: dia, limite: limites.globalDia },
    ];
  }
  return [
    { alcance: `clima:${usuarioId}`, ventana: dia, limite: limites.usuarioDia },
    { alcance: "global", ventana: dia, limite: limites.globalDia },
  ];
}

function leerClave(env) {
  if (env && env !== process.env) {
    return String(env.WEATHERAPI_KEY || env.WEATHERAPI_API_KEY || "").trim();
  }
  return String(process.env.WEATHERAPI_KEY || process.env.WEATHERAPI_API_KEY || "").trim();
}

export async function obtenerPronostico({
  latitud,
  longitud,
  usuarioId,
  zonaConocida = "",
  ahora = Date.now(),
  fetchImpl = fetch,
  almacen = almacenCompartido(),
  env = process.env,
  umbrales = umbralesClima(env),
} = {}) {
  const coordenadas = coordenadaValida(latitud, longitud);
  if (!coordenadas) return fallo("ubicacion_invalida");
  const clave = leerClave(env);
  if (!clave) return fallo("sin_configuracion");
  if (!usuarioId) return fallo("sin_sesion");

  const limites = limitesClima(env);
  const cacheClave = clavePronostico(coordenadas.latitud, coordenadas.longitud);
  const guardado = climaGuardadoValido(await almacen.leer(cacheClave, ahora));
  if (guardado) return { ok: true, desdeCache: true, clima: presentar(guardado, umbrales, guardado.consultaEn) };

  const pedido = await pedirPronostico({
    clave,
    latitud,
    longitud,
    almacen,
    usuarioId,
    ahora,
    limites,
    fetchImpl,
  });
  if (pedido.codigo) return fallo(pedido.codigo);

  const normalizado = normalizarPronostico(pedido.cuerpo, {
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    incluirAlertas: pedido.incluirAlertas,
    zonaConocida,
  });
  if (!normalizado) return fallo("respuesta_invalida");

  const consultaEn = new Date(ahora).toISOString();
  const almacenable = { ...normalizado, consultaEn };
  await almacen.guardar(cacheClave, almacenable, ahora, ahora + TTL_PRONOSTICO_MS);
  return { ok: true, desdeCache: false, clima: presentar(almacenable, umbrales, consultaEn) };
}

function combinacionesPronostico() {
  const pedidos = [
    { dias: DIAS_PRONOSTICO, alertas: true },
    { dias: DIAS_PRONOSTICO, alertas: false },
  ];
  if (DIAS_PRONOSTICO > 3) {
    pedidos.push({ dias: 3, alertas: true }, { dias: 3, alertas: false });
  }
  return pedidos;
}

async function pedirPronostico({ clave, latitud, longitud, almacen, usuarioId, ahora, limites, fetchImpl }) {
  let ultimo = null;
  for (const combinacion of combinacionesPronostico()) {
    const resultado = await pedir({
      almacen,
      usuarioId,
      ahora,
      limites,
      tipo: "pronostico",
      url: crearConsultaPronostico({ clave, latitud, longitud, ...combinacion }),
      fetchImpl,
    });
    if (resultado.codigo) return resultado.codigo === "limite" ? resultado : { codigo: "proveedor" };
    if (resultado.ok) return { cuerpo: resultado.cuerpo, incluirAlertas: combinacion.alertas };
    ultimo = resultado;
    if (resultado.fallo !== "sin_acceso") return { codigo: resultado.fallo || "proveedor" };
  }
  return { codigo: ultimo?.fallo || "proveedor" };
}

async function pedir({ almacen, usuarioId, ahora, limites, tipo, url, fetchImpl }) {
  const habilitado = await reservarCupo(almacen, cupos({ usuarioId, ahora, limites, tipo }));
  if (!habilitado) return { codigo: "limite" };
  const consulta = await consultarProveedor(url, fetchImpl);
  if (consulta.codigo === "proveedor" || consulta.codigo === "respuesta_invalida") {
    return { ok: false, fallo: consulta.codigo };
  }
  if (!consulta.ok) return { ok: false, fallo: clasificarFallo(consulta.status, consulta.cuerpo) };
  return { ok: true, cuerpo: consulta.cuerpo };
}

export async function buscarLocalidades({
  consulta,
  usuarioId,
  ahora = Date.now(),
  fetchImpl = fetch,
  almacen = almacenCompartido(),
  env = process.env,
} = {}) {
  const texto = consultaValida(consulta);
  if (!texto) return fallo("consulta_invalida");
  const clave = leerClave(env);
  if (!clave) return fallo("sin_configuracion");
  if (!usuarioId) return fallo("sin_sesion");

  const cacheClave = claveBusqueda(texto);
  const guardado = await almacen.leer(cacheClave, ahora);
  const lugaresGuardados = Array.isArray(guardado) ? normalizarBusqueda(guardado.map(lugarCrudo)) : null;
  if (lugaresGuardados?.length) {
    return { ok: true, lugares: lugaresGuardados, desdeCache: true };
  }

  const pedido = await pedir({
    almacen,
    usuarioId,
    ahora,
    limites: limitesClima(env),
    tipo: "busqueda",
    url: crearConsultaBusqueda({ clave, consulta: texto }),
    fetchImpl,
  });
  if (pedido.codigo) return fallo(pedido.codigo);
  if (!pedido.ok) return fallo(pedido.fallo === "ubicacion_invalida" ? "sin_resultados" : pedido.fallo || "proveedor");

  const lugares = normalizarBusqueda(pedido.cuerpo);
  if (!lugares) return fallo("respuesta_invalida");
  if (!lugares.length) return { ok: true, lugares: [], desdeCache: false, codigo: "sin_resultados", mensaje: mensajeClima("sin_resultados") };

  await almacen.guardar(
    cacheClave,
    lugares.map((lugar) => ({
      id: lugar.id,
      name: lugar.nombre,
      region: lugar.region,
      country: lugar.pais,
      lat: lugar.latitud,
      lon: lugar.longitud,
    })),
    ahora,
    ahora + TTL_BUSQUEDA_MS
  );
  return { ok: true, lugares, desdeCache: false };
}

function lugarCrudo(lugar) {
  return {
    id: lugar.id,
    name: lugar.nombre || lugar.name,
    region: lugar.region,
    country: lugar.pais || lugar.country,
    lat: lugar.latitud ?? lugar.lat,
    lon: lugar.longitud ?? lugar.lon,
  };
}

export async function resolverLugar({ consulta, lugarId, ...resto }) {
  const id = idLugarValido(lugarId);
  if (!id) return fallo("ubicacion_invalida");
  const busqueda = await buscarLocalidades({ consulta, ...resto });
  if (!busqueda.ok) return busqueda;
  const lugar = busqueda.lugares.find((item) => item.id === id);
  if (!lugar) return fallo("ubicacion_invalida");
  return { ok: true, lugar, etiqueta: etiquetaLocalidad(lugar) };
}
