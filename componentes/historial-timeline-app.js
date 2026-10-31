"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Boton } from "@/componentes/boton";
import { Selector } from "@/componentes/selector";
import { HistorialDiaApp } from "@/componentes/historial-dia-app";
import {
  agruparPorMes,
  diasFiltrados,
  etapasConRegistros,
  etiquetaEtapaHistorial,
  fotosDeDia,
  mapaFotos,
} from "@/lib/demo/historial/historial-demo";

const TODO_EL_CULTIVO = "todo";

function mapaCambiosEtapa(historial) {
  const mapa = new Map();

  function agregar(etapa, plantaNombre) {
    const fecha = etapa.fechaInicio;
    if (!fecha) return;
    const lista = mapa.get(fecha) || [];
    lista.push({ ...etapa, plantaNombre });
    mapa.set(fecha, lista);
  }

  if (historial.etapasPorPlanta?.length) {
    for (const grupo of historial.etapasPorPlanta) {
      for (const etapa of grupo.etapas || []) {
        agregar(etapa, grupo.nombre || "Planta");
      }
    }
  } else {
    for (const etapa of historial.etapas || []) {
      agregar(etapa, null);
    }
  }

  return mapa;
}

export function HistorialTimelineApp({
  historial,
  onEliminado = () => {},
  hayMasDias = false,
  cargandoMas = false,
  errorMas = "",
  onCargarMasDias = null,
  onReintentarMas = null,
  children = null,
}) {
  const [etapa, setEtapa] = useState("");
  const centinelaRef = useRef(null);
  const mapa = useMemo(() => mapaFotos(historial), [historial]);
  const cambiosPorDia = useMemo(() => mapaCambiosEtapa(historial), [historial]);
  const etapas = etapasConRegistros(historial);
  const dias = diasFiltrados(historial, etapa);
  const grupos = agruparPorMes(dias);

  function filtrar(valor) {
    setEtapa(valor);
  }

  useEffect(() => {
    const nodo = centinelaRef.current;
    if (!nodo || !hayMasDias || cargandoMas || errorMas || !onCargarMasDias) return undefined;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) onCargarMasDias();
      },
      { root: null, rootMargin: "240px 0px" }
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [hayMasDias, cargandoMas, errorMas, onCargarMasDias, dias.length]);

  return (
    <section className="historial-timeline" aria-labelledby="historial-timeline-titulo">
      <div className="historial-timeline__cabecera">
        <h2 id="historial-timeline-titulo">Todos los registros</h2>
      </div>
      {children}
      {etapas.length > 1 ? (
        <Selector
          etiqueta="Filtrar por etapa"
          id="historial-filtro-etapa"
          className="historial-filtro-etapa"
          valor={etapa || TODO_EL_CULTIVO}
          onChange={(valor) => filtrar(valor === TODO_EL_CULTIVO ? "" : valor)}
          opciones={[
            { valor: TODO_EL_CULTIVO, etiqueta: "Todo el cultivo" },
            ...etapas.map((item) => ({ valor: item.etapa, etiqueta: etiquetaEtapaHistorial(item.etapa) })),
          ]}
        />
      ) : null}

      {grupos.map((grupo) => (
        <div key={grupo.clave} className="historial-mes">
          <h3 className="historial-mes__titulo">{grupo.titulo}</h3>
          <ol className="historial-dias">
            {grupo.dias.map((dia) => (
              <HistorialDiaApp
                key={dia.id}
                dia={dia}
                fotos={fotosDeDia(historial, dia, mapa)}
                cambiosEtapa={cambiosPorDia.get(dia.fecha) || []}
                onEliminado={onEliminado}
              />
            ))}
          </ol>
        </div>
      ))}

      {dias.length === 0 ? (
        <div className="vacio historial-timeline__vacio">
          <p>No hay días con registros para este filtro de etapa.</p>
        </div>
      ) : null}

      {cargandoMas ? (
        <p className="demo__aviso historial-timeline__fin" role="status">
          Cargando registros…
        </p>
      ) : null}

      {hayMasDias && !errorMas ? (
        <div ref={centinelaRef} className="historial-timeline__centinela" aria-hidden="true" />
      ) : null}

      {!hayMasDias && !cargandoMas && dias.length > 0 ? (
        <p className="demo__aviso historial-timeline__fin">
          Llegaste al último registro disponible de este cultivo.
        </p>
      ) : null}

      {errorMas ? (
        <div className="historial-timeline__error" role="alert">
          <p className="historial__error">{errorMas}</p>
          {onReintentarMas ? (
            <Boton type="button" variante="secundario" onClick={onReintentarMas} disabled={cargandoMas}>
              Reintentar
            </Boton>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
