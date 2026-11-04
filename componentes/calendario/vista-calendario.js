"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { BotonEstado } from "@/componentes/calendario/boton-estado";
import { FiltrosCalendario } from "@/componentes/calendario/filtros-calendario";
import { FormularioTarea } from "@/componentes/calendario/formulario-tarea";
import { TarjetaMes } from "@/componentes/calendario/tarjeta-mes";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import {
  cancelarTarea,
  cargarVistaCalendario,
  completarTarea,
  eliminarTarea,
  reabrirTarea,
} from "@/app/calendario/acciones";
import { formatearFecha } from "@/lib/etapas";
import { etiquetaEstado, etiquetaTipo, hrefCalendario, hrefRegistroDesdeTarea, normalizarConsulta } from "@/lib/calendario/modelo";

function metaTarea(tarea, espacios, hoy) {
  const partes = [];
  if (tarea.estado === "pendiente" && hoy && tarea.fecha < hoy) partes.push("Vencida");
  const cultivo = nombreCultivo(espacios, tarea.unidadId);
  if (cultivo) partes.push(cultivo);
  if (tarea.plantaIds.length) {
    partes.push(tarea.plantaIds.length === 1 ? "1 planta" : `${tarea.plantaIds.length} plantas`);
  }
  const estado = etiquetaEstado(tarea.estado);
  if (estado) partes.push(estado);
  return partes.join(" · ");
}

function nombreCultivo(espacios, unidadId) {
  for (const espacio of espacios) {
    const unidad = espacio.unidades.find((item) => item.id === unidadId);
    if (unidad) return `${espacio.nombre} · ${unidad.nombre}`;
  }
  return "";
}

function Retorno({ filtros, tarea }) {
  return (
    <>
      <input type="hidden" name="id" value={tarea.id} />
      <input type="hidden" name="espacio_id" value={tarea.espacioId} />
      <input type="hidden" name="unidad_id" value={tarea.unidadId} />
      <input type="hidden" name="retorno_mes" value={filtros.mes} />
      <input type="hidden" name="retorno_unidad" value={filtros.unidad} />
      <input type="hidden" name="retorno_estado" value={filtros.estado} />
      <input type="hidden" name="retorno_fecha" value={filtros.fecha} />
    </>
  );
}

function hrefSinTarea(filtros, extra = {}) {
  return hrefCalendario({
    mes: filtros.mes,
    unidad: filtros.unidad,
    estado: filtros.estado,
    fecha: filtros.fecha,
    ...extra,
  });
}

function corteDe(filtros) {
  return `${filtros.mes}|${filtros.unidad}|${filtros.estado}`;
}

function escribirUrl(filtros) {
  const href = hrefCalendario({
    mes: filtros.mes,
    unidad: filtros.unidad,
    estado: filtros.estado,
    fecha: filtros.fecha,
    nueva: filtros.nueva,
    editar: filtros.editar,
    tarea: filtros.tarea,
    confirmar: filtros.confirmar,
  });
  const actual = `${window.location.pathname}${window.location.search}`;
  if (actual === href) return;
  History.prototype.replaceState.call(window.history, window.history.state, "", href);
}

function conFecha(base, siguiente) {
  return {
    ...base,
    error: false,
    enfocada: null,
    filtros: {
      ...base.filtros,
      mes: siguiente.mes,
      unidad: siguiente.unidad,
      estado: siguiente.estado,
      fecha: siguiente.fecha,
      tarea: "",
      editar: "",
      confirmar: "",
      nueva: false,
    },
    tareasDia: siguiente.fecha ? base.tareasMes.filter((tarea) => tarea.fecha === siguiente.fecha) : [],
  };
}

export function VistaCalendario({ datos: iniciales }) {
  const [datos, setDatos] = useState(iniciales);
  const cache = useRef(new Map([[corteDe(iniciales.filtros), iniciales]]));
  const pedido = useRef(0);
  const { filtros, espacios, tareasMes, tareasDia, proximas, enfocada } = datos;

  function aplicar(parcial) {
    const siguiente = normalizarConsulta(
      {
        mes: filtros.mes,
        unidad: filtros.unidad,
        estado: filtros.estado,
        fecha: filtros.fecha,
        ...parcial,
      },
      filtros.hoy,
    );
    const corte = corteDe(siguiente);
    const mismoCorte = corte === corteDe(filtros);
    if (mismoCorte) {
      setDatos((prev) => conFecha(prev, siguiente));
      escribirUrl(siguiente);
      return;
    }

    const guardado = cache.current.get(corte);
    if (guardado) {
      setDatos(conFecha(guardado, siguiente));
      escribirUrl(siguiente);
      return;
    }

    const mismaLista = siguiente.unidad === filtros.unidad && siguiente.estado === filtros.estado;
    setDatos((prev) => ({
      ...conFecha(prev, siguiente),
      tareasMes: [],
      tareasDia: [],
      proximas: mismaLista ? prev.proximas : [],
    }));
    escribirUrl(siguiente);

    const id = pedido.current + 1;
    pedido.current = id;
    cargarVistaCalendario({
      mes: siguiente.mes,
      unidad: siguiente.unidad,
      estado: siguiente.estado,
      fecha: siguiente.fecha,
    }).then((nuevo) => {
      if (id !== pedido.current) return;
      if (!nuevo?.disponible || nuevo.error || !nuevo.filtros) {
        setDatos((prev) => ({ ...prev, error: true }));
        return;
      }
      cache.current.set(corte, nuevo);
      setDatos(conFecha(nuevo, siguiente));
    });
  }

  function abrirNueva() {
    const siguiente = { ...filtros, nueva: true, editar: "", tarea: "", confirmar: "" };
    setDatos((prev) => ({ ...prev, filtros: { ...prev.filtros, ...siguiente } }));
    escribirUrl(siguiente);
  }

  function cerrarEditor() {
    const siguiente = { ...filtros, nueva: false, editar: "", tarea: "", confirmar: "" };
    setDatos((prev) => ({ ...prev, enfocada: null, filtros: { ...prev.filtros, ...siguiente } }));
    escribirUrl(siguiente);
  }

  const unidades = espacios.flatMap((espacio) =>
    espacio.unidades.map((unidad) => ({
      id: unidad.id,
      etiqueta: `${espacio.nombre} · ${unidad.nombre}`,
      cantidadPlantas: unidad.plantas?.length || 0,
    })),
  );
  const listaBase = filtros.fecha ? tareasDia : filtros.estado === "pendiente" ? proximas : tareasMes;
  const lista =
    enfocada && filtros.tarea === enfocada.id && !listaBase.some((tarea) => tarea.id === enfocada.id)
      ? [enfocada, ...listaBase]
      : listaBase;
  const tituloLista = filtros.fecha
    ? "Tareas del día"
    : filtros.estado === "pendiente"
      ? "Próximas tareas"
      : "Tareas del mes";
  const mostrarEditor = Boolean(filtros.nueva || filtros.editar);
  const tareaEditor = filtros.editar ? enfocada : null;

  return (
    <div className="calendario">
      <header className="calendario__cabecera">
        <h1>Calendario</h1>
      </header>
      {unidades.length ? (
        <FabNuevoChatFlora
          onClick={abrirNueva}
          ariaLabel="Nueva tarea"
          icono={<CalendarPlus strokeWidth={2.25} aria-hidden="true" />}
        />
      ) : null}

      <FiltrosCalendario filtros={filtros} unidades={unidades} onUnidad={(unidad) => aplicar({ unidad })} />

      <TarjetaMes
        filtros={filtros}
        tareasMes={tareasMes}
        tareasDia={tareasDia}
        onMes={(mes) => aplicar({ mes, fecha: "" })}
        onDia={(fecha) =>
          aplicar({
            mes: filtros.fecha === fecha ? filtros.mes : fecha.slice(0, 7),
            fecha: filtros.fecha === fecha ? "" : fecha,
          })
        }
      />

      {mostrarEditor ? (
        tareaEditor || filtros.nueva ? (
          espacios.length ? (
            <FormularioTarea
              key={tareaEditor?.id || "nueva"}
              espacios={espacios}
              filtros={filtros}
              tarea={tareaEditor}
              onCerrar={cerrarEditor}
            />
          ) : (
            <p className="calendario__vacio">Necesitás un espacio con una unidad para crear tareas.</p>
          )
        ) : (
          <p className="formulario__error" role="alert">
            No se encontró la tarea.
          </p>
        )
      ) : null}

      <section className="calendario__lista" aria-labelledby="calendario-lista">
        <h2 id="calendario-lista">{tituloLista}</h2>
        {datos.error ? (
          <p className="formulario__error" role="alert">
            No se pudieron cargar las tareas.
          </p>
        ) : null}
        {lista.length ? (
          <ul>
            {lista.map((tarea) => {
              const pendiente = tarea.estado === "pendiente";
              const foco = filtros.tarea === tarea.id;
              return (
                <li key={tarea.id} id={`tarea-${tarea.id}`} className={foco ? "calendario__item calendario__item--foco" : "calendario__item"}>
                  <div className="calendario__item-texto">
                    <span className="calendario__tipo">{etiquetaTipo(tarea.tipo)}</span>
                    <span className="calendario__cuando">
                      {formatearFecha(tarea.fecha)} · {tarea.hora}
                    </span>
                    <p>{tarea.descripcion}</p>
                    <p className="calendario__meta">{metaTarea(tarea, espacios, filtros.hoy)}</p>
                    {pendiente && tarea.avisoPush ? (
                      <p className="calendario__meta">
                        {tarea.avisoEnviadoEn ? "Aviso enviado" : `Aviso programado a las ${tarea.hora}, hora de Argentina`}
                      </p>
                    ) : null}
                  </div>
                  <div className="calendario__acciones">
                    {pendiente ? (
                      <Link href={hrefRegistroDesdeTarea(tarea)}>Registrar</Link>
                    ) : null}
                    {pendiente ? (
                      <BotonEstado action={completarTarea} etiqueta="Completar">
                        <Retorno filtros={filtros} tarea={tarea} />
                      </BotonEstado>
                    ) : (
                      <BotonEstado action={reabrirTarea} etiqueta="Volver a pendiente">
                        <Retorno filtros={filtros} tarea={tarea} />
                      </BotonEstado>
                    )}
                    {pendiente ? (
                      <Link href={hrefSinTarea(filtros, { editar: tarea.id })}>Reprogramar</Link>
                    ) : null}
                    {pendiente ? (
                      <BotonEstado action={cancelarTarea} etiqueta="Cancelar">
                        <Retorno filtros={filtros} tarea={tarea} />
                      </BotonEstado>
                    ) : null}
                    {filtros.confirmar === tarea.id ? (
                      <BotonEstado action={eliminarTarea} etiqueta="Eliminar" className="boton boton--ghost calendario__peligro">
                        <Retorno filtros={filtros} tarea={tarea} />
                      </BotonEstado>
                    ) : (
                      <Link
                        href={hrefSinTarea(filtros, { tarea: tarea.id, confirmar: tarea.id })}
                        className="calendario__peligro"
                      >
                        Eliminar
                      </Link>
                    )}
                  </div>
                  {pendiente ? (
                    <p className="calendario__ayuda">Completar no crea un registro de cultivo. Registrar abre el formulario con esta unidad.</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="calendario__vacio">No hay tareas para este filtro.</p>
        )}
      </section>
    </div>
  );
}
