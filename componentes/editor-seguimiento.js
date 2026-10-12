"use client";

import { useActionState, useEffect, useState } from "react";
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

export function EditorSeguimiento({
  modo = "edicion",
  tipoInicial = "",
  acciones = [],
  parametros = [],
  opcionesIniciales = [],
  encabezado = "",
  textoGuardar = "Guardar preferencias",
  continuarEn = "",
}) {
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

  useEffect(() => {
    if (!estado?.ok) return;
    setElegidas({ acciones: estado.acciones, parametros: estado.parametros });
    setEditado(false);
  }, [estado]);

  useEffect(() => {
    if (!estadoCrear?.ok || estadoCrear.marca !== marca || !estadoCrear.opcion) return;
    setOpciones((lista) => {
      if (lista.some((item) => item.id === estadoCrear.opcion.id)) return lista;
      return [...lista, estadoCrear.opcion];
    });
    setBorrador(null);
    setEditado(true);
  }, [estadoCrear, marca]);

  useEffect(() => {
    if (!estadoEditar?.ok || estadoEditar.marca !== marca || !estadoEditar.opcion) return;
    setOpciones((lista) =>
      lista.map((item) =>
        item.id === estadoEditar.opcion.id
          ? { ...estadoEditar.opcion, prioritaria: item.prioritaria }
          : item
      )
    );
    setBorrador(null);
    setEditado(true);
  }, [estadoEditar, marca]);

  function elegirTipo(siguiente) {
    setTipo(siguiente);
    setEditado(true);
    if (modo === "inicial") {
      setElegidas(presetDe(siguiente));
    }
  }

  function cambiar(grupo, valor, activo) {
    setEditado(true);
    setElegidas((actual) => ({
      ...actual,
      [grupo]: alternar(actual[grupo], valor, activo),
    }));
  }

  function cambiarOpcion(id, activo) {
    setEditado(true);
    setOpciones((lista) =>
      lista.map((item) => (item.id === id ? { ...item, prioritaria: activo } : item))
    );
  }

  function restablecer() {
    if (tipo !== "relajado" && tipo !== "profesional") return;
    setEditado(true);
    setElegidas(presetDe(tipo));
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
    setOpciones((lista) => lista.filter((item) => item.id !== borrador.id));
    setBorrador(null);
    setEditado(true);
  }

  const accionesPropias = opciones.filter((item) => item.categoria === "accion");
  const parametrosPropios = opciones.filter((item) => item.categoria === "parametro");
  const editando = Boolean(borrador?.id);
  const estadoModal = editando ? estadoEditar : estadoCrear;
  const errorModal = estadoModal?.marca === marca ? estadoModal.error : "";
  const puedeRestablecer = tipo === "relajado" || tipo === "profesional";

  return (
    <form className="formulario editor-seguimiento" action={accion}>
      {encabezado ? <h2>{encabezado}</h2> : null}
      <p>
        Estas preferencias determinan qué herramientas aparecerán primero. No limitan las funciones disponibles.
      </p>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
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
      <div className="acciones">
        <Boton type="submit" disabled={pendiente || !tipo}>
          {pendiente ? "Guardando..." : textoGuardar}
        </Boton>
        {puedeRestablecer ? (
          <Boton
            type="button"
            className="preferencias__restablecer"
            onClick={restablecer}
            disabled={pendiente}
          >
            Restablecer según mi tipo
          </Boton>
        ) : null}
      </div>
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
}
