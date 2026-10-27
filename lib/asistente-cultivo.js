import { etiquetaEtapa, fechaHoy, fechaValida } from "@/lib/etapas";
import { esMetodoBase, estadoTrasMetodo, muestraSustrato } from "@/lib/metodos";
import {
  MAXIMO_PLANTAS,
  MAXIMO_UNIDADES,
  admiteVarias,
  mensajeReduccionUnidades,
  nombreSugerido,
  nombreUnidad,
} from "@/lib/unidades";

export const PASOS_VISIBLES = [
  { id: "espacio", etiqueta: "Espacio" },
  { id: "unidades", etiqueta: "Unidades" },
  { id: "cantidad", etiqueta: "Cantidad" },
  { id: "plantas", etiqueta: "Plantas" },
  { id: "etapa", etiqueta: "Etapa" },
  { id: "unidad", etiqueta: "Unidad" },
  { id: "resumen", etiqueta: "Resumen" },
];

const PALETA = ["#0B3D2A", "#397258", "#18543B", "#6B8F3C", "#3D6B8A", "#8A5A2B"];

export function estadoInicial() {
  return {
    paso: "espacio",
    nombre: "",
    tipo: "",
    tipoUnidad: "",
    tipoPersonalizado: "",
    soloUnidad: false,
    espacioId: "",
    ocupadas: null,
    cantidadUnidades: 1,
    cantidadPlantas: 1,
    unidades: [],
    indice: 0,
    replicar: false,
    replicarIndices: [],
    error: "",
    confirmacion: null,
  };
}

export function plantaVacia() {
  return {
    genetica: "",
    metodo: "",
    metodoNombre: "",
    usaSustrato: "",
    sustrato: "",
    etapa: "",
    fechaInicioEtapa: "",
  };
}

function unidadNueva(tipo, numero, tipoPersonalizado = "", cantidad = 1) {
  return {
    nombre: nombreUnidad(tipo, numero, tipoPersonalizado, cantidad),
    tipo,
    tipoPersonalizado: tipo === "otro" ? String(tipoPersonalizado || "").trim() : "",
    numero,
    estado: "pendiente",
    modo: "diferente",
    general: { genetica: "", metodo: "", metodoNombre: "", usaSustrato: "", sustrato: "" },
    modoEtapa: "misma",
    etapaGeneral: "",
    fechaEtapaGeneral: "",
    plantas: [],
  };
}

export function metodoDePlanta(planta) {
  if (!planta) return "";
  if (planta.metodo === "otro") return String(planta.metodoNombre || "").trim();
  return String(planta.metodo || "").trim();
}

export function visibleDe(paso) {
  if (paso === "espacio") return "espacio";
  if (paso === "tipo_unidad" || paso === "cantidad_unidades") return "unidades";
  if (paso === "cantidad_plantas") return "cantidad";
  if (paso === "configuracion") return "plantas";
  if (paso === "etapa") return "etapa";
  if (paso === "cierre_unidad") return "unidad";
  return "resumen";
}

function usaGenetica(modo) {
  return modo === "misma_genetica" || modo === "misma_genetica_y_metodo";
}

function usaMetodo(modo) {
  return modo === "mismo_metodo" || modo === "misma_genetica_y_metodo";
}

function plantaTieneDatos(planta) {
  return Boolean(
    String(planta.genetica || "").trim() ||
      planta.metodo ||
      String(planta.metodoNombre || "").trim() ||
      String(planta.sustrato || "").trim() ||
      planta.etapa
  );
}

function unidadTieneDatos(unidad, cantidad) {
  if (unidad.estado === "completada") return true;
  const automatico = nombreUnidad(unidad.tipo, unidad.numero, unidad.tipoPersonalizado, cantidad);
  if (unidad.nombre !== automatico) return true;
  return unidad.plantas.some(plantaTieneDatos);
}

function limpiar(estado, cambios) {
  return { ...estado, error: "", confirmacion: null, ...cambios };
}

function mapUnidad(estado, indice, cambiar) {
  return {
    ...estado,
    error: "",
    confirmacion: null,
    unidades: estado.unidades.map((unidad, i) => (i === indice ? cambiar(unidad) : unidad)),
  };
}

function valorDeLaPrimera(plantas, campo) {
  const primera = String(plantas[0]?.[campo] || "");
  if (primera.trim()) return primera;
  const conValor = plantas.find((planta) => String(planta[campo] || "").trim());
  return conValor ? conValor[campo] : "";
}

function redimensionarUnidades(unidades, tipo, cantidad, tipoPersonalizado) {
  const previa = unidades.length;
  const personalizado = String(tipoPersonalizado || "").trim();
  const lista = unidades.slice(0, cantidad).map((unidad) => ({ ...unidad }));

  while (lista.length < cantidad) {
    lista.push(unidadNueva(tipo, lista.length + 1, personalizado, cantidad));
  }

  return lista.map((unidad, indice) => {
    const numero = indice + 1;
    const autoAntes = nombreUnidad(
      unidad.tipo || tipo,
      unidad.numero || numero,
      unidad.tipoPersonalizado || personalizado,
      previa || 1
    );
    const autoAhora = nombreUnidad(tipo, numero, personalizado, cantidad);
    const sigueAutomatico = !unidad.nombre || unidad.nombre === autoAntes || unidad.nombre === autoAhora;

    return {
      ...unidad,
      tipo,
      numero,
      tipoPersonalizado: tipo === "otro" ? personalizado : "",
      nombre: sigueAutomatico ? autoAhora : unidad.nombre,
    };
  });
}

function plantaPrecargada(unidad) {
  const planta = plantaVacia();
  if (usaGenetica(unidad.modo)) planta.genetica = unidad.general.genetica;
  if (usaMetodo(unidad.modo)) {
    planta.metodo = unidad.general.metodo;
    planta.metodoNombre = unidad.general.metodoNombre;
    planta.usaSustrato = unidad.general.usaSustrato || "";
    if (muestraSustrato(planta.metodo, planta.usaSustrato)) {
      planta.sustrato = unidad.general.sustrato || "";
    }
  }
  if (unidad.modoEtapa === "misma") {
    planta.etapa = unidad.etapaGeneral;
    planta.fechaInicioEtapa = unidad.fechaEtapaGeneral;
  }
  return planta;
}

function asegurarFechasEtapa(unidad) {
  const hoy = fechaHoy();
  const general = unidad.fechaEtapaGeneral || hoy;
  return {
    ...unidad,
    fechaEtapaGeneral: general,
    plantas: unidad.plantas.map((planta) => ({
      ...planta,
      fechaInicioEtapa: planta.fechaInicioEtapa || (unidad.modoEtapa === "misma" ? general : hoy),
    })),
  };
}

function redimensionarPlantas(unidad, cantidad) {
  const plantas = unidad.plantas.slice(0, cantidad).map((planta) => ({ ...planta }));
  while (plantas.length < cantidad) {
    plantas.push(plantaPrecargada(unidad));
  }
  return plantas;
}

export function entrarCantidadPlantas(estado, indice) {
  const unidad = estado.unidades[indice];
  if (!unidad) return estado;
  return limpiar(estado, {
    paso: "cantidad_plantas",
    indice,
    cantidadPlantas: unidad.plantas.length || 1,
    replicar: false,
    replicarIndices: [],
  });
}

function indicePendiente(unidades) {
  return unidades.findIndex((unidad) => unidad.estado !== "completada");
}

function irAPlantasOResumen(estado, unidades) {
  const pendiente = indicePendiente(unidades);
  if (pendiente === -1) {
    return limpiar(estado, { unidades, paso: "resumen", replicar: false, replicarIndices: [] });
  }
  return entrarCantidadPlantas({ ...estado, unidades }, pendiente);
}

export function cambiarNombreEspacio(estado, nombre) {
  return limpiar(estado, { nombre });
}

export function cambiarTipoEspacio(estado, tipo) {
  if (tipo === estado.tipo) return estado;
  if (estado.unidades.length > 0) {
    return {
      ...estado,
      tipo,
      error: "",
      confirmacion: {
        accion: "cambiar_tipo_espacio",
        anterior: estado.tipo,
        mensaje: "Al cambiar el tipo de espacio se eliminará la configuración de las unidades.",
      },
    };
  }
  return limpiar(estado, { tipo, tipoUnidad: "", tipoPersonalizado: "" });
}

export function estadoInicialUnidad(espacio) {
  return {
    ...estadoInicial(),
    paso: "tipo_unidad",
    nombre: espacio.nombre,
    tipo: espacio.tipo,
    soloUnidad: true,
    espacioId: espacio.id,
    ocupadas: espacio.ocupadas,
  };
}

export function cambiarTipoUnidad(estado, tipoUnidad) {
  if (tipoUnidad === estado.tipoUnidad) return estado;
  if (estado.unidades.length > 0) {
    return {
      ...estado,
      tipoUnidad,
      error: "",
      confirmacion: {
        accion: "cambiar_tipo_unidad",
        anterior: estado.tipoUnidad,
        tipoPersonalizadoAnterior: estado.tipoPersonalizado,
        mensaje: "Al cambiar el tipo de unidad se eliminará la configuración de las unidades.",
      },
    };
  }
  return limpiar(estado, {
    tipoUnidad,
    tipoPersonalizado: tipoUnidad === "otro" ? estado.tipoPersonalizado : "",
  });
}

export function cambiarTipoPersonalizado(estado, valor) {
  const anterior = estado.tipoPersonalizado;
  const cantidad = estado.unidades.length || estado.cantidadUnidades || 1;
  const unidades = estado.unidades.map((unidad) => {
    if (unidad.tipo !== "otro") return unidad;
    const auto = nombreUnidad("otro", unidad.numero, anterior, cantidad);
    const nombre = unidad.nombre === auto ? nombreUnidad("otro", unidad.numero, valor, cantidad) : unidad.nombre;
    return { ...unidad, tipoPersonalizado: valor, nombre };
  });
  return limpiar(estado, { tipoPersonalizado: valor, unidades });
}

export function cambiarCantidadUnidades(estado, cantidad) {
  if (cantidad < 1 || cantidad > MAXIMO_UNIDADES) return estado;
  return limpiar(estado, { cantidadUnidades: cantidad });
}

export function cambiarCantidadPlantas(estado, cantidad) {
  if (cantidad < 1 || cantidad > MAXIMO_PLANTAS) return estado;
  return limpiar(estado, { cantidadPlantas: cantidad });
}

export function cambiarNombreUnidad(estado, nombre) {
  return mapUnidad(estado, estado.indice, (unidad) => ({ ...unidad, nombre }));
}

export function cambiarModo(estado, modo) {
  return mapUnidad(estado, estado.indice, (unidad) => {
    let general = { ...unidad.general };
    let plantas = unidad.plantas.map((planta) => ({ ...planta }));

    if (usaGenetica(modo)) {
      const genetica = valorDeLaPrimera(plantas, "genetica") || general.genetica;
      general = { ...general, genetica };
      plantas = plantas.map((planta) => ({ ...planta, genetica }));
    }

    if (usaMetodo(modo)) {
      const metodo = valorDeLaPrimera(plantas, "metodo") || general.metodo;
      const metodoNombre = valorDeLaPrimera(plantas, "metodoNombre") || general.metodoNombre;
      const usaSustrato = valorDeLaPrimera(plantas, "usaSustrato") || general.usaSustrato;
      const sustrato = valorDeLaPrimera(plantas, "sustrato") || general.sustrato;
      general = { ...general, metodo, metodoNombre, usaSustrato, sustrato };
      plantas = plantas.map((planta) => ({
        ...planta,
        metodo,
        metodoNombre,
        usaSustrato,
        sustrato: muestraSustrato(metodo, usaSustrato) ? sustrato : "",
      }));
    }

    return { ...unidad, modo, general, plantas };
  });
}

export function cambiarGeneral(estado, campo, valor) {
  return mapUnidad(estado, estado.indice, (unidad) => {
    if (campo === "metodo" && usaMetodo(unidad.modo)) {
      const general = estadoTrasMetodo(unidad.general, valor);
      const plantas = unidad.plantas.map((planta) => {
        const next = estadoTrasMetodo(planta, valor);
        if (muestraSustrato(next.metodo, next.usaSustrato)) {
          return { ...next, sustrato: general.sustrato || "" };
        }
        return next;
      });
      return { ...unidad, general, plantas };
    }

    if (campo === "usaSustrato" && usaMetodo(unidad.modo)) {
      const general = {
        ...unidad.general,
        usaSustrato: valor,
        sustrato: valor === "si" ? unidad.general.sustrato : "",
      };
      const plantas = unidad.plantas.map((planta) => {
        if (planta.metodo !== general.metodo) return planta;
        return {
          ...planta,
          usaSustrato: valor,
          sustrato: valor === "si" ? general.sustrato : "",
        };
      });
      return { ...unidad, general, plantas };
    }

    if (campo === "sustrato" && usaMetodo(unidad.modo)) {
      const general = { ...unidad.general, sustrato: valor };
      const plantas = unidad.plantas.map((planta) =>
        muestraSustrato(planta.metodo, planta.usaSustrato) ? { ...planta, sustrato: valor } : planta
      );
      return { ...unidad, general, plantas };
    }

    const general = { ...unidad.general, [campo]: valor };
    const plantas = unidad.plantas.map((planta) => {
      if (campo === "genetica" && usaGenetica(unidad.modo)) {
        return { ...planta, genetica: valor };
      }
      if (campo === "metodoNombre" && usaMetodo(unidad.modo)) {
        return { ...planta, metodoNombre: valor };
      }
      return planta;
    });

    return { ...unidad, general, plantas };
  });
}

export function cambiarPlanta(estado, indicePlanta, campo, valor) {
  return mapUnidad(estado, estado.indice, (unidad) => ({
    ...unidad,
    plantas: unidad.plantas.map((planta, i) => {
      if (i !== indicePlanta) return planta;
      if (campo === "metodo") return estadoTrasMetodo(planta, valor);
      if (campo === "usaSustrato") {
        return {
          ...planta,
          usaSustrato: valor,
          sustrato: valor === "si" ? planta.sustrato : "",
        };
      }
      return { ...planta, [campo]: valor };
    }),
  }));
}

export function cambiarModoEtapa(estado, modoEtapa) {
  return mapUnidad(estado, estado.indice, (unidad) => {
    if (modoEtapa !== "misma") return { ...unidad, modoEtapa };
    const etapa = unidad.etapaGeneral || unidad.plantas.find((planta) => planta.etapa)?.etapa || "";
    const fecha =
      unidad.fechaEtapaGeneral ||
      unidad.plantas.find((planta) => planta.fechaInicioEtapa)?.fechaInicioEtapa ||
      fechaHoy();
    return {
      ...unidad,
      modoEtapa,
      etapaGeneral: etapa,
      fechaEtapaGeneral: fecha,
      plantas: unidad.plantas.map((planta) => ({ ...planta, etapa, fechaInicioEtapa: fecha })),
    };
  });
}

export function cambiarEtapaGeneral(estado, etapa) {
  return mapUnidad(estado, estado.indice, (unidad) => ({
    ...unidad,
    etapaGeneral: etapa,
    plantas: unidad.plantas.map((planta) => ({ ...planta, etapa })),
  }));
}

export function cambiarFechaEtapaGeneral(estado, fecha) {
  return mapUnidad(estado, estado.indice, (unidad) => ({
    ...unidad,
    fechaEtapaGeneral: fecha,
    plantas: unidad.plantas.map((planta) => ({ ...planta, fechaInicioEtapa: fecha })),
  }));
}

export function cambiarReplicar(estado, marcado) {
  if (!marcado) return limpiar(estado, { replicar: false, replicarIndices: [] });
  return limpiar(estado, { replicar: true });
}

export function cambiarReplicarIndice(estado, indice, marcado) {
  const indices = new Set(estado.replicarIndices);
  if (marcado) indices.add(indice);
  else indices.delete(indice);
  return limpiar(estado, {
    replicarIndices: [...indices].sort((a, b) => a - b),
  });
}

export function cambiarTodasSiguientes(estado, marcado) {
  if (!marcado) return limpiar(estado, { replicarIndices: [] });
  const replicarIndices = estado.unidades.map((_, indice) => indice).filter((indice) => indice > 0);
  return limpiar(estado, { replicar: true, replicarIndices });
}

export function abrirUnidad(estado, indice) {
  const unidad = estado.unidades[indice];
  if (!unidad || unidad.estado !== "completada") return estado;
  if (indice === estado.indice && estado.paso !== "resumen") return estado;
  return limpiar(estado, { indice, paso: "configuracion" });
}

export function irAVisible(estado, visible) {
  if (estado.confirmacion) return estado;
  if (estado.soloUnidad && visible === "espacio") return estado;
  const orden = PASOS_VISIBLES.map((paso) => paso.id);
  if (orden.indexOf(visible) > orden.indexOf(visibleDe(estado.paso))) return estado;
  if (visible === "espacio") return limpiar(estado, { paso: "espacio" });
  if (visible === "unidades") return limpiar(estado, { paso: "tipo_unidad" });
  if (visible === "cantidad") return entrarCantidadPlantas(estado, estado.indice);
  if (visible === "plantas") return limpiar(estado, { paso: "configuracion" });
  if (visible === "etapa") return limpiar(estado, { paso: "etapa" });
  if (visible === "unidad") return limpiar(estado, { paso: "cierre_unidad" });
  return limpiar(estado, { paso: "resumen" });
}

function nombreUnidadActual(estado) {
  return String(estado.unidades[estado.indice]?.nombre || "").trim();
}

function continuarEspacio(estado) {
  if (!estado.nombre.trim()) {
    return { ...estado, error: "El nombre es obligatorio." };
  }
  if (estado.tipo !== "interior" && estado.tipo !== "exterior") {
    return { ...estado, error: "Seleccioná un tipo de espacio." };
  }
  return limpiar(estado, { paso: "tipo_unidad" });
}

function continuarTipo(estado) {
  if (!estado.tipoUnidad) {
    return { ...estado, error: "Seleccioná un tipo de unidad." };
  }
  if (estado.tipoUnidad === "otro" && !String(estado.tipoPersonalizado || "").trim()) {
    return {
      ...estado,
      error: estado.tipo === "exterior" ? "Escribí el nombre del método." : "Escribí el tipo de unidad.",
    };
  }
  if (estado.soloUnidad) {
    if ((estado.ocupadas?.total || 0) >= MAXIMO_UNIDADES) {
      return { ...estado, error: "Se pueden crear hasta 20 unidades." };
    }
    if (estado.tipoUnidad === "sala" && estado.ocupadas?.sala) {
      return { ...estado, error: "Este espacio ya tiene una sala." };
    }
    if (estado.tipoUnidad === "aire_libre" && estado.ocupadas?.aire_libre) {
      return { ...estado, error: "Este espacio ya tiene aire libre." };
    }
    const personalizado = String(estado.tipoPersonalizado || "").trim();
    const unidad = {
      ...unidadNueva(estado.tipoUnidad, 1, personalizado, 1),
      nombre: nombreSugerido(estado.tipoUnidad, {
        carpas: estado.ocupadas?.carpas || 0,
        invernaderos: estado.ocupadas?.invernaderos || 0,
        tipoPersonalizado: personalizado,
      }),
    };
    return entrarCantidadPlantas({ ...estado, unidades: [unidad], cantidadUnidades: 1 }, 0);
  }
  if (admiteVarias(estado.tipoUnidad)) {
    const cantidadUnidades = estado.unidades.length || estado.cantidadUnidades || 1;
    return limpiar(estado, { paso: "cantidad_unidades", cantidadUnidades });
  }

  const previa = estado.unidades[0];
  const unidad =
    previa && previa.tipo === estado.tipoUnidad
      ? { ...previa, numero: 1 }
      : unidadNueva(estado.tipoUnidad, 1);
  return entrarCantidadPlantas({ ...estado, unidades: [unidad], cantidadUnidades: 1 }, 0);
}

function continuarCantidadUnidades(estado) {
  const cantidad = estado.cantidadUnidades;
  if (cantidad < 1 || cantidad > MAXIMO_UNIDADES) {
    return { ...estado, error: "Se pueden crear hasta 20 unidades." };
  }

  const quitadas = estado.unidades.slice(cantidad).filter((unidad) => unidadTieneDatos(unidad, estado.unidades.length));
  if (quitadas.length) {
    return {
      ...estado,
      error: "",
      confirmacion: {
        accion: "reducir_unidades",
        cantidad,
        mensaje: mensajeReduccionUnidades(
          estado.tipoUnidad,
          quitadas.map((unidad) => unidad.nombre)
        ),
      },
    };
  }

  const unidades = redimensionarUnidades(
    estado.unidades,
    estado.tipoUnidad,
    cantidad,
    estado.tipoPersonalizado
  );
  return irAPlantasOResumen(estado, unidades);
}

function continuarCantidadPlantas(estado) {
  if (!nombreUnidadActual(estado)) {
    return { ...estado, error: "El nombre es obligatorio." };
  }

  const cantidad = estado.cantidadPlantas;
  if (cantidad < 1 || cantidad > MAXIMO_PLANTAS) {
    return { ...estado, error: "Se pueden crear hasta 100 plantas." };
  }

  const unidad = estado.unidades[estado.indice];
  const quitadas = unidad.plantas.slice(cantidad).filter(plantaTieneDatos);
  if (quitadas.length) {
    return {
      ...estado,
      error: "",
      confirmacion: {
        accion: "reducir_plantas",
        cantidad,
        mensaje: "Al reducir la cantidad de plantas se eliminará la configuración de las plantas que queden fuera.",
      },
    };
  }

  return mapUnidad(
    { ...estado, paso: "configuracion" },
    estado.indice,
    (actual) => ({ ...actual, plantas: redimensionarPlantas(actual, cantidad) })
  );
}

function continuarConfiguracion(estado) {
  if (!nombreUnidadActual(estado)) {
    return { ...estado, error: "El nombre es obligatorio." };
  }

  const unidad = estado.unidades[estado.indice];
  const incompleto = unidad.plantas.some(
    (planta) => planta.metodo === "otro" && !String(planta.metodoNombre || "").trim()
  );
  const generalIncompleto =
    usaMetodo(unidad.modo) &&
    unidad.general.metodo === "otro" &&
    !String(unidad.general.metodoNombre || "").trim();

  if (incompleto || generalIncompleto) {
    return { ...estado, error: "Escribí el nombre del método." };
  }

  return mapUnidad(limpiar(estado, { paso: "etapa" }), estado.indice, asegurarFechasEtapa);
}

function continuarEtapa(estado) {
  if (!nombreUnidadActual(estado)) {
    return { ...estado, error: "El nombre es obligatorio." };
  }

  const unidad = estado.unidades[estado.indice];
  if (unidad.modoEtapa === "misma") {
    if (!unidad.etapaGeneral) {
      return { ...estado, error: "Seleccioná una etapa." };
    }
    if (!fechaValida(unidad.fechaEtapaGeneral)) {
      return { ...estado, error: "Seleccioná la fecha de inicio de la etapa." };
    }
  } else if (unidad.plantas.some((planta) => !planta.etapa)) {
    return { ...estado, error: "Seleccioná una etapa." };
  } else if (unidad.plantas.some((planta) => !fechaValida(planta.fechaInicioEtapa))) {
    return { ...estado, error: "Seleccioná la fecha de inicio de la etapa." };
  }

  const conEtapa = mapUnidad(estado, estado.indice, (actual) => {
    if (actual.modoEtapa !== "misma") return { ...actual, estado: "completada" };
    return {
      ...actual,
      estado: "completada",
      plantas: actual.plantas.map((planta) => ({
        ...planta,
        etapa: actual.etapaGeneral,
        fechaInicioEtapa: actual.fechaEtapaGeneral,
      })),
    };
  });

  return limpiar(conEtapa, { paso: "cierre_unidad", replicar: false, replicarIndices: [] });
}

function copiarEn(unidades, origenIndice, destinos) {
  const origen = unidades[origenIndice];
  return unidades.map((unidad, indice) => {
    if (!destinos.includes(indice) || indice === origenIndice) return unidad;
    return {
      ...unidad,
      estado: "completada",
      modo: origen.modo,
      general: { ...origen.general },
      modoEtapa: origen.modoEtapa,
      etapaGeneral: origen.etapaGeneral,
      fechaEtapaGeneral: origen.fechaEtapaGeneral,
      plantas: origen.plantas.map((planta) => ({ ...planta })),
    };
  });
}

function continuarCierre(estado) {
  if (!nombreUnidadActual(estado)) {
    return { ...estado, error: "El nombre es obligatorio." };
  }

  if (estado.indice === 0 && estado.replicar) {
    if (!estado.replicarIndices.length) {
      return { ...estado, error: "Seleccioná una unidad." };
    }

    const conDatos = estado.replicarIndices.filter((indice) =>
      unidadTieneDatos(estado.unidades[indice], estado.unidades.length)
    );
    if (conDatos.length && estado.confirmacion?.accion !== "replicar") {
      const nombres = conDatos.map((indice) => estado.unidades[indice].nombre);
      return {
        ...estado,
        error: "",
        confirmacion: {
          accion: "replicar",
          mensaje: `Al replicar se reemplazará la configuración de ${nombres.join(", ")}.`,
        },
      };
    }
  }

  const unidades =
    estado.indice === 0 && estado.replicar
      ? copiarEn(estado.unidades, 0, estado.replicarIndices)
      : estado.unidades;

  return irAPlantasOResumen({ ...estado, replicar: false, replicarIndices: [] }, unidades);
}

export function continuar(estado) {
  if (estado.confirmacion) return estado;
  if (estado.paso === "espacio") return continuarEspacio(estado);
  if (estado.paso === "tipo_unidad") return continuarTipo(estado);
  if (estado.paso === "cantidad_unidades") return continuarCantidadUnidades(estado);
  if (estado.paso === "cantidad_plantas") return continuarCantidadPlantas(estado);
  if (estado.paso === "configuracion") return continuarConfiguracion(estado);
  if (estado.paso === "etapa") return continuarEtapa(estado);
  if (estado.paso === "cierre_unidad") return continuarCierre(estado);
  return estado;
}

export function volver(estado) {
  if (estado.confirmacion) return cancelarConfirmacion(estado);
  if (estado.paso === "resumen") {
    const indice = estado.unidades.length - 1;
    return limpiar(estado, { paso: "cierre_unidad", indice });
  }
  if (estado.paso === "cierre_unidad") return limpiar(estado, { paso: "etapa" });
  if (estado.paso === "etapa") return limpiar(estado, { paso: "configuracion" });
  if (estado.paso === "configuracion") return entrarCantidadPlantas(estado, estado.indice);
  if (estado.paso === "cantidad_plantas") {
    if (estado.indice > 0) {
      return limpiar(estado, { paso: "cierre_unidad", indice: estado.indice - 1 });
    }
    if (estado.soloUnidad) return limpiar(estado, { paso: "tipo_unidad" });
    if (admiteVarias(estado.tipoUnidad)) {
      return limpiar(estado, {
        paso: "cantidad_unidades",
        cantidadUnidades: estado.unidades.length || estado.cantidadUnidades,
      });
    }
    return limpiar(estado, { paso: "tipo_unidad" });
  }
  if (estado.paso === "cantidad_unidades") return limpiar(estado, { paso: "tipo_unidad" });
  if (estado.paso === "tipo_unidad") {
    if (estado.soloUnidad) return estado;
    return limpiar(estado, { paso: "espacio" });
  }
  return estado;
}

export function cancelarConfirmacion(estado) {
  const confirmacion = estado.confirmacion;
  if (!confirmacion) return estado;
  if (confirmacion.accion === "cambiar_tipo_espacio") {
    return { ...estado, tipo: confirmacion.anterior, confirmacion: null };
  }
  if (confirmacion.accion === "cambiar_tipo_unidad") {
    return {
      ...estado,
      tipoUnidad: confirmacion.anterior,
      tipoPersonalizado: confirmacion.tipoPersonalizadoAnterior ?? estado.tipoPersonalizado,
      confirmacion: null,
    };
  }
  if (confirmacion.accion === "reducir_unidades") {
    return { ...estado, cantidadUnidades: estado.unidades.length || 1, confirmacion: null };
  }
  if (confirmacion.accion === "reducir_plantas") {
    const cantidad = estado.unidades[estado.indice]?.plantas.length || 1;
    return { ...estado, cantidadPlantas: cantidad, confirmacion: null };
  }
  return { ...estado, confirmacion: null };
}

export function aplicarConfirmacion(estado) {
  const confirmacion = estado.confirmacion;
  if (!confirmacion) return estado;

  if (confirmacion.accion === "cambiar_tipo_espacio") {
    return limpiar(estado, {
      tipoUnidad: "",
      tipoPersonalizado: "",
      unidades: [],
      cantidadUnidades: 1,
      indice: 0,
    });
  }

  if (confirmacion.accion === "cambiar_tipo_unidad") {
    return limpiar(estado, {
      unidades: [],
      cantidadUnidades: 1,
      indice: 0,
      tipoPersonalizado: estado.tipoUnidad === "otro" ? estado.tipoPersonalizado : "",
    });
  }

  if (confirmacion.accion === "reducir_unidades") {
    const unidades = redimensionarUnidades(
      estado.unidades,
      estado.tipoUnidad,
      confirmacion.cantidad,
      estado.tipoPersonalizado
    );
    return irAPlantasOResumen(
      { ...estado, cantidadUnidades: confirmacion.cantidad },
      unidades
    );
  }

  if (confirmacion.accion === "reducir_plantas") {
    return mapUnidad({ ...estado, paso: "configuracion" }, estado.indice, (unidad) => ({
      ...unidad,
      plantas: redimensionarPlantas(unidad, confirmacion.cantidad),
    }));
  }

  if (confirmacion.accion === "replicar") {
    const unidades = copiarEn(estado.unidades, 0, estado.replicarIndices);
    return irAPlantasOResumen({ ...estado, replicar: false, replicarIndices: [] }, unidades);
  }

  return estado;
}

export function estadoVisibleUnidad(estado, indice) {
  const enCurso = ["cantidad_plantas", "configuracion", "etapa"].includes(estado.paso);
  if (enCurso && indice === estado.indice) return "configurando";
  if (estado.unidades[indice]?.estado === "completada") return "completada";
  return "pendiente";
}

export function resumenValor(valores) {
  const unicos = [...new Set(valores.map((valor) => String(valor || "").trim()).filter(Boolean))];
  if (unicos.length === 0) return "—";
  if (unicos.length === 1) return unicos[0];
  return "Distintas";
}

export function resumenUnidad(unidad) {
  return {
    plantas: unidad.plantas.length,
    genetica: resumenValor(unidad.plantas.map((planta) => planta.genetica)),
    metodo: resumenValor(unidad.plantas.map((planta) => metodoDePlanta(planta))),
    etapa: resumenValor(unidad.plantas.map((planta) => etiquetaEtapa(planta.etapa))),
  };
}

export function colorPlanta(planta, modo) {
  const partes = [];
  if (modo !== "mismo_metodo") partes.push(String(planta.genetica || "").trim().toLowerCase());
  if (modo !== "misma_genetica") partes.push(metodoDePlanta(planta).toLowerCase());
  const clave = partes.filter(Boolean).join("|");
  if (!clave) return "transparent";

  let hash = 0;
  for (const caracter of clave) hash += caracter.charCodeAt(0);
  return PALETA[hash % PALETA.length];
}

export function metodosEnUso(unidades, existentes) {
  const lista = [...existentes];
  const vistos = new Set(lista);

  function sumar(nombre) {
    const limpio = String(nombre || "").trim();
    if (!limpio || esMetodoBase(limpio) || vistos.has(limpio)) return;
    vistos.add(limpio);
    lista.push(limpio);
  }

  for (const unidad of unidades) {
    sumar(metodoDePlanta(unidad.general));
    for (const planta of unidad.plantas) sumar(metodoDePlanta(planta));
  }

  return lista;
}

export function totalPlantas(unidades) {
  return unidades.reduce((total, unidad) => total + unidad.plantas.length, 0);
}

export function payloadCultivo(estado) {
  return {
    nombre: estado.nombre.trim(),
    tipo: estado.tipo,
    unidades: estado.unidades.map((unidad) => ({
      nombre: unidad.nombre.trim(),
      tipo: unidad.tipo,
      tipoPersonalizado: unidad.tipo === "otro" ? String(unidad.tipoPersonalizado || "").trim() : "",
      numero: unidad.numero,
      plantas: unidad.plantas.map((planta) => ({
        genetica: String(planta.genetica || "").trim(),
        metodo: metodoDePlanta(planta),
        sustrato: muestraSustrato(planta.metodo, planta.usaSustrato)
          ? String(planta.sustrato || "").trim()
          : "",
        etapa: planta.etapa,
        fechaInicioEtapa: planta.fechaInicioEtapa,
      })),
    })),
  };
}
