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
} from "@/lib/demo/registros-demo";

const LIMITE_VISIBLE = 5;

function valorParametro(fila) {
  if (fila.tipo_valor === "numero") return fila.valor_numero;
  return fila.valor_texto;
}

function DetalleRegistro({ registro }) {
  const acciones = registro.registro_acciones || [];
  const parametros = registro.registro_parametros || [];
  const plantas = registro.registro_plantas || [];

  return (
    <div className="demo-actividad__detalle">
      <dl>
        <div>
          <dt>Fecha del evento</dt>
          <dd>{fechaHoraRegistro(registro.fecha_evento)}</dd>
        </div>
        {plantas.length ? (
          <div>
            <dt>Plantas</dt>
            <dd>
              <ul className="demo-actividad__chips">
                {plantas.map((fila, indice) => (
                  <li key={fila.planta_id || `${fila.nombre_planta}-${indice}`} className="demo-actividad__chip">
                    {fila.nombre_planta}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {acciones.length ? (
          <div>
            <dt>Acciones</dt>
            <dd>
              <ul className="demo-actividad__chips">
                {acciones.map((fila, indice) => (
                  <li key={fila.clave_nativa || `${fila.nombre}-${indice}`} className="demo-actividad__chip">
                    {fila.nombre}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {parametros.length ? (
          <div>
            <dt>Parámetros</dt>
            <dd>
              <ul className="demo-actividad__mediciones">
                {parametros.map((fila, indice) => (
                  <li key={fila.clave_nativa || `${fila.nombre}-${indice}`} className="demo-actividad__medicion">
                    <span className="demo-actividad__medicion-nombre">{fila.nombre}</span>
                    <span className="demo-actividad__medicion-valor">
                      {valorParametro(fila)}
                      {fila.unidad ? <span className="demo-actividad__medicion-unidad"> {fila.unidad}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {registro.observacion ? (
          <div>
            <dt>Observación</dt>
            <dd className="demo-actividad__nota">{registro.observacion}</dd>
          </div>
        ) : null}
      </dl>
    </div>
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
                    <span className="demo-actividad__lugar">
                      {[ubicacion(registro), textoAlcanceRegistro(registro)].filter(Boolean).join(" · ")}
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
                    <DetalleRegistro registro={registro} />
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
