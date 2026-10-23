import { LIMITES_DEMO } from "@/lib/demo/generar-cultivo";
import {
  aplicarCambioEtapa,
  historialCoherente,
  historialInicial,
  validarCambioEtapa,
} from "@/lib/demo/etapas-demo";
import { LIMITE_REGISTROS_DEMO, registroDemoValido } from "@/lib/demo/registros-demo";
import { esEtapa, estadoPorEtapa, fechaValida } from "@/lib/etapas";

export const CLAVE_DEMO = "enflora-demo-v1";
export const VERSION_DEMO = 1;

export const FASES_DEMO = [
  "bienvenida",
  "crear",
  "cultivos",
  "espacio",
  "unidad",
  "planta",
  "registros",
  "historial",
];

const MODULO_POR_FASE = {
  bienvenida: "bienvenida",
  crear: "cultivos",
  cultivos: "cultivos",
  espacio: "cultivos",
  unidad: "cultivos",
  planta: "cultivos",
  registros: "registros",
  historial: "historial",
};

const FASES_DIRECTAS = ["bienvenida", "crear", "cultivos", "registros", "historial"];
const TIPOS_REGISTRO = ["plantas", "ambiente"];

function navegacionVacia() {
  return { espacioId: "", unidadId: "", plantaId: "", registro: null };
}

export function crearEstadoDemo() {
  return {
    version: VERSION_DEMO,
    fase: "bienvenida",
    modulo: "bienvenida",
    navegacion: navegacionVacia(),
    espacios: [],
    unidades: [],
    plantas: [],
    registros: [],
    seguimiento: null,
    guia: { oculta: false },
    conversion: { descartada: false },
    aviso: null,
  };
}

function esObjeto(valor) {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function textoLleno(valor) {
  return typeof valor === "string" && valor.trim() !== "";
}

function depurar(lista, normalizar) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const resultado = [];
  for (const item of lista) {
    const normal = normalizar(item);
    if (!normal || vistos.has(normal.id)) continue;
    vistos.add(normal.id);
    resultado.push(normal);
  }
  return resultado;
}

function normalizarPlanta(item, idsUnidades) {
  if (
    !esObjeto(item) ||
    !textoLleno(item.id) ||
    !textoLleno(item.nombre) ||
    !idsUnidades.has(item.unidad_cultivo_id) ||
    !esEtapa(item.etapa) ||
    !fechaValida(item.fecha_inicio)
  ) {
    return null;
  }
  const planta = { ...item, estado: estadoPorEtapa(item.etapa) };
  return historialCoherente(planta) ? planta : { ...planta, historial: historialInicial(planta) };
}

export function puedeCrearEspacio(estado) {
  return estado.espacios.length < LIMITES_DEMO.espacios;
}

export function puedeRegistrar(estado) {
  return estado.registros.length < LIMITE_REGISTROS_DEMO;
}

function resolverUbicacion(estado, { espacioId, unidadId, plantaId }) {
  const espacio = estado.espacios.find((item) => item.id === espacioId) || null;
  const unidad = espacio
    ? estado.unidades.find((item) => item.id === unidadId && item.espacio_id === espacio.id) || null
    : null;
  const planta = unidad
    ? estado.plantas.find((item) => item.id === plantaId && item.unidad_cultivo_id === unidad.id) || null
    : null;
  return { espacioId: espacio?.id || "", unidadId: unidad?.id || "", plantaId: planta?.id || "" };
}

function normalizarSeleccionRegistro(estado, seleccion) {
  if (!esObjeto(seleccion)) return null;
  const unidad = estado.unidades.find((item) => item.id === seleccion.unidadId);
  if (!unidad) return null;
  const tipo = TIPOS_REGISTRO.includes(seleccion.tipo) ? seleccion.tipo : "plantas";
  const idsUnidad = new Set(
    estado.plantas.filter((planta) => planta.unidad_cultivo_id === unidad.id).map((planta) => planta.id)
  );
  const plantaIds =
    tipo === "plantas" && Array.isArray(seleccion.plantaIds)
      ? [...new Set(seleccion.plantaIds)].filter((id) => idsUnidad.has(id))
      : [];
  let origen = null;
  if (esObjeto(seleccion.origen) && ["unidad", "planta"].includes(seleccion.origen.fase)) {
    const ubicacion = resolverUbicacion(estado, seleccion.origen);
    const valido = seleccion.origen.fase === "planta" ? ubicacion.plantaId : ubicacion.unidadId;
    if (valido) origen = { fase: seleccion.origen.fase, ...ubicacion };
  }
  return { unidadId: unidad.id, tipo, plantaIds, origen };
}

function faseSegura(estado, fase, navegacion) {
  if (!FASES_DEMO.includes(fase)) return "bienvenida";
  if (fase === "planta" && !navegacion.plantaId) return faseSegura(estado, "unidad", navegacion);
  if (fase === "unidad" && !navegacion.unidadId) return faseSegura(estado, "espacio", navegacion);
  if (fase === "espacio" && !navegacion.espacioId) return faseSegura(estado, "cultivos", navegacion);
  if (fase === "cultivos" && !estado.espacios.length) return "crear";
  if (fase === "crear" && !puedeCrearEspacio(estado)) return "cultivos";
  return fase;
}

function irA(estado, fase, navegacion = estado.navegacion, aviso = null) {
  const resuelta = {
    ...resolverUbicacion(estado, navegacion),
    registro: normalizarSeleccionRegistro(estado, navegacion.registro),
  };
  const segura = faseSegura(estado, fase, resuelta);
  return { ...estado, fase: segura, modulo: MODULO_POR_FASE[segura], navegacion: resuelta, aviso };
}

function normalizarAviso(estado, aviso) {
  if (!esObjeto(aviso) || aviso.tipo !== "espacio-creado") return null;
  return estado.espacios.some((item) => item.id === aviso.espacioId)
    ? { tipo: aviso.tipo, espacioId: aviso.espacioId }
    : null;
}

export function normalizarEstadoDemo(valor) {
  if (!esObjeto(valor) || valor.version !== VERSION_DEMO) return null;

  const espacios = depurar(valor.espacios, (item) =>
    esObjeto(item) &&
    textoLleno(item.id) &&
    textoLleno(item.nombre) &&
    (item.tipo === "interior" || item.tipo === "exterior")
      ? item
      : null
  ).slice(0, LIMITES_DEMO.espacios);
  const idsEspacios = new Set(espacios.map((item) => item.id));

  const unidades = depurar(valor.unidades, (item) =>
    esObjeto(item) && textoLleno(item.id) && textoLleno(item.nombre) && idsEspacios.has(item.espacio_id)
      ? item
      : null
  );
  const idsUnidades = new Set(unidades.map((item) => item.id));
  const plantas = depurar(valor.plantas, (item) => normalizarPlanta(item, idsUnidades));

  const base = { ...crearEstadoDemo(), espacios, unidades, plantas };
  const registros = depurar(valor.registros, (item) => (registroDemoValido(item, base) ? item : null)).slice(
    0,
    LIMITE_REGISTROS_DEMO
  );

  const conDatos = {
    ...base,
    registros,
    seguimiento: esObjeto(valor.seguimiento) ? valor.seguimiento : null,
    guia: { oculta: Boolean(valor.guia?.oculta) },
    conversion: { descartada: Boolean(valor.conversion?.descartada) },
  };

  const fase = valor.fase === "preparada" ? "crear" : valor.fase;
  const navegacion = esObjeto(valor.navegacion) ? valor.navegacion : navegacionVacia();
  return irA(conDatos, fase, navegacion, normalizarAviso(conDatos, valor.aviso));
}

export function cultivoAdmisible(estado, cultivo) {
  if (!esObjeto(cultivo) || !esObjeto(cultivo.espacio) || !puedeCrearEspacio(estado)) return false;
  const { espacio, unidades, plantas } = cultivo;
  if (!textoLleno(espacio.id) || !Array.isArray(unidades) || !Array.isArray(plantas) || !unidades.length) {
    return false;
  }

  const existentes = new Set([
    ...estado.espacios.map((item) => item.id),
    ...estado.unidades.map((item) => item.id),
    ...estado.plantas.map((item) => item.id),
  ]);
  const nuevos = [espacio, ...unidades, ...plantas].map((item) => item?.id);
  if (nuevos.some((id) => !textoLleno(id) || existentes.has(id)) || new Set(nuevos).size !== nuevos.length) {
    return false;
  }

  const idsUnidades = new Set(unidades.map((item) => item.id));
  return (
    unidades.every((item) => item.espacio_id === espacio.id) &&
    plantas.every((item) => idsUnidades.has(item.unidad_cultivo_id))
  );
}

function ubicacionDePlanta(estado, plantaId) {
  const planta = estado.plantas.find((item) => item.id === plantaId);
  const unidad = planta ? estado.unidades.find((item) => item.id === planta.unidad_cultivo_id) : null;
  return {
    espacioId: unidad?.espacio_id || "",
    unidadId: unidad?.id || "",
    plantaId: planta?.id || "",
  };
}

function ubicacionDeUnidad(estado, unidadId) {
  const unidad = estado.unidades.find((item) => item.id === unidadId);
  return { espacioId: unidad?.espacio_id || "", unidadId: unidad?.id || "", plantaId: "" };
}

function atras(estado) {
  const { fase, navegacion } = estado;
  if (fase === "planta") return irA(estado, "unidad", { ...navegacion, plantaId: "" });
  if (fase === "unidad") return irA(estado, "espacio", { ...navegacion, unidadId: "", plantaId: "" });
  if (fase === "espacio") return irA(estado, "cultivos", { ...navegacion, unidadId: "", plantaId: "" });
  if (fase === "registros" && navegacion.registro?.origen) {
    const { origen } = navegacion.registro;
    return irA(estado, origen.fase, { ...origen, registro: null });
  }
  if (fase === "crear") return irA(estado, estado.espacios.length ? "cultivos" : "bienvenida");
  return irA(estado, "cultivos", { ...navegacion, registro: null });
}

function registroAdmisible(estado, registro) {
  return (
    puedeRegistrar(estado) &&
    !estado.registros.some((item) => item.id === registro?.id) &&
    registroDemoValido(registro, estado)
  );
}

export function reducirDemo(estado, accion) {
  switch (accion.type) {
    case "HIDRATAR":
      return normalizarEstadoDemo(accion.estado) || estado;
    case "COMENZAR":
      return irA(estado, estado.espacios.length ? "cultivos" : "crear");
    case "IR":
      if (!FASES_DIRECTAS.includes(accion.fase)) return estado;
      return irA(estado, accion.fase, { ...estado.navegacion, registro: null });
    case "VOLVER":
      return irA(estado, "bienvenida");
    case "ATRAS":
      return atras(estado);
    case "VER_ESPACIO":
      if (!estado.espacios.some((item) => item.id === accion.espacioId)) return estado;
      return irA(estado, "espacio", { espacioId: accion.espacioId, unidadId: "", plantaId: "", registro: null });
    case "VER_UNIDAD": {
      const ubicacion = ubicacionDeUnidad(estado, accion.unidadId);
      if (!ubicacion.unidadId) return estado;
      return irA(estado, "unidad", { ...ubicacion, registro: null });
    }
    case "VER_PLANTA": {
      const ubicacion = ubicacionDePlanta(estado, accion.plantaId);
      if (!ubicacion.plantaId) return estado;
      return irA(estado, "planta", { ...ubicacion, registro: null });
    }
    case "AGREGAR_CULTIVO": {
      if (!cultivoAdmisible(estado, accion.cultivo)) return estado;
      const { espacio, unidades, plantas } = accion.cultivo;
      const siguiente = {
        ...estado,
        espacios: [...estado.espacios, espacio],
        unidades: [...estado.unidades, ...unidades],
        plantas: [...estado.plantas, ...plantas],
      };
      return irA(
        siguiente,
        "espacio",
        { espacioId: espacio.id, unidadId: "", plantaId: "", registro: null },
        { tipo: "espacio-creado", espacioId: espacio.id }
      );
    }
    case "CAMBIAR_ETAPA": {
      const planta = estado.plantas.find((item) => item.id === accion.plantaId);
      if (validarCambioEtapa(planta, accion.etapa, accion.fecha, accion.hoy)) return estado;
      return {
        ...estado,
        plantas: estado.plantas.map((item) =>
          item.id === planta.id ? aplicarCambioEtapa(item, accion.etapa, accion.fecha) : item
        ),
      };
    }
    case "REGISTRAR_DESDE": {
      if (!estado.unidades.some((item) => item.id === accion.unidadId)) return estado;
      const origen = ["unidad", "planta"].includes(estado.fase)
        ? { fase: estado.fase, ...resolverUbicacion(estado, estado.navegacion) }
        : null;
      return irA(estado, "registros", {
        ...estado.navegacion,
        registro: { unidadId: accion.unidadId, tipo: accion.tipo, plantaIds: accion.plantaIds || [], origen },
      });
    }
    case "AGREGAR_REGISTRO":
      if (!registroAdmisible(estado, accion.registro)) return estado;
      return { ...estado, registros: [...estado.registros, accion.registro] };
    case "EDITAR_REGISTRO": {
      const anterior = estado.registros.find((item) => item.id === accion.registro?.id);
      if (!anterior || !registroDemoValido(accion.registro, estado)) return estado;
      const registro = { ...accion.registro, fecha_creacion: anterior.fecha_creacion };
      return {
        ...estado,
        registros: estado.registros.map((item) => (item.id === registro.id ? registro : item)),
      };
    }
    case "OCULTAR_GUIA":
      return { ...estado, guia: { oculta: true } };
    case "MOSTRAR_GUIA":
      return { ...estado, guia: { oculta: false } };
    case "DESCARTAR_CONVERSION":
      return { ...estado, conversion: { descartada: true } };
    case "REINICIAR":
      return crearEstadoDemo();
    default:
      return estado;
  }
}

export function siguienteSecuencia(estado) {
  const usados = estado.espacios
    .map((item) => Number(/^demo-espacio-(\d+)$/.exec(item.id)?.[1]))
    .filter(Number.isInteger);
  return (usados.length ? Math.max(...usados) : 0) + 1;
}

export function pasosGuia(estado) {
  return [
    { id: "espacio", titulo: "Creá tu espacio", hecho: estado.espacios.length > 0 },
    {
      id: "etapa",
      titulo: "Explorá una planta y cambiá su etapa",
      hecho: estado.plantas.some((planta) => (planta.historial || []).length > 1),
    },
    { id: "registro", titulo: "Registrá tu primera actividad", hecho: estado.registros.length > 0 },
  ];
}
