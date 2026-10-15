"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { guardarRegistro } from "@/app/registros/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { EditorSeguimiento } from "@/componentes/editor-seguimiento";
import { IconoPreferencia } from "@/componentes/icono-preferencia";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { SeccionParametrosRegistro } from "@/componentes/seccion-parametros-registro";
import { Selector } from "@/componentes/selector";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { toque, transicionToque } from "@/lib/animaciones";
import { formatearFecha } from "@/lib/etapas";
import {
  agruparPlantasPorGenetica,
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

const MODOS = [
  { valor: "unidad", etiqueta: "Toda la unidad" },
  { valor: "genetica", etiqueta: "Por genética" },
  { valor: "manual", etiqueta: "Selección manual" },
  { valor: "ambiente", etiqueta: "Ambiente" },
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

function etiquetaResumenRegistro(item) {
  const acciones = (item.registro_acciones || []).map((fila) => fila.nombre);
  const parametros = (item.registro_parametros || []).map((fila) => {
    if (fila.tipo_valor === "numero") {
      const unidad = fila.unidad ? ` ${fila.unidad}` : "";
      return `${fila.nombre} ${fila.valor_numero}${unidad}`;
    }
    return `${fila.nombre}: ${fila.valor_texto}`;
  });
  const partes = [...acciones, ...parametros];
  if (!partes.length) return item.observacion ? "Observación" : "Registro";
  return partes.join(" · ");
}

function resumenAlcance({ aplicaA, plantasSeleccionadas, plantasUnidad }) {
  if (aplicaA === "ambiente") {
    return {
      titulo: "Ambiente de la unidad",
      detalle: "Sin plantas asociadas",
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

export function FormularioCrearRegistro({
  unidades = [],
  seguimientoInicial,
  registrosHoy = [],
}) {
  const inicial = partesFechaLocal();
  const [estado, accion, pendiente] = useActionState(guardarRegistro, null);
  const [unidadId, setUnidadId] = useState(unidades[0]?.id || "");
  const [modo, setModo] = useState("unidad");
  const [idsSeleccionados, setIdsSeleccionados] = useState(() => {
    const primera = unidades[0];
    return new Set((primera?.plantas || []).map((planta) => planta.id));
  });
  const [accionesElegidas, setAccionesElegidas] = useState(() => new Set());
  const [valoresParametros, setValoresParametros] = useState({});
  const [paramsHistoricos, setParamsHistoricos] = useState([]);
  const [mostrarMasAcciones, setMostrarMasAcciones] = useState(false);
  const [mostrarMasParametros, setMostrarMasParametros] = useState(false);
  const [editorPlantas, setEditorPlantas] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [fecha, setFecha] = useState(inicial.fecha);
  const [configurar, setConfigurar] = useState(false);
  const [editandoId, setEditandoId] = useState("");
  const [modoPendiente, setModoPendiente] = useState("");
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
  const ultimoExitoId = useRef("");

  const unidad = useMemo(
    () => unidades.find((item) => item.id === unidadId) || null,
    [unidades, unidadId]
  );
  const plantas = unidad?.plantas || [];
  const gruposGenetica = useMemo(() => agruparPlantasPorGenetica(plantas), [plantas]);
  const accionesOrdenadas = useMemo(
    () => ordenarAccionesRegistro(accionesPrioritarias, opciones),
    [accionesPrioritarias, opciones]
  );
  const parametrosOrdenados = useMemo(
    () => ordenarParametrosRegistro(parametrosPrioritarios, opciones, paramsHistoricos),
    [parametrosPrioritarios, opciones, paramsHistoricos]
  );

  const aplicaA = modo === "ambiente" ? "ambiente" : "plantas";
  const plantasSeleccionadas = plantas.filter((planta) => idsSeleccionados.has(planta.id));
  const resumen = resumenAlcance({
    aplicaA,
    plantasSeleccionadas,
    plantasUnidad: plantas,
  });

  const accionesVisibles =
    accionesOrdenadas.prioritarias.length > 0
      ? accionesOrdenadas.prioritarias
      : accionesOrdenadas.secundarias;
  const accionesExtra =
    accionesOrdenadas.prioritarias.length > 0 ? accionesOrdenadas.secundarias : [];

  const onSeguimientoActualizado = useCallback((datos) => {
    if (datos.acciones) setAccionesPrioritarias(datos.acciones);
    if (datos.parametros) setParametrosPrioritarios(datos.parametros);
    if (datos.opciones) setOpciones(datos.opciones);
    if (datos.tipo) setTipoSeguimiento(datos.tipo);
  }, []);

  function limpiarFormulario(mantenerFecha = true) {
    setAccionesElegidas(new Set());
    setValoresParametros({});
    setParamsHistoricos([]);
    setObservacion("");
    if (mantenerFecha) setFecha(partesFechaLocal().fecha);
    setErrorLocal("");
    setEditorPlantas(false);
    setEditandoId("");
    setMostrarMasParametros(false);
  }

  useEffect(() => {
    if (!estado?.ok || !estado.registro?.id) return;
    if (ultimoExitoId.current === estado.registro.id) return;
    ultimoExitoId.current = estado.registro.id;

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
  }, [estado]);

  function elegirUnidad(siguienteId) {
    setUnidadId(siguienteId);
    setErrorLocal("");
    setEditorPlantas(false);
    const siguiente = unidades.find((item) => item.id === siguienteId);
    const lista = siguiente?.plantas || [];
    if (modo === "ambiente") {
      setIdsSeleccionados(new Set());
      return;
    }
    if (modo === "unidad") {
      setIdsSeleccionados(new Set(lista.map((planta) => planta.id)));
      return;
    }
    setIdsSeleccionados(new Set());
  }

  function aplicarModo(siguiente) {
    setModo(siguiente);
    setErrorLocal("");
    if (siguiente === "ambiente") {
      setIdsSeleccionados(new Set());
      return;
    }
    if (siguiente === "unidad") {
      setIdsSeleccionados(new Set(plantas.map((planta) => planta.id)));
      return;
    }
    if (siguiente === "manual" || siguiente === "genetica") {
      setIdsSeleccionados(new Set());
    }
  }

  function elegirModo(siguiente) {
    const cambiaAplica = (siguiente === "ambiente") !== (modo === "ambiente");
    if (cambiaAplica && hayValoresParametros(valoresParametros)) {
      setModoPendiente(siguiente);
      return;
    }
    aplicarModo(siguiente);
  }

  function elegirGenetica(clave) {
    const grupo = gruposGenetica.find((item) => item.clave === clave);
    if (!grupo) return;
    setIdsSeleccionados(new Set(grupo.plantas.map((planta) => planta.id)));
    setErrorLocal("");
  }

  function alternarPlanta(plantaId) {
    if (modo === "ambiente") return;
    setIdsSeleccionados((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(plantaId)) siguiente.delete(plantaId);
      else siguiente.add(plantaId);
      return siguiente;
    });
    if (modo === "unidad" || modo === "genetica") {
      setModo("manual");
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

  function cargarEdicion(registro) {
    if (!registro?.id) return;
    setEditandoId(registro.id);
    setErrorLocal("");
    setConfigurar(false);

    if (registro.unidad_cultivo_id) {
      setUnidadId(registro.unidad_cultivo_id);
    }

    const aplica = registro.aplica_a === "ambiente" ? "ambiente" : "plantas";
    if (aplica === "ambiente") {
      setModo("ambiente");
      setIdsSeleccionados(new Set());
    } else if (registro.alcance === "unidad") {
      setModo("unidad");
      const unidadReg = unidades.find((item) => item.id === registro.unidad_cultivo_id);
      setIdsSeleccionados(new Set((unidadReg?.plantas || []).map((planta) => planta.id)));
    } else if (registro.alcance === "genetica") {
      setModo("genetica");
      setIdsSeleccionados(
        new Set((registro.registro_plantas || []).map((fila) => fila.planta_id).filter(Boolean))
      );
    } else {
      setModo(registro.alcance === "planta" ? "manual" : "manual");
      setIdsSeleccionados(
        new Set((registro.registro_plantas || []).map((fila) => fila.planta_id).filter(Boolean))
      );
    }

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
    setValoresParametros(valoresDesdeRegistroParametros(registro.registro_parametros));
    setParamsHistoricos(registro.registro_parametros || []);
    setMostrarMasParametros(true);
    setEditorPlantas(false);
  }

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

    const fechaEvento = fechaEventoDesdeDia(fecha);
    if (!fechaEvento) {
      return { error: "La fecha del evento no es válida." };
    }

    const catalogoAcciones = [
      ...accionesOrdenadas.prioritarias,
      ...accionesOrdenadas.secundarias,
    ];
    const acciones = catalogoAcciones
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

    const catalogoParametros = [
      ...parametrosOrdenados.prioritarias,
      ...parametrosOrdenados.secundarias,
    ];
    const parametrosOk = parametrosDesdeValores(valoresParametros, catalogoParametros);
    if (parametrosOk.error) return { error: parametrosOk.error };

    const observacionLimpia = observacion.trim();
    if (
      acciones.length === 0 &&
      parametrosOk.parametros.length === 0 &&
      !observacionLimpia
    ) {
      return { error: "El registro necesita una acción, un parámetro o una observación." };
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
    };

    if (editandoId) datos.id = editandoId;
    return { error: "", datos };
  }

  function enviar(formData) {
    setErrorLocal("");
    const armado = armarPayload();
    if (armado.error) {
      setErrorLocal(armado.error);
      return;
    }
    ultimoPayload.current = armado.datos;
    formData.set("registro", JSON.stringify(armado.datos));
    return accion(formData);
  }

  const listaHoy = [
    ...exitosLocales,
    ...registrosHoy.filter((item) => !exitosLocales.some((local) => local.id === item.id)),
  ];

  const opcionesUnidad = unidades.map((item) => ({
    valor: item.id,
    etiqueta: `${item.nombre} · ${item.espacio_nombre}`,
  }));

  return (
    <div className="registro-crear">
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
              disabled={pendiente}
            >
              Cancelar edición
            </button>
          </p>
        ) : null}

        <header className="registro-crear__cabecera">
          <Selector
            etiqueta="Unidad"
            valor={unidadId || null}
            onChange={elegirUnidad}
            opciones={opcionesUnidad}
            placeholder="Elegir unidad"
            id="registro-unidad"
          />
          {unidad ? (
            <div className="registro-crear__contexto">
              <p className="registro-crear__contexto-titulo">{unidad.nombre}</p>
              <p className="registro-crear__contexto-meta">
                {aplicaA === "ambiente"
                  ? "Ambiente"
                  : textoCantidad(plantasSeleccionadas.length)}
                {" · "}
                {formatearFecha(fecha)}
              </p>
            </div>
          ) : null}
        </header>

        <section className="registro-crear__seccion">
          <h2 className="registro-crear__etiqueta">Fecha del evento</h2>
          <div className="registro-crear__cuando">
            <SelectorFecha
              valor={fecha}
              onChange={setFecha}
              id="registro-fecha"
              deshabilitado={pendiente}
            />
          </div>
        </section>

        <section className="registro-crear__seccion">
          <h2 className="registro-crear__etiqueta">Plantas seleccionadas</h2>
          <div className="registro-crear__resumen">
            <div className="registro-crear__resumen-texto">
              <p className="registro-crear__resumen-titulo">{resumen.titulo}</p>
              <p className="registro-crear__resumen-detalle">{resumen.detalle}</p>
            </div>
            <button
              type="button"
              className="registro-crear__enlace"
              onClick={() => setEditorPlantas((valor) => !valor)}
              disabled={pendiente}
            >
              {editorPlantas ? "Cerrar selección" : "Editar selección"}
            </button>
          </div>

          <Aparecer visible={editorPlantas}>
            <div className="registro-crear__editor-plantas">
              <div className="registro-crear__chips">
                {MODOS.map((item) => (
                  <button
                    key={item.valor}
                    type="button"
                    className={`registro-crear__chip${modo === item.valor ? " registro-crear__chip--activo" : ""}`}
                    onClick={() => elegirModo(item.valor)}
                    disabled={pendiente}
                    aria-pressed={modo === item.valor}
                  >
                    {item.etiqueta}
                  </button>
                ))}
              </div>

              <Aparecer visible={modo === "ambiente"}>
                <p className="registro-crear__ayuda">
                  Ambiente de la unidad: no se asocia a plantas individuales.
                </p>
              </Aparecer>

              <Aparecer visible={modo === "genetica" && gruposGenetica.length > 0}>
                <div className="registro-crear__chips">
                  {gruposGenetica.map((grupo) => {
                    const activo =
                      plantasSeleccionadas.length === grupo.plantas.length &&
                      grupo.plantas.every((planta) => idsSeleccionados.has(planta.id));
                    return (
                      <button
                        key={grupo.clave}
                        type="button"
                        className={`registro-crear__chip${activo ? " registro-crear__chip--activo" : ""}`}
                        onClick={() => elegirGenetica(grupo.clave)}
                        disabled={pendiente}
                        aria-pressed={activo}
                      >
                        {grupo.etiqueta} ({grupo.plantas.length})
                      </button>
                    );
                  })}
                </div>
              </Aparecer>

              <Aparecer visible={modo === "genetica" && gruposGenetica.length === 0}>
                <p className="registro-crear__ayuda">
                  No hay genéticas cargadas en esta unidad. Usá selección manual.
                </p>
              </Aparecer>

              <Aparecer visible={modo !== "ambiente" && plantas.length > 0}>
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
                          disabled={pendiente}
                          aria-pressed={activa}
                          whileTap={pendiente ? undefined : toque}
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

              <Aparecer visible={modo !== "ambiente" && plantas.length === 0}>
                <p className="registro-crear__ayuda">Esta unidad todavía no tiene plantas.</p>
              </Aparecer>
            </div>
          </Aparecer>
        </section>

        <SeccionParametrosRegistro
          prioritarias={parametrosOrdenados.prioritarias}
          secundarias={parametrosOrdenados.secundarias}
          valores={valoresParametros}
          onChange={(clave, valor) =>
            setValoresParametros((actual) => ({ ...actual, [clave]: valor }))
          }
          mostrarMas={mostrarMasParametros}
          onToggleMas={() => setMostrarMasParametros((valor) => !valor)}
          pendiente={pendiente}
        />

        <section className="registro-crear__seccion">
          <h2 className="registro-crear__etiqueta">Acciones</h2>
          <div className="registro-crear__acciones-grid">
            {accionesVisibles.map((item) => {
              const clave = claveAccion(item);
              return (
                <BotonAccion
                  key={clave}
                  item={item}
                  activa={accionesElegidas.has(clave)}
                  disabled={pendiente}
                  onClick={() => alternarAccion(item)}
                />
              );
            })}
          </div>
          {accionesExtra.length > 0 ? (
            <>
              <button
                type="button"
                className="registro-crear__enlace"
                onClick={() => setMostrarMasAcciones((valor) => !valor)}
                disabled={pendiente}
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
                        disabled={pendiente}
                        onClick={() => alternarAccion(item)}
                      />
                    );
                  })}
                </div>
              </Aparecer>
            </>
          ) : null}
          <button
            type="button"
            className="registro-crear__enlace"
            onClick={() => setConfigurar((valor) => !valor)}
            disabled={pendiente}
          >
            {configurar ? "Cerrar seguimiento" : "Configurar seguimiento"}
          </button>
        </section>

        <Aparecer visible={configurar}>
          <div className="registro-crear__seguimiento">
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

        <section className="registro-crear__seccion">
          <h2 className="registro-crear__etiqueta">Observaciones</h2>
          <label className="formulario__campo registro-crear__observacion">
            <span className="registro-crear__sr">Observación</span>
            <textarea
              value={observacion}
              onChange={(evento) => setObservacion(evento.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="¿Qué sucedió con estas plantas?"
              disabled={pendiente}
            />
          </label>
        </section>

        {listaHoy.length > 0 ? (
          <section className="registro-crear__hoy">
            <h2 className="registro-crear__etiqueta">Registros de hoy</h2>
            <ul className="registro-crear__lista">
              {listaHoy.map((item) => {
                const hora = etiquetaHora(item.fecha_evento);
                return (
                  <li key={item.id}>
                    <span className="registro-crear__lista-hora">{hora || "—"}</span>
                    <span className="registro-crear__lista-texto">
                      {etiquetaResumenRegistro(item)}
                      {item.observacion &&
                      !(item.registro_acciones || []).length &&
                      !(item.registro_parametros || []).length
                        ? ""
                        : item.observacion
                          ? ` · ${item.observacion}`
                          : ""}
                      {" "}
                      <button
                        type="button"
                        className="registro-crear__enlace"
                        onClick={() => cargarEdicion(item)}
                        disabled={pendiente}
                      >
                        Editar
                      </button>
                    </span>
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
            disabled={pendiente || !unidad}
          >
            {pendiente
              ? "Guardando..."
              : editandoId
                ? "Guardar cambios"
                : "Guardar registro"}
          </Boton>
        </div>
      </form>

      <ModalConfirmacion
        abierto={Boolean(modoPendiente)}
        onCerrar={() => setModoPendiente("")}
        titulo="Cambiar alcance"
        descripcion="Hay parámetros escritos. Se aplicarán al nuevo alcance (plantas o ambiente)."
        textoConfirmar="Cambiar alcance"
        textoCancelar="Cancelar"
        onConfirmar={() => {
          aplicarModo(modoPendiente);
          setModoPendiente("");
        }}
      />
    </div>
  );
}
