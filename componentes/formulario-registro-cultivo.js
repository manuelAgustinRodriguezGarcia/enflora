"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { IconoPreferencia } from "@/componentes/icono-preferencia";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { IconoAmbiente, IconoPlanta } from "@/componentes/iconos-ui";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { SeccionParametrosRegistro } from "@/componentes/seccion-parametros-registro";
import { Selector } from "@/componentes/selector";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { SelectorFotos } from "@/componentes/selector-fotos";
import { VisorFotos } from "@/componentes/visor-fotos";
import { toque, transicionToque } from "@/lib/animaciones";
import { MAX_FOTOS_POR_REGISTRO } from "@/lib/fotos";
import { liberarVista, procesarFoto } from "@/lib/fotos-cliente";
import {
  agruparPlantasPorGenetica,
  claveParametroRegistro,
  aplicarConservacionEdicion,
  fechaEventoAlEditar,
  fechaEventoDesdeDia,
  ordenarAccionesRegistro,
  ordenarParametrosRegistro,
  parametrosDesdeValores,
  partesFechaLocal,
  prepararPlantasRegistro,
  resolverAlcanceRegistro,
  valoresDesdeRegistroParametros,
} from "@/lib/registros";
import { textoCantidad } from "@/lib/unidades";

const TIPOS_REGISTRO = [
  {
    valor: "plantas",
    etiqueta: "Plantas",
    descripcion: "Acciones, parámetros y observaciones sobre tus plantas.",
  },
  {
    valor: "ambiente",
    etiqueta: "Ambiente",
    descripcion: "Condiciones y parámetros ambientales de tu unidad de cultivo.",
  },
];

const MODOS_PLANTAS = [
  { valor: "unidad", etiqueta: "Toda la unidad" },
  { valor: "genetica", etiqueta: "Por genética" },
  { valor: "manual", etiqueta: "Selección manual" },
];

function claveAccion(item) {
  return item.origen === "nativa" ? `nativa:${item.clave}` : `personalizada:${item.clave}`;
}

function iconoAccion(item) {
  return item.origen === "nativa" ? item.clave : "personalizado";
}

function etiquetaHora(fechaIso) {
  if (!fechaIso) return "";
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return "";
  const partes = partesFechaLocal(fecha);
  if (partes.hora === "00:00") return "";
  return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function resumenAlcance({ aplicaA, plantasSeleccionadas, plantasUnidad, unidadNombre }) {
  if (aplicaA === "ambiente") {
    return {
      titulo: unidadNombre ? `Ambiente — ${unidadNombre}` : "Ambiente de la unidad",
      detalle: "Condiciones de la unidad",
    };
  }

  if (plantasSeleccionadas.length < 1) {
    return {
      titulo: "Sin plantas seleccionadas",
      detalle: "Elegí al menos una planta",
    };
  }

  const resuelto = resolverAlcanceRegistro({
    aplicaA,
    plantasSeleccionadas,
    plantasUnidad,
  });

  if (resuelto?.alcance === "unidad") {
    return {
      titulo: "Toda la unidad",
      detalle: textoCantidad(plantasSeleccionadas.length),
    };
  }

  if (resuelto?.alcance === "genetica") {
    return {
      titulo: resuelto.genetica_etiqueta,
      detalle: textoCantidad(plantasSeleccionadas.length),
    };
  }

  if (resuelto?.alcance === "planta") {
    const planta = plantasSeleccionadas[0];
    return {
      titulo: planta.nombre || "Planta",
      detalle: planta.genetica || "1 planta",
    };
  }

  const nombres = plantasSeleccionadas
    .slice(0, 3)
    .map((planta) => planta.nombre || `Planta ${planta.numero || ""}`.trim());
  const resto = plantasSeleccionadas.length - nombres.length;

  return {
    titulo: resto > 0 ? `${nombres.join(", ")} +${resto}` : nombres.join(", "),
    detalle: textoCantidad(plantasSeleccionadas.length),
  };
}

function BotonAccion({ item, activa, disabled, onClick }) {
  return (
    <motion.button
      type="button"
      className={`registro-crear__accion${activa ? " registro-crear__accion--activa" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={activa}
      whileTap={disabled ? undefined : toque}
      transition={transicionToque}
    >
      <IconoPreferencia clave={iconoAccion(item)} />
      <span>{item.etiqueta}</span>
    </motion.button>
  );
}

function hayValoresParametros(valores) {
  return Object.values(valores || {}).some((valor) => String(valor ?? "").trim() !== "");
}

const SIN_ACCIONES_OCULTAS = [];

async function sinPersistencia() {
  return { error: "No hay un destino configurado para guardar el registro." };
}

function seleccionDeInicio(unidades, seleccion) {
  const vacia = { unidadId: "", tipo: "plantas", modo: "unidad", ids: new Set() };
  const unidad = seleccion ? unidades.find((item) => item.id === seleccion.unidadId) : null;
  if (!unidad) return vacia;
  if (seleccion.tipo === "ambiente") {
    return { unidadId: unidad.id, tipo: "ambiente", modo: "unidad", ids: new Set() };
  }
  const todas = (unidad.plantas || []).map((planta) => planta.id);
  const elegidas = (seleccion.plantaIds || []).filter((id) => todas.includes(id));
  if (!elegidas.length || elegidas.length === todas.length) {
    return { unidadId: unidad.id, tipo: "plantas", modo: "unidad", ids: new Set(todas) };
  }
  return { unidadId: unidad.id, tipo: "plantas", modo: "manual", ids: new Set(elegidas) };
}

export function FormularioRegistroCultivo({
  unidades = [],
  seguimientoInicial,
  registrosHoy = [],
  accionGuardar = sinPersistencia,
  cargarRegistro = null,
  EditorSeguimiento = null,
  registrosHoyControlados = false,
  seleccionInicial = null,
  onGuardado = null,
  accionesOcultas = SIN_ACCIONES_OCULTAS,
  registroInicialId = "",
  usuarioId = "",
  // La subida a Storage la inyecta el contenedor de producción; la demo no la recibe.
  subirFoto,
  borrarArchivos,
  obtenerUrlFoto,
}) {
  const inicial = partesFechaLocal();
  const reducido = useReducedMotion();
  // Si falla la red, la acción no devuelve estado: se convierte en un error visible y reintentable.
  const guardarSeguro = useCallback(
    async (previo, datos) => {
      try {
        return await accionGuardar(previo, datos);
      } catch {
        return { error: "No se pudo guardar. Revisá tu conexión y volvé a intentar.", sinRespuesta: true };
      }
    },
    [accionGuardar]
  );
  const [estado, accion, pendiente] = useActionState(guardarSeguro, null);
  const permitirFotos = Boolean(usuarioId && subirFoto);
  const [fotosNuevas, setFotosNuevas] = useState([]);
  const [fotosExistentes, setFotosExistentes] = useState([]);
  const [fotosQuitar, setFotosQuitar] = useState(() => new Set());
  const [fotoPorQuitar, setFotoPorQuitar] = useState(null);
  const [visorIndice, setVisorIndice] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  // clave de foto nueva -> metadatos ya subidos a Storage (se reutilizan si hay que reintentar).
  const subidasRef = useRef(new Map());
  const fotosNuevasRef = useRef(fotosNuevas);
  const enviandoRef = useRef(false);
  const [inicio] = useState(() => seleccionDeInicio(unidades, seleccionInicial));
  const [unidadId, setUnidadId] = useState(inicio.unidadId);
  const [tipoRegistro, setTipoRegistro] = useState(inicio.tipo);
  const [modoSeleccion, setModoSeleccion] = useState(inicio.modo);
  const [idsSeleccionados, setIdsSeleccionados] = useState(inicio.ids);
  const [accionesElegidas, setAccionesElegidas] = useState(() => new Set());
  const [valoresParametros, setValoresParametros] = useState({});
  const [paramsHistoricos, setParamsHistoricos] = useState([]);
  const [accionesHistoricas, setAccionesHistoricas] = useState([]);
  const [mostrarMasAcciones, setMostrarMasAcciones] = useState(false);
  const [mostrarMasParametros, setMostrarMasParametros] = useState(false);
  const [editorPlantas, setEditorPlantas] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [fecha, setFecha] = useState(inicial.fecha);
  const [configurar, setConfigurar] = useState(false);
  const [editandoId, setEditandoId] = useState("");
  const [tipoPendiente, setTipoPendiente] = useState("");
  const [cargandoEdicion, setCargandoEdicion] = useState(false);
  const [accionesPrioritarias, setAccionesPrioritarias] = useState(
    seguimientoInicial?.acciones || []
  );
  const [parametrosPrioritarios, setParametrosPrioritarios] = useState(
    seguimientoInicial?.parametros || []
  );
  const [opciones, setOpciones] = useState(seguimientoInicial?.opciones || []);
  const [tipoSeguimiento, setTipoSeguimiento] = useState(seguimientoInicial?.tipo || "");
  const [exitosLocales, setExitosLocales] = useState([]);
  const [errorLocal, setErrorLocal] = useState("");
  const ultimoPayload = useRef(null);
  const ultimoExito = useRef(null);
  const baseEdicion = useRef(null);
  const edicionSolicitada = useRef("");
  const onGuardadoRef = useRef(onGuardado);
  const seguimientoRef = useRef(null);

  useEffect(() => {
    onGuardadoRef.current = onGuardado;
  }, [onGuardado]);

  useEffect(() => {
    fotosNuevasRef.current = fotosNuevas;
  }, [fotosNuevas]);

  useEffect(() => {
    if (!configurar) return undefined;
    const nodo = seguimientoRef.current;
    if (!nodo) return undefined;
    const timer = window.setTimeout(() => {
      nodo.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [configurar]);

  const unidad = useMemo(
    () => unidades.find((item) => item.id === unidadId) || null,
    [unidades, unidadId]
  );
  const plantas = unidad?.plantas || [];
  const gruposGenetica = useMemo(() => agruparPlantasPorGenetica(plantas), [plantas]);
  const accionesOrdenadas = useMemo(() => {
    const orden = ordenarAccionesRegistro(accionesPrioritarias, opciones, accionesHistoricas);
    if (!accionesOcultas.length) return orden;
    const visible = (item) => !(item.origen === "nativa" && accionesOcultas.includes(item.clave));
    return {
      prioritarias: orden.prioritarias.filter(visible),
      secundarias: orden.secundarias.filter(visible),
    };
  }, [accionesPrioritarias, opciones, accionesOcultas, accionesHistoricas]);
  const parametrosOrdenados = useMemo(
    () =>
      ordenarParametrosRegistro(parametrosPrioritarios, opciones, paramsHistoricos, {
        aplicaA: tipoRegistro,
      }),
    [parametrosPrioritarios, opciones, paramsHistoricos, tipoRegistro]
  );

  const aplicaA = tipoRegistro === "ambiente" ? "ambiente" : "plantas";
  const plantasSeleccionadas = plantas.filter((planta) => idsSeleccionados.has(planta.id));
  const resumen = resumenAlcance({
    aplicaA,
    plantasSeleccionadas,
    plantasUnidad: plantas,
    unidadNombre: unidad?.nombre || "",
  });

  const accionesVisibles = accionesOrdenadas.prioritarias;
  const accionesExtra = accionesOrdenadas.secundarias;

  const onSeguimientoActualizado = useCallback((datos) => {
    if (datos.acciones) setAccionesPrioritarias(datos.acciones);
    if (datos.parametros) setParametrosPrioritarios(datos.parametros);
    if (datos.opciones) setOpciones(datos.opciones);
    if (datos.tipo) setTipoSeguimiento(datos.tipo);
    setConfigurar(false);
  }, []);

  function limpiarFormulario(mantenerFecha = true) {
    setAccionesElegidas(new Set());
    setValoresParametros({});
    setParamsHistoricos([]);
    setAccionesHistoricas([]);
    setObservacion("");
    if (mantenerFecha) setFecha(partesFechaLocal().fecha);
    setErrorLocal("");
    setEditorPlantas(false);
    setEditandoId("");
    baseEdicion.current = null;
    setMostrarMasParametros(false);
    setMostrarMasAcciones(false);
    reiniciarFotos();
  }

  // Descarta fotos locales sin tocar Storage (después de guardar, los archivos ya pertenecen al registro).
  function reiniciarFotos() {
    for (const foto of fotosNuevasRef.current) liberarVista(foto);
    subidasRef.current = new Map();
    setFotosNuevas([]);
    setFotosExistentes([]);
    setFotosQuitar(new Set());
    setFotoPorQuitar(null);
    setVisorIndice(null);
  }

  // Si el servidor rechazó el registro, ya borró los archivos recién subidos: hay que volver a subirlos.
  // Si dijo "ya guardadas", un envío anterior sí quedó guardado y no hay que tocar nada.
  useEffect(() => {
    if (!estado?.error) return;
    if (estado.archivosLimpiados) subidasRef.current = new Map();
    // Un envío anterior sí se guardó: se vacía el formulario para no duplicarlo.
    if (estado.yaGuardado) {
      reiniciarFotos();
    }
    // reiniciarFotos solo usa refs y setters estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  async function seleccionarFotos(archivos) {
    const cupo = MAX_FOTOS_POR_REGISTRO - fotosExistentes.length + fotosQuitar.size - fotosNuevas.length;
    if (cupo <= 0) {
      setErrorLocal(`Un registro admite hasta ${MAX_FOTOS_POR_REGISTRO} fotos.`);
      return;
    }
    setErrorLocal("");
    const aceptados = archivos.slice(0, cupo);
    if (archivos.length > cupo) {
      setErrorLocal(`Solo se agregaron ${cupo}: un registro admite hasta ${MAX_FOTOS_POR_REGISTRO} fotos.`);
    }

    const marcadores = aceptados.map((archivo) => ({
      clave: globalThis.crypto.randomUUID(),
      archivo,
      estado: "procesando",
      url: "",
    }));
    setFotosNuevas((lista) => [...lista, ...marcadores]);

    for (const marcador of marcadores) {
      const resultado = await procesarFoto(marcador.archivo);
      if (resultado.error) {
        setErrorLocal(resultado.error);
        setFotosNuevas((lista) => lista.filter((item) => item.clave !== marcador.clave));
        continue;
      }
      setFotosNuevas((lista) =>
        lista.map((item) =>
          item.clave === marcador.clave
            ? { clave: item.clave, estado: "lista", url: resultado.foto.vista, procesada: resultado.foto, vista: resultado.foto.vista }
            : item
        )
      );
    }
  }

  function quitarFotoNueva(item) {
    const subida = subidasRef.current.get(item.clave);
    if (subida) {
      // Ya estaba en Storage pero todavía no asociada a ningún registro: se borra para no dejar huérfanos.
      borrarArchivos?.(subida.rutas);
      subidasRef.current.delete(item.clave);
    }
    liberarVista(item);
    setFotosNuevas((lista) => lista.filter((foto) => foto.clave !== item.clave));
  }

  function confirmarQuitarExistente() {
    if (!fotoPorQuitar) return;
    setFotosQuitar((actual) => new Set(actual).add(fotoPorQuitar.id));
    setFotoPorQuitar(null);
  }

  function deshacerQuitarExistente(id) {
    setFotosQuitar((actual) => {
      const siguiente = new Set(actual);
      siguiente.delete(id);
      return siguiente;
    });
  }

  useEffect(() => {
    if (!estado?.ok || !estado.registro?.id) return;
    if (ultimoExito.current === estado) return;
    ultimoExito.current = estado;

    const resumenGuardado = ultimoPayload.current;
    setExitosLocales((lista) => [
      {
        id: estado.registro.id,
        fecha_evento: resumenGuardado?.fecha_evento || estado.registro.fecha_evento,
        observacion: resumenGuardado?.observacion || estado.registro.observacion || "",
        alcance: resumenGuardado?.alcance || estado.registro.alcance,
        aplica_a: resumenGuardado?.aplica_a || estado.registro.aplica_a,
        unidad_cultivo_id:
          resumenGuardado?.unidad_cultivo_id || estado.registro.unidad_cultivo_id,
        registro_acciones: (resumenGuardado?.acciones || []).map((item) => ({
          origen: item.origen,
          clave_nativa: item.clave_nativa,
          opcion_id: item.opcion_id,
          nombre: item.nombre,
        })),
        registro_parametros: (resumenGuardado?.parametros || []).map((item) => ({
          origen: item.origen,
          clave_nativa: item.clave_nativa,
          opcion_id: item.opcion_id,
          nombre: item.nombre,
          tipo_valor: item.tipo_valor,
          valor_numero: item.valor_numero,
          valor_texto: item.valor_texto,
          unidad: item.unidad,
        })),
        registro_plantas: (resumenGuardado?.plantas || []).map((planta) => ({
          planta_id: planta.id,
          nombre_planta: planta.nombre,
        })),
      },
      ...lista.filter((item) => item.id !== estado.registro.id),
    ]);
    limpiarFormulario(true);
    onGuardadoRef.current?.(estado.registro);
  }, [estado]);

  function elegirUnidad(siguienteId) {
    setUnidadId(siguienteId);
    setErrorLocal("");
    setEditorPlantas(false);
    const siguiente = unidades.find((item) => item.id === siguienteId);
    const lista = siguiente?.plantas || [];
    if (tipoRegistro === "ambiente") {
      setIdsSeleccionados(new Set());
      return;
    }
    if (modoSeleccion === "unidad") {
      setIdsSeleccionados(new Set(lista.map((planta) => planta.id)));
      return;
    }
    setIdsSeleccionados(new Set());
  }

  function aplicarTipoRegistro(siguiente) {
    setTipoRegistro(siguiente);
    setErrorLocal("");
    setEditorPlantas(false);
    setTipoPendiente("");
    setValoresParametros({});
    setAccionesElegidas(new Set());
    setObservacion("");
    if (!editandoId) {
      setParamsHistoricos([]);
      setAccionesHistoricas([]);
    }

    if (siguiente === "ambiente") {
      setIdsSeleccionados(new Set());
      return;
    }

    setModoSeleccion("unidad");
    setIdsSeleccionados(new Set(plantas.map((planta) => planta.id)));
  }

  function elegirTipoRegistro(siguiente) {
    if (siguiente === tipoRegistro) return;
    const sucio =
      hayValoresParametros(valoresParametros) ||
      accionesElegidas.size > 0 ||
      String(observacion || "").trim() !== "";
    if (sucio) {
      setTipoPendiente(siguiente);
      return;
    }
    aplicarTipoRegistro(siguiente);
  }

  function aplicarModoSeleccion(siguiente) {
    setModoSeleccion(siguiente);
    setErrorLocal("");
    if (siguiente === "unidad") {
      setIdsSeleccionados(new Set(plantas.map((planta) => planta.id)));
      return;
    }
    if (siguiente === "manual" || siguiente === "genetica") {
      setIdsSeleccionados(new Set());
    }
  }

  function elegirGenetica(clave) {
    const grupo = gruposGenetica.find((item) => item.clave === clave);
    if (!grupo) return;
    setIdsSeleccionados(new Set(grupo.plantas.map((planta) => planta.id)));
    setErrorLocal("");
  }

  function alternarPlanta(plantaId) {
    if (tipoRegistro === "ambiente") return;
    setIdsSeleccionados((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(plantaId)) siguiente.delete(plantaId);
      else siguiente.add(plantaId);
      return siguiente;
    });
    if (modoSeleccion === "unidad" || modoSeleccion === "genetica") {
      setModoSeleccion("manual");
    }
    setErrorLocal("");
  }

  function alternarAccion(item) {
    const clave = claveAccion(item);
    setAccionesElegidas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
    setErrorLocal("");
  }

  function aplicarRegistroEnFormulario(registro) {
    if (!registro?.id) return;
    setEditandoId(registro.id);
    setErrorLocal("");
    setConfigurar(false);

    if (registro.unidad_cultivo_id) {
      setUnidadId(registro.unidad_cultivo_id);
    }

    const aplica = registro.aplica_a === "ambiente" ? "ambiente" : "plantas";
    setTipoRegistro(aplica);

    const idsSnapshot = (registro.registro_plantas || [])
      .map((fila) => fila.planta_id)
      .filter(Boolean);
    const unidadReg = unidades.find((item) => item.id === registro.unidad_cultivo_id);
    const idsUnidad = (unidadReg?.plantas || []).map((planta) => planta.id);
    const idsEnUnidad = idsSnapshot.filter((id) => idsUnidad.includes(id));

    if (aplica === "ambiente") {
      setModoSeleccion("unidad");
      setIdsSeleccionados(new Set());
    } else if (
      idsUnidad.length > 0 &&
      idsEnUnidad.length === idsUnidad.length &&
      idsSnapshot.length === idsUnidad.length
    ) {
      setModoSeleccion("unidad");
      setIdsSeleccionados(new Set(idsEnUnidad));
    } else if (registro.alcance === "genetica") {
      setModoSeleccion("genetica");
      setIdsSeleccionados(new Set(idsEnUnidad));
    } else {
      setModoSeleccion("manual");
      setIdsSeleccionados(new Set(idsEnUnidad));
    }
    baseEdicion.current = registro;

    const partes = partesFechaLocal(registro.fecha_evento);
    setFecha(partes.fecha);
    setObservacion(registro.observacion || "");

    const acciones = new Set();
    for (const fila of registro.registro_acciones || []) {
      if (fila.origen === "nativa" && fila.clave_nativa) {
        acciones.add(`nativa:${fila.clave_nativa}`);
      } else if (fila.opcion_id) {
        acciones.add(`personalizada:${fila.opcion_id}`);
      }
    }
    setAccionesElegidas(acciones);
    setAccionesHistoricas(registro.registro_acciones || []);
    setValoresParametros(valoresDesdeRegistroParametros(registro.registro_parametros));
    setParamsHistoricos(registro.registro_parametros || []);
    setMostrarMasParametros(true);
    setEditorPlantas(false);
    for (const foto of fotosNuevasRef.current) liberarVista(foto);
    subidasRef.current = new Map();
    setFotosNuevas([]);
    setFotosQuitar(new Set());
    setFotosExistentes(
      [...(registro.registro_fotos || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    );
  }

  async function cargarEdicion(registro) {
    if (!registro?.id || cargandoEdicion || !cargarRegistro) return;
    setCargandoEdicion(true);
    setErrorLocal("");
    try {
      const respuesta = await cargarRegistro(registro.id);
      if (respuesta.error || !respuesta.registro) {
        setErrorLocal(respuesta.error || "No se pudo cargar el registro completo.");
        return;
      }
      aplicarRegistroEnFormulario(respuesta.registro);
    } catch {
      setErrorLocal("No se pudo cargar el registro completo.");
    } finally {
      setCargandoEdicion(false);
    }
  }

  useEffect(() => {
    if (!registroInicialId || edicionSolicitada.current === registroInicialId) return;
    edicionSolicitada.current = registroInicialId;
    cargarEdicion({ id: registroInicialId });
    // El id de la URL dispara una sola carga. cargarEdicion cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registroInicialId]);

  function armarPayload() {
    if (!unidad) {
      return { error: "Seleccioná una unidad." };
    }

    if (aplicaA === "plantas" && plantas.length === 0) {
      return { error: "Esta unidad no tiene plantas para registrar." };
    }

    const alcanceResuelto = resolverAlcanceRegistro({
      aplicaA,
      plantasSeleccionadas,
      plantasUnidad: plantas,
    });

    if (!alcanceResuelto) {
      return { error: "Seleccioná al menos una planta." };
    }

    const base = editandoId && baseEdicion.current?.id === editandoId ? baseEdicion.current : null;
    const fechaEvento = base
      ? fechaEventoAlEditar({
          fechaSeleccionada: fecha,
          fechaOriginalIso: base.fecha_evento,
        })
      : fechaEventoDesdeDia(fecha);
    if (!fechaEvento) {
      return { error: "La fecha del evento no es válida." };
    }

    const catalogoAcciones = [
      ...accionesOrdenadas.prioritarias,
      ...accionesOrdenadas.secundarias,
    ];
    let acciones = catalogoAcciones
      .filter((item) => accionesElegidas.has(claveAccion(item)))
      .map((item) =>
        item.origen === "nativa"
          ? {
              origen: "nativa",
              clave_nativa: item.clave,
              nombre: item.etiqueta,
            }
          : {
              origen: "personalizada",
              opcion_id: item.opcion_id,
              nombre: item.etiqueta,
            }
      );

    if (aplicaA === "ambiente" && !editandoId) {
      acciones = [];
    }

    if (editandoId && accionesHistoricas.length > 0) {
      const claves = new Set(
        acciones.map((item) =>
          item.origen === "nativa"
            ? `nativa:${item.clave_nativa}`
            : `personalizada:${item.opcion_id}`
        )
      );
      for (const fila of accionesHistoricas) {
        const clave =
          fila.origen === "nativa" && fila.clave_nativa
            ? `nativa:${fila.clave_nativa}`
            : fila.opcion_id
              ? `personalizada:${fila.opcion_id}`
              : "";
        if (!clave || !accionesElegidas.has(clave) || claves.has(clave)) continue;
        acciones.push({
          origen: fila.origen,
          clave_nativa: fila.clave_nativa || null,
          opcion_id: fila.opcion_id || null,
          nombre: fila.nombre || "Acción",
        });
        claves.add(clave);
      }
    }

    const catalogoParametros = [
      ...parametrosOrdenados.prioritarias,
      ...parametrosOrdenados.secundarias,
    ];
    const parametrosOk = parametrosDesdeValores(valoresParametros, catalogoParametros);
    if (parametrosOk.error) return { error: parametrosOk.error };

    const observacionLimpia = observacion.trim();
    const existentesRestantes = fotosExistentes.filter((foto) => !fotosQuitar.has(foto.id)).length;
    const hayFotos = permitirFotos && (fotosNuevas.length > 0 || existentesRestantes > 0);
    if (
      acciones.length === 0 &&
      parametrosOk.parametros.length === 0 &&
      !observacionLimpia &&
      !hayFotos
    ) {
      return {
        error: "El registro necesita una acción, un parámetro, una observación o una foto.",
      };
    }
    if (fotosNuevas.some((foto) => foto.estado === "procesando")) {
      return { error: "Esperá a que termine de prepararse la foto." };
    }

    const datos = {
      alcance: alcanceResuelto.alcance,
      aplica_a: aplicaA,
      espacio_id: unidad.espacio_id,
      unidad_cultivo_id: unidad.id,
      genetica_clave: alcanceResuelto.genetica_clave,
      genetica_etiqueta: alcanceResuelto.genetica_etiqueta,
      observacion: observacionLimpia || null,
      fecha_evento: fechaEvento,
      plantas:
        aplicaA === "ambiente" ? [] : prepararPlantasRegistro(plantasSeleccionadas, unidad),
      acciones,
      parametros: parametrosOk.parametros,
      fotos_quitar: editandoId ? [...fotosQuitar] : [],
      fotos_restantes: existentesRestantes,
    };

    if (editandoId) datos.id = editandoId;
    return {
      error: "",
      datos: aplicarConservacionEdicion(datos, {
        base,
        idsSeleccionados,
        idsPlantasUnidad: plantas.map((planta) => planta.id),
      }),
    };
  }

  // Sube a Storage las fotos que todavía no se subieron. Las que ya subieron en un intento previo
  // se reutilizan (mismo id y ruta): si un envío anterior llegó a guardarse, la base lo detecta.
  async function subirFotosPendientes() {
    const resultado = [];
    for (const item of fotosNuevasRef.current) {
      let subida = subidasRef.current.get(item.clave);
      if (!subida) {
        subida = await subirFoto(usuarioId, item.procesada);
        if (subida.error) return { error: subida.error };
        subidasRef.current.set(item.clave, subida);
      }
      resultado.push(subida.foto);
    }
    return { fotos: resultado };
  }

  async function enviar(formData) {
    if (enviandoRef.current) return;
    setErrorLocal("");
    const armado = armarPayload();
    if (armado.error) {
      setErrorLocal(armado.error);
      return;
    }

    // Bloqueo síncrono contra doble envío (el estado de React llega un render tarde).
    enviandoRef.current = true;
    try {
      let datos = armado.datos;
      if (permitirFotos && fotosNuevasRef.current.length > 0) {
        setSubiendo(true);
        const subidas = await subirFotosPendientes();
        setSubiendo(false);
        if (subidas.error) {
          setErrorLocal(subidas.error);
          return;
        }
        datos = { ...datos, fotos: subidas.fotos };
      }
      ultimoPayload.current = datos;
      formData.set("registro", JSON.stringify(datos));
      await accion(formData);
    } finally {
      setSubiendo(false);
      enviandoRef.current = false;
    }
  }

  const listaHoy = registrosHoyControlados
    ? registrosHoy
    : [
        ...exitosLocales,
        ...registrosHoy.filter((item) => !exitosLocales.some((local) => local.id === item.id)),
      ];
  const numeroRegistroHoy = new Map(
    [...listaHoy]
      .sort((a, b) => {
        const diferencia = new Date(a.fecha_evento).getTime() - new Date(b.fecha_evento).getTime();
        if (diferencia) return diferencia;
        return String(a.fecha_creacion || a.id).localeCompare(String(b.fecha_creacion || b.id));
      })
      .map((item, indice) => [item.id, indice + 1])
  );

  const opcionesUnidad = unidades.map((item) => ({
    valor: item.id,
    etiqueta: `${item.nombre} · ${item.espacio_nombre}`,
  }));

  const bloqueado = pendiente || cargandoEdicion || subiendo;
  const cantidadParametros = useMemo(() => {
    const catalogo = [
      ...parametrosOrdenados.prioritarias,
      ...parametrosOrdenados.secundarias,
    ];
    return catalogo.filter((item) => {
      const valor = valoresParametros[claveParametroRegistro(item)];
      return String(valor ?? "").trim() !== "";
    }).length;
  }, [parametrosOrdenados, valoresParametros]);

  const accionesPill = useMemo(() => {
    const catalogo = [
      ...accionesOrdenadas.prioritarias,
      ...accionesOrdenadas.secundarias,
    ];
    return catalogo
      .filter((item) => accionesElegidas.has(claveAccion(item)))
      .map((item) => item.etiqueta);
  }, [accionesOrdenadas, accionesElegidas]);

  return (
    <div className="registro-crear">
      {unidad ? (
        <div className="registro-crear__pill" role="status">
          <span className="registro-crear__pill-icono" aria-hidden="true">
            <IconoNavegacion clave="registro" />
          </span>
          <p className="registro-crear__pill-texto">
            Registro en: <strong>{unidad.nombre}</strong>
            {aplicaA === "ambiente" ? (
              <>
                {" · "}ambiente
                {" · "}parámetros: {cantidadParametros}
              </>
            ) : (
              <>
                {" · "}plantas: {plantasSeleccionadas.length}
                {accionesPill.length > 0 ? ` · ${accionesPill.join(" · ")}` : null}
              </>
            )}
          </p>
        </div>
      ) : null}

      <form className="formulario registro-crear__formulario" action={enviar}>
        {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
        {errorLocal ? <p className="formulario__error">{errorLocal}</p> : null}
        <Aparecer visible={Boolean(estado?.ok) && !pendiente && !errorLocal && !estado?.error}>
          <p className="registro-crear__ok">Registro guardado. Podés cargar otro o editar uno de hoy.</p>
        </Aparecer>
        {editandoId ? (
          <p className="registro-crear__editando">
            Editando un registro existente.{" "}
            <button
              type="button"
              className="registro-crear__enlace"
              onClick={() => limpiarFormulario(true)}
              disabled={bloqueado}
            >
              Cancelar edición
            </button>
          </p>
        ) : null}

        <section className="registro-crear__seccion">
          <div className="registro-crear__cultivo-fecha">
            <div className="registro-crear__cultivo">
              <h2 className="registro-crear__etiqueta" id="registro-unidad-titulo">
                ¿Qué cultivo vas a registrar?
              </h2>
              <Selector
                valor={unidadId || null}
                onChange={elegirUnidad}
                opciones={opcionesUnidad}
                placeholder="Elegí un cultivo"
                id="registro-unidad"
              />
            </div>
            <div className="registro-crear__cuando">
              <h2 className="registro-crear__etiqueta" id="registro-fecha-titulo">
                Fecha
              </h2>
              <SelectorFecha
                valor={fecha}
                onChange={setFecha}
                id="registro-fecha"
                deshabilitado={bloqueado}
                sinIcono
              />
            </div>
          </div>
        </section>

        <section className="registro-crear__seccion">
          <h2 className="registro-crear__etiqueta">¿Qué querés registrar?</h2>
          <div className="registro-crear__tipos" role="group" aria-label="Tipo de registro">
            {TIPOS_REGISTRO.map((item) => {
              const activo = tipoRegistro === item.valor;
              return (
                <button
                  key={item.valor}
                  type="button"
                  className={`registro-crear__tipo${activo ? " registro-crear__tipo--activo" : ""}`}
                  onClick={() => elegirTipoRegistro(item.valor)}
                  disabled={bloqueado}
                  aria-pressed={activo}
                >
                  <span className="registro-crear__tipo-icono" aria-hidden="true">
                    {item.valor === "ambiente" ? <IconoAmbiente /> : <IconoPlanta />}
                  </span>
                  <span className="registro-crear__tipo-cuerpo">
                    <span className="registro-crear__tipo-nombre">{item.etiqueta}</span>
                    <span className="registro-crear__tipo-desc">{item.descripcion}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <Aparecer visible={tipoRegistro === "plantas"} espacio="1.15rem">
          <section className="registro-crear__seccion">
            <h2 className="registro-crear__etiqueta">Plantas seleccionadas</h2>
            <div className="registro-crear__resumen-wrap">
              <AnimatePresence>
                {!unidadId ? (
                  <motion.div
                    key="bloqueo-cultivo"
                    className="registro-crear__overlay"
                    initial={reducido ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={reducido ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="registro-crear__overlay-texto">Primero seleccione un cultivo</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <div
                className={`registro-crear__resumen${!unidadId ? " registro-crear__resumen--bloqueado" : ""}`}
                inert={!unidadId || undefined}
                aria-hidden={!unidadId}
              >
              <div className="registro-crear__resumen-texto">
                <p className="registro-crear__resumen-titulo">{resumen.titulo}</p>
                <p className="registro-crear__resumen-detalle">{resumen.detalle}</p>
              </div>
              <button
                type="button"
                className="registro-crear__enlace"
                onClick={() => setEditorPlantas((valor) => !valor)}
                disabled={bloqueado || !unidadId}
              >
                {editorPlantas ? "Cerrar" : "Elegir plantas"}
              </button>
              </div>
            </div>

            <Aparecer visible={editorPlantas}>
              <div className="registro-crear__editor-plantas">
                <div className="registro-crear__chips">
                  {MODOS_PLANTAS.map((item) => (
                    <button
                      key={item.valor}
                      type="button"
                      className={`registro-crear__chip${modoSeleccion === item.valor ? " registro-crear__chip--activo" : ""}`}
                      onClick={() => aplicarModoSeleccion(item.valor)}
                      disabled={bloqueado}
                      aria-pressed={modoSeleccion === item.valor}
                    >
                      {item.etiqueta}
                    </button>
                  ))}
                </div>

                <Aparecer visible={modoSeleccion === "genetica" && gruposGenetica.length > 0}>
                  <div className="registro-crear__geneticas" role="group" aria-label="Genéticas de la unidad">
                    {gruposGenetica.map((grupo) => {
                      const activo =
                        plantasSeleccionadas.length === grupo.plantas.length &&
                        grupo.plantas.every((planta) => idsSeleccionados.has(planta.id));
                      return (
                        <button
                          key={grupo.clave}
                          type="button"
                          className={`registro-crear__pill-genetica${activo ? " registro-crear__pill-genetica--activa" : ""}`}
                          onClick={() => elegirGenetica(grupo.clave)}
                          disabled={bloqueado}
                          aria-pressed={activo}
                        >
                          <span className="registro-crear__pill-genetica-nombre">{grupo.etiqueta}</span>
                          <span className="registro-crear__pill-genetica-cuenta">{grupo.plantas.length}</span>
                        </button>
                      );
                    })}
                  </div>
                </Aparecer>

                <Aparecer visible={modoSeleccion === "genetica" && gruposGenetica.length === 0}>
                  <p className="registro-crear__ayuda">
                    No hay genéticas cargadas en esta unidad. Usá selección manual.
                  </p>
                </Aparecer>

                <Aparecer visible={plantas.length > 0}>
                  <div className="registro-crear__plantas-bloque">
                    <p className="registro-crear__plantas-cabecera">
                      {idsSeleccionados.size} de {plantas.length} plantas seleccionadas
                    </p>
                    <div className="registro-crear__plantas">
                      {plantas.map((planta) => {
                        const activa = idsSeleccionados.has(planta.id);
                        const titulo = planta.nombre || `Planta ${planta.numero || ""}`.trim();
                        return (
                          <motion.button
                            key={planta.id}
                            type="button"
                            className={`registro-crear__planta${activa ? " registro-crear__planta--activa" : ""}`}
                            onClick={() => alternarPlanta(planta.id)}
                            disabled={bloqueado}
                            aria-pressed={activa}
                            whileTap={bloqueado ? undefined : toque}
                            transition={transicionToque}
                          >
                            <span className="registro-crear__planta-nombre">{titulo}</span>
                            {planta.genetica ? (
                              <span className="registro-crear__planta-meta">{planta.genetica}</span>
                            ) : null}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </Aparecer>

                <Aparecer visible={plantas.length === 0}>
                  <p className="registro-crear__ayuda">Esta unidad todavía no tiene plantas.</p>
                </Aparecer>
              </div>
            </Aparecer>
          </section>
        </Aparecer>

        <SeccionParametrosRegistro
          prioritarias={parametrosOrdenados.prioritarias}
          secundarias={parametrosOrdenados.secundarias}
          valores={valoresParametros}
          onChange={(clave, valor) =>
            setValoresParametros((actual) => ({ ...actual, [clave]: valor }))
          }
          mostrarMas={mostrarMasParametros}
          onToggleMas={() => setMostrarMasParametros((valor) => !valor)}
          pendiente={bloqueado}
          accionCabecera={
            EditorSeguimiento ? (
              <button
                type="button"
                className="registro-crear__enlace"
                onClick={() => setConfigurar((valor) => !valor)}
                disabled={bloqueado}
              >
                {configurar ? "Cerrar" : "Editar"}
              </button>
            ) : null
          }
        />

        <Aparecer visible={tipoRegistro === "plantas"} espacio="1.15rem">
          <section className="registro-crear__seccion">
            <div className="registro-crear__seccion-cabecera">
              <h2 className="registro-crear__etiqueta">Acciones</h2>
              {EditorSeguimiento ? (
                <button
                  type="button"
                  className="registro-crear__enlace"
                  onClick={() => setConfigurar((valor) => !valor)}
                  disabled={bloqueado}
                >
                  {configurar ? "Cerrar" : "Editar"}
                </button>
              ) : null}
            </div>
            {accionesVisibles.length === 0 ? (
              <p className="registro-crear__ayuda">
                Todavía no elegiste acciones prioritarias. Tocá Editar para configurarlas.
              </p>
            ) : (
              <div className="registro-crear__acciones-grid">
                {accionesVisibles.map((item) => {
                  const clave = claveAccion(item);
                  return (
                    <BotonAccion
                      key={clave}
                      item={item}
                      activa={accionesElegidas.has(clave)}
                      disabled={bloqueado}
                      onClick={() => alternarAccion(item)}
                    />
                  );
                })}
              </div>
            )}
            {accionesExtra.length > 0 ? (
              <>
                <button
                  type="button"
                  className="registro-crear__enlace"
                  onClick={() => setMostrarMasAcciones((valor) => !valor)}
                  disabled={bloqueado}
                >
                  {mostrarMasAcciones ? "Ocultar más acciones" : "Más acciones"}
                </button>
                <Aparecer visible={mostrarMasAcciones}>
                  <div className="registro-crear__acciones-grid">
                    {accionesExtra.map((item) => {
                      const clave = claveAccion(item);
                      return (
                        <BotonAccion
                          key={clave}
                          item={item}
                          activa={accionesElegidas.has(clave)}
                          disabled={bloqueado}
                          onClick={() => alternarAccion(item)}
                        />
                      );
                    })}
                  </div>
                </Aparecer>
              </>
            ) : null}
          </section>
        </Aparecer>

        {permitirFotos ? (
          <section className="registro-crear__seccion" aria-labelledby="registro-fotos-titulo">
            <h2 className="registro-crear__etiqueta" id="registro-fotos-titulo">
              Fotos
            </h2>
            {fotosExistentes.length > 0 ? (
              <ul className="fotos-selector__grilla" aria-label="Fotos guardadas">
                {fotosExistentes.map((foto, indice) => {
                  const quitada = fotosQuitar.has(foto.id);
                  return (
                    <li key={foto.id} className="fotos-selector__item">
                      <button
                        type="button"
                        className="fotos-selector__abrir"
                        onClick={() => setVisorIndice(indice)}
                        aria-label="Ver foto"
                        style={quitada ? { opacity: 0.35 } : undefined}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto.url_miniatura} alt="" loading="lazy" decoding="async" />
                      </button>
                      {quitada ? (
                        <button
                          type="button"
                          className="fotos-selector__nueva"
                          onClick={() => deshacerQuitarExistente(foto.id)}
                          disabled={bloqueado}
                        >
                          Deshacer
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="fotos-selector__quitar"
                          onClick={() => setFotoPorQuitar(foto)}
                          disabled={bloqueado}
                          aria-label="Quitar foto guardada"
                        >
                          <X strokeWidth={2} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <SelectorFotos
              items={fotosNuevas}
              maximo={Math.max(
                0,
                MAX_FOTOS_POR_REGISTRO - (fotosExistentes.length - fotosQuitar.size)
              )}
              disabled={bloqueado}
              onSeleccionar={seleccionarFotos}
              onQuitar={quitarFotoNueva}
            />
          </section>
        ) : null}

        <section className="registro-crear__seccion">
          <h2 className="registro-crear__etiqueta">Notas y observaciones</h2>
          <label className="formulario__campo registro-crear__observacion">
            <span className="registro-crear__sr">Observación</span>
            <textarea
              value={observacion}
              onChange={(evento) => setObservacion(evento.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={
                tipoRegistro === "ambiente"
                  ? "¿Qué pasó con las condiciones de la unidad?"
                  : "¿Qué sucedió con estas plantas?"
              }
              disabled={bloqueado}
            />
          </label>
        </section>

        {listaHoy.length > 0 ? (
          <section className="registro-crear__hoy">
            <h2 className="registro-crear__etiqueta">Registros de hoy</h2>
            <ul className="registro-crear__lista">
              {listaHoy.map((item) => {
                const hora = etiquetaHora(item.fecha_evento);
                const etiquetaTipo =
                  item.aplica_a === "ambiente" ? "Ambiente" : "Plantas";
                return (
                  <li key={item.id}>
                    <span className="registro-crear__lista-lado">
                      <span className="registro-crear__lista-hora">{hora || "—"}</span>
                      <span className="registro-crear__lista-tipo">{etiquetaTipo}</span>
                    </span>
                    <span className="registro-crear__lista-texto">
                      Registro #{numeroRegistroHoy.get(item.id)}
                    </span>
                    {cargarRegistro ? (
                      <button
                        type="button"
                        className="registro-crear__enlace registro-crear__lista-editar"
                        onClick={() => cargarEdicion(item)}
                        disabled={bloqueado}
                      >
                        Editar
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="registro-crear__cta">
          <Boton
            type="submit"
            className="boton boton--cta boton--ancho"
            disabled={bloqueado || !unidad}
          >
            {subiendo
              ? "Subiendo fotos..."
              : pendiente
              ? "Guardando..."
              : cargandoEdicion
                ? "Cargando..."
                : editandoId
                  ? "Guardar cambios"
                  : "Guardar registro"}
          </Boton>
        </div>
      </form>

      {EditorSeguimiento ? (
        <Aparecer visible={configurar}>
          <div
            className="registro-crear__seguimiento"
            ref={seguimientoRef}
            id="registro-configurar-seguimiento"
          >
            <EditorSeguimiento
              modo="edicion"
              encabezado="Configurar seguimiento"
              tipoInicial={tipoSeguimiento}
              acciones={accionesPrioritarias}
              parametros={parametrosPrioritarios}
              opcionesIniciales={opciones}
              textoGuardar="Guardar preferencias"
              onActualizado={onSeguimientoActualizado}
            />
          </div>
        </Aparecer>
      ) : null}

      <VisorFotos
        fotos={fotosExistentes}
        obtenerUrl={obtenerUrlFoto}
        indice={visorIndice}
        onCambiar={setVisorIndice}
        onCerrar={() => setVisorIndice(null)}
      />

      <ModalConfirmacion
        abierto={Boolean(fotoPorQuitar)}
        onCerrar={() => setFotoPorQuitar(null)}
        titulo="¿Quitar esta foto?"
        descripcion="La foto se elimina del registro cuando guardes los cambios. Podés deshacerlo antes de guardar."
        textoConfirmar="Quitar foto"
        textoCancelar="Cancelar"
        varianteConfirmar="destructivo"
        onConfirmar={confirmarQuitarExistente}
      />

      <ModalConfirmacion
        abierto={Boolean(tipoPendiente)}
        onCerrar={() => setTipoPendiente("")}
        titulo="¿Cambiar el tipo de registro?"
        descripcion="Estás cambiando el tipo de registro. Algunos datos ingresados no corresponden al nuevo tipo y se descartarán. ¿Querés continuar?"
        textoConfirmar="Cambiar tipo"
        textoCancelar="Cancelar"
        onConfirmar={() => {
          aplicarTipoRegistro(tipoPendiente);
        }}
      />
    </div>
  );
}
