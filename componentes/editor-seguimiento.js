"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  crearOpcionSeguimiento,
  editarOpcionSeguimiento,
  desactivarOpcionSeguimiento,
  guardarConfiguracionSeguimiento,
} from "@/app/seguimiento/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { IconoPreferencia } from "@/componentes/icono-preferencia";
import { ModalOpcionSeguimiento } from "@/componentes/modal-opcion-seguimiento";
import { OpcionPreferencia } from "@/componentes/opcion-preferencia";
import { SelectorSeguimiento } from "@/componentes/selector-seguimiento";
import {
  ACCIONES_SEGUIMIENTO,
  PARAMETROS_SEGUIMIENTO,
  presetDe,
} from "@/lib/seguimiento";

function esRedireccion(error) {
  return typeof error?.digest === "string" && error.digest.startsWith("NEXT_REDIRECT");
}

function alternar(lista, valor, activo) {
  if (activo) {
    return lista.includes(valor) ? lista : [...lista, valor];
  }
  return lista.filter((item) => item !== valor);
}

function detalleDe(opcion) {
  const partes = ["Personalizado"];
  if (opcion.unidad) partes.push(opcion.unidad);
  return partes.join(" · ");
}

export const EditorSeguimiento = forwardRef(function EditorSeguimiento(
  {
    modo = "edicion",
    tipoInicial = "",
    acciones = [],
    parametros = [],
    opcionesIniciales = [],
    encabezado = "",
    textoGuardar = "Guardar preferencias",
    continuarEn = "",
    onActualizado,
    onSucioChange,
    ocultarGuardar = false,
    idFormulario,
  },
  ref,
) {
  const formRef = useRef(null);
  const [estado, accion, pendiente] = useActionState(guardarConfiguracionSeguimiento, null);
  const [estadoCrear, accionCrear, pendienteCrear] = useActionState(crearOpcionSeguimiento, null);
  const [estadoEditar, accionEditar, pendienteEditar] = useActionState(editarOpcionSeguimiento, null);
  const [tipo, setTipo] = useState(tipoInicial || "");
  const [elegidas, setElegidas] = useState({
    acciones: acciones || [],
    parametros: parametros || [],
  });
  const [opciones, setOpciones] = useState(opcionesIniciales || []);
  const [editado, setEditado] = useState(false);
  const [borrador, setBorrador] = useState(null);
  const [marca, setMarca] = useState("");
  const [pendienteQuitar, setPendienteQuitar] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState("");
  const [respaldoPersonalizado, setRespaldoPersonalizado] = useState(null);
  const [errorLocal, setErrorLocal] = useState("");

  useImperativeHandle(ref, () => ({
    async guardar() {
      const formulario = formRef.current;
      if (!formulario) return false;
      setErrorLocal("");
      const datos = new FormData(formulario);
      try {
        const resultado = await guardarConfiguracionSeguimiento(null, datos);
        if (resultado?.error) {
          setErrorLocal(resultado.error);
          return false;
        }
        if (resultado?.ok) {
          setElegidas({ acciones: resultado.acciones, parametros: resultado.parametros });
          setEditado(false);
          onSucioChange?.(false);
          onActualizado?.({
            tipo: resultado.tipo || tipo,
            acciones: resultado.acciones,
            parametros: resultado.parametros,
            opciones,
          });
          return true;
        }
        return false;
      } catch (error) {
        if (esRedireccion(error)) {
          setEditado(false);
          onSucioChange?.(false);
          throw error;
        }
        setErrorLocal("No se pudo guardar la configuración.");
        return false;
      }
    },
  }));

  useEffect(() => {
    if (!estado?.ok) return;
    setElegidas({ acciones: estado.acciones, parametros: estado.parametros });
    setEditado(false);
    onSucioChange?.(false);
    onActualizado?.({
      tipo: estado.tipo || tipo,
      acciones: estado.acciones,
      parametros: estado.parametros,
      opciones,
    });
  }, [estado]);

  useEffect(() => {
    onSucioChange?.(editado);
  }, [editado, onSucioChange]);

  useEffect(() => {
    if (!estadoCrear?.ok || estadoCrear.marca !== marca || !estadoCrear.opcion) return;
    setOpciones((lista) => {
      if (lista.some((item) => item.id === estadoCrear.opcion.id)) return lista;
      const siguiente = [...lista, estadoCrear.opcion];
      onActualizado?.({
        tipo,
        acciones: elegidas.acciones,
        parametros: elegidas.parametros,
        opciones: siguiente,
      });
      return siguiente;
    });
    setBorrador(null);
    setEditado(true);
  }, [estadoCrear, marca]);

  useEffect(() => {
    if (!estadoEditar?.ok || estadoEditar.marca !== marca || !estadoEditar.opcion) return;
    setOpciones((lista) => {
      const siguiente = lista.map((item) =>
        item.id === estadoEditar.opcion.id
          ? { ...estadoEditar.opcion, prioritaria: item.prioritaria }
          : item
      );
      onActualizado?.({
        tipo,
        acciones: elegidas.acciones,
        parametros: elegidas.parametros,
        opciones: siguiente,
      });
      return siguiente;
    });
    setBorrador(null);
    setEditado(true);
  }, [estadoEditar, marca]);

  function capturarSeleccion() {
    return {
      acciones: [...elegidas.acciones],
      parametros: [...elegidas.parametros],
      opciones: opciones.map((item) => ({
        id: item.id,
        prioritaria: Boolean(item.prioritaria),
      })),
    };
  }

  function restaurarSeleccion(respaldo) {
    setElegidas({
      acciones: [...respaldo.acciones],
      parametros: [...respaldo.parametros],
    });
    const mapa = new Map(respaldo.opciones.map((item) => [item.id, item.prioritaria]));
    setOpciones((lista) =>
      lista.map((item) =>
        mapa.has(item.id) ? { ...item, prioritaria: mapa.get(item.id) } : item
      )
    );
  }

  function elegirTipo(siguiente) {
    if (siguiente === tipo) return;
    setTipo(siguiente);
    setEditado(true);

    if (siguiente === "relajado" || siguiente === "profesional") {
      const saleDePreset = tipo === "relajado" || tipo === "profesional";
      if (!saleDePreset || !respaldoPersonalizado) {
        setRespaldoPersonalizado(capturarSeleccion());
      }
      setElegidas(presetDe(siguiente));
      setOpciones((lista) => lista.map((item) => ({ ...item, prioritaria: false })));
      return;
    }

    if (siguiente === "personalizado" && respaldoPersonalizado) {
      restaurarSeleccion(respaldoPersonalizado);
    }
  }

  function pasarAPersonalizado(siguienteElegidas, siguientesOpciones) {
    if (tipo !== "relajado" && tipo !== "profesional") return;
    setTipo("personalizado");
    setRespaldoPersonalizado({
      acciones: [...siguienteElegidas.acciones],
      parametros: [...siguienteElegidas.parametros],
      opciones: siguientesOpciones.map((item) => ({
        id: item.id,
        prioritaria: Boolean(item.prioritaria),
      })),
    });
  }

  function cambiar(grupo, valor, activo) {
    setEditado(true);
    const siguiente = {
      ...elegidas,
      [grupo]: alternar(elegidas[grupo], valor, activo),
    };
    setElegidas(siguiente);
    pasarAPersonalizado(siguiente, opciones);
  }

  function cambiarOpcion(id, activo) {
    setEditado(true);
    const siguientes = opciones.map((item) =>
      item.id === id ? { ...item, prioritaria: activo } : item
    );
    setOpciones(siguientes);
    pasarAPersonalizado(elegidas, siguientes);
  }

  function abrir(categoria, opcion) {
    setErrorQuitar("");
    setMarca(String(Date.now()));
    setBorrador(
      opcion || {
        categoria,
        nombre: "",
        tipo_valor: "numero",
        unidad: "",
      }
    );
  }

  async function quitar() {
    if (!borrador?.id) return;
    setPendienteQuitar(true);
    setErrorQuitar("");
    const resultado = await desactivarOpcionSeguimiento(borrador.id);
    setPendienteQuitar(false);
    if (resultado?.error) {
      setErrorQuitar(resultado.error);
      return;
    }
    setOpciones((lista) => {
      const siguiente = lista.filter((item) => item.id !== borrador.id);
      onActualizado?.({
        tipo,
        acciones: elegidas.acciones,
        parametros: elegidas.parametros,
        opciones: siguiente,
      });
      return siguiente;
    });
    setBorrador(null);
    setEditado(true);
  }

  const accionesPropias = opciones.filter((item) => item.categoria === "accion");
  const parametrosPropios = opciones.filter((item) => item.categoria === "parametro");
  const editando = Boolean(borrador?.id);
  const estadoModal = editando ? estadoEditar : estadoCrear;
  const errorModal = estadoModal?.marca === marca ? estadoModal.error : "";
  return (
    <form
      ref={formRef}
      id={idFormulario}
      className="formulario editor-seguimiento"
      action={accion}
      onSubmit={ocultarGuardar ? (evento) => evento.preventDefault() : undefined}
    >
      {encabezado ? <h2>{encabezado}</h2> : null}
      <p>
        Estas preferencias determinan qué herramientas aparecerán primero. No limitan las funciones disponibles.
      </p>
      {errorLocal || estado?.error ? (
        <p className="formulario__error">{errorLocal || estado.error}</p>
      ) : null}
      <Aparecer visible={Boolean(estado?.ok) && !editado && !pendiente && modo === "edicion"}>
        <p className="preferencias__ok">Preferencias actualizadas.</p>
      </Aparecer>
      {continuarEn ? <input type="hidden" name="continuar_en" value={continuarEn} /> : null}
      <SelectorSeguimiento valor={tipo} onChange={elegirTipo} />
      <Aparecer visible={Boolean(tipo)}>
        <div className="editor-seguimiento__grupos">
          <fieldset className="preferencias">
            <legend>Acciones prioritarias</legend>
            <div className="preferencias__opciones">
              {ACCIONES_SEGUIMIENTO.map((item) => (
                <OpcionPreferencia
                  key={item.valor}
                  nombre="acciones"
                  valor={item.valor}
                  etiqueta={item.etiqueta}
                  activo={elegidas.acciones.includes(item.valor)}
                  disabled={pendiente}
                  onChange={(valor, activo) => cambiar("acciones", valor, activo)}
                />
              ))}
              {accionesPropias.map((item) => (
                <OpcionPreferencia
                  key={item.id}
                  nombre="opciones"
                  valor={item.id}
                  etiqueta={item.nombre}
                  detalle={detalleDe(item)}
                  icono="personalizado"
                  activo={Boolean(item.prioritaria)}
                  disabled={pendiente}
                  onChange={(valor, activo) => cambiarOpcion(valor, activo)}
                  onEditar={() => abrir("accion", item)}
                />
              ))}
              <button
                className="preferencia preferencia--agregar"
                type="button"
                disabled={pendiente}
                onClick={() => abrir("accion")}
              >
                <IconoPreferencia clave="agregar" />
                Agregar acción
              </button>
            </div>
          </fieldset>
          <fieldset className="preferencias">
            <legend>Parámetros prioritarios</legend>
            <div className="preferencias__opciones">
              {PARAMETROS_SEGUIMIENTO.map((item) => (
                <OpcionPreferencia
                  key={item.valor}
                  nombre="parametros"
                  valor={item.valor}
                  etiqueta={item.etiqueta}
                  detalle={item.unidad || ""}
                  activo={elegidas.parametros.includes(item.valor)}
                  disabled={pendiente}
                  onChange={(valor, activo) => cambiar("parametros", valor, activo)}
                />
              ))}
              {parametrosPropios.map((item) => (
                <OpcionPreferencia
                  key={item.id}
                  nombre="opciones"
                  valor={item.id}
                  etiqueta={item.nombre}
                  detalle={detalleDe(item)}
                  icono="personalizado"
                  activo={Boolean(item.prioritaria)}
                  disabled={pendiente}
                  onChange={(valor, activo) => cambiarOpcion(valor, activo)}
                  onEditar={() => abrir("parametro", item)}
                />
              ))}
              <button
                className="preferencia preferencia--agregar"
                type="button"
                disabled={pendiente}
                onClick={() => abrir("parametro")}
              >
                <IconoPreferencia clave="agregar" />
                Agregar parámetro
              </button>
            </div>
          </fieldset>
        </div>
      </Aparecer>
      {ocultarGuardar ? null : (
        <div className="acciones acciones--ancho">
          <Boton type="submit" className="boton--ancho" disabled={pendiente || !tipo}>
            {pendiente ? "Guardando..." : textoGuardar}
          </Boton>
        </div>
      )}
      {borrador ? (
        <ModalOpcionSeguimiento
          key={marca}
          borrador={borrador}
          marca={marca}
          pendiente={editando ? pendienteEditar : pendienteCrear}
          error={errorModal}
          accion={editando ? accionEditar : accionCrear}
          onCerrar={() => setBorrador(null)}
          onQuitar={quitar}
          pendienteQuitar={pendienteQuitar}
          errorQuitar={errorQuitar}
        />
      ) : null}
    </form>
  );
});
