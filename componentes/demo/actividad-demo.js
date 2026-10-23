"use client";

import { useState } from "react";
import { Aparecer } from "@/componentes/aparecer";
import { IconoChevron } from "@/componentes/iconos-ui";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import {
  fechaHoraRegistro,
  resumenRegistroDemo,
  textoAlcanceRegistro,
  textoParametro,
} from "@/lib/demo/registros-demo";

const LIMITE_VISIBLE = 5;

function DetalleRegistro({ registro, ubicacion }) {
  const acciones = registro.registro_acciones || [];
  const parametros = registro.registro_parametros || [];
  const plantas = registro.registro_plantas || [];

  return (
    <dl className="demo-actividad__detalle">
      <div>
        <dt>Fecha del evento</dt>
        <dd>{fechaHoraRegistro(registro.fecha_evento)}</dd>
      </div>
      <div>
        <dt>Ubicación</dt>
        <dd>{ubicacion}</dd>
      </div>
      {plantas.length ? (
        <div>
          <dt>Plantas</dt>
          <dd>{plantas.map((fila) => fila.nombre_planta).join(", ")}</dd>
        </div>
      ) : null}
      {acciones.length ? (
        <div>
          <dt>Acciones</dt>
          <dd>{acciones.map((fila) => fila.nombre).join(", ")}</dd>
        </div>
      ) : null}
      {parametros.length ? (
        <div>
          <dt>Parámetros</dt>
          <dd>{parametros.map(textoParametro).join(" · ")}</dd>
        </div>
      ) : null}
      {registro.observacion ? (
        <div>
          <dt>Observación</dt>
          <dd>{registro.observacion}</dd>
        </div>
      ) : null}
      <div>
        <dt>{registro.fecha_actualizacion ? "Editado en la demo" : "Cargado en la demo"}</dt>
        <dd>{fechaHoraRegistro(registro.fecha_actualizacion || registro.fecha_creacion)}</dd>
      </div>
    </dl>
  );
}

export function ActividadDemo({ registros, titulo = "Actividad reciente", vacio, id = "demo-actividad" }) {
  const { estado } = useDemo();
  const [abierto, setAbierto] = useState("");
  const [todos, setTodos] = useState(false);
  const visibles = todos ? registros : registros.slice(0, LIMITE_VISIBLE);

  function ubicacion(registro) {
    const unidad = estado.unidades.find((item) => item.id === registro.unidad_cultivo_id);
    const espacio = estado.espacios.find((item) => item.id === registro.espacio_id);
    return [espacio?.nombre, unidad?.nombre].filter(Boolean).join(" · ");
  }

  return (
    <section className="demo-actividad" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`}>{titulo}</h2>
      {registros.length === 0 ? (
        <p className="demo__aviso">{vacio}</p>
      ) : (
        <ListaEntrada className="lista demo-actividad__lista">
          {visibles.map((registro) => {
            const expandido = abierto === registro.id;
            return (
              <li key={registro.id} className="tarjeta demo-actividad__item">
                <button
                  type="button"
                  className="demo-actividad__resumen demo-pulsable"
                  aria-expanded={expandido}
                  aria-controls={`${id}-${registro.id}`}
                  onClick={() => setAbierto(expandido ? "" : registro.id)}
                >
                  <span className="demo-actividad__cabecera">
                    <span className="tarjeta__tipo">
                      {registro.aplica_a === "ambiente" ? "Ambiente" : "Plantas"}
                    </span>
                    <span className="tarjeta__meta">{fechaHoraRegistro(registro.fecha_evento)}</span>
                  </span>
                  <span className="demo-actividad__texto">{resumenRegistroDemo(registro)}</span>
                  <span className="demo-actividad__pie">
                    <span className="tarjeta__meta">
                      {ubicacion(registro)} · {textoAlcanceRegistro(registro)}
                    </span>
                    <span
                      className={`demo-actividad__chevron${expandido ? " demo-actividad__chevron--abierto" : ""}`}
                      aria-hidden="true"
                    >
                      <IconoChevron />
                    </span>
                  </span>
                </button>
                <div id={`${id}-${registro.id}`}>
                  <Aparecer visible={expandido}>
                    <DetalleRegistro registro={registro} ubicacion={ubicacion(registro)} />
                  </Aparecer>
                </div>
              </li>
            );
          })}
        </ListaEntrada>
      )}
      {registros.length > LIMITE_VISIBLE ? (
        <button
          type="button"
          className="registro-crear__enlace demo-enlace"
          onClick={() => setTodos((valor) => !valor)}
        >
          {todos ? "Ver menos" : `Ver todos (${registros.length})`}
        </button>
      ) : null}
    </section>
  );
}
