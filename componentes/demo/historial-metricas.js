"use client";

import { useState } from "react";
import { GraficoEvolucion } from "@/componentes/grafico-evolucion";
import { Selector } from "@/componentes/selector";
import { etiquetaEtapaHistorial, formatearNumero, parametroHistorial } from "@/lib/demo/historial/historial-demo";
import { PARAMETROS_HISTORIAL, seriePorParametro } from "@/lib/demo/historial/normalizar-historial";
import {
  etapasParaFiltroHistorial,
  metricaDeSerie,
  serieMedicionesHistorial,
} from "@/lib/historial-vista-cultivo";

function listaParametros(historial) {
  const claves = Object.keys(historial.metricas || {});
  return claves.map((clave) => {
    const catalogo = PARAMETROS_HISTORIAL.find((item) => item.clave === clave);
    if (catalogo) return catalogo;
    const metrica = historial.metricas[clave];
    return {
      clave,
      etiqueta: clave.startsWith("custom:") ? clave.slice(7) : clave,
      unidad: metrica?.unidad || "",
      decimales: 2,
    };
  });
}

const TODAS_LAS_ETAPAS = "todas";

function serieDemo(historial, clave, etapa) {
  return seriePorParametro(historial, clave)
    .filter((punto) => !etapa || punto.etapa === etapa)
    .slice()
    .sort((a, b) => {
      const da = a.dia ?? -1;
      const db = b.dia ?? -1;
      if (da !== db) return da - db;
      return String(a.fecha || "").localeCompare(String(b.fecha || ""));
    });
}

export function HistorialMetricas({ historial }) {
  const disponibles = listaParametros(historial);
  const etapasFiltro = etapasParaFiltroHistorial(historial);
  const [clave, setClave] = useState(disponibles[0]?.clave || "");
  const [etapaFiltro, setEtapaFiltro] = useState("");
  if (!disponibles.length) return null;

  const parametro = parametroHistorial(clave) || disponibles.find((item) => item.clave === clave) || disponibles[0];
  const serie = historial.modoApp
    ? serieMedicionesHistorial(historial, parametro.clave, etapaFiltro)
    : serieDemo(historial, parametro.clave, etapaFiltro);
  const metricaBase = !etapaFiltro ? historial.metricas[parametro.clave] : null;
  const metrica = metricaBase || metricaDeSerie(serie, parametro.decimales ?? 2);
  const etapasGrafico = (historial.etapas || []).filter((etapa) => !etapaFiltro || etapa.etapa === etapaFiltro);
  const ultimo = serie.at(-1);
  const resumen = metrica
    ? [
        { parametro: parametro.clave, valor: metrica.minimo, etiqueta: "Mínimo" },
        { parametro: parametro.clave, valor: metrica.promedio, etiqueta: "Promedio" },
        { parametro: parametro.clave, valor: metrica.maximo, etiqueta: "Máximo" },
      ]
    : [];
  const etiquetaEtapaActiva = etapaFiltro ? etiquetaEtapaHistorial(etapaFiltro) : "";
  const textoConteo = metrica
    ? `${metrica.cantidad} ${metrica.cantidad === 1 ? "medición" : "mediciones"} de ${parametro.etiqueta}${
        etiquetaEtapaActiva ? ` en ${etiquetaEtapaActiva}` : ""
      }.`
    : `No hay mediciones de ${parametro.etiqueta}${etiquetaEtapaActiva ? ` en ${etiquetaEtapaActiva}` : ""}.`;

  return (
    <section className="historial-metricas" aria-labelledby="historial-metricas-titulo">
      <div className="historial-timeline__cabecera">
        <h2 id="historial-metricas-titulo">Evolución de parámetros</h2>
        <p className="demo__aviso">{textoConteo}</p>
      </div>
      <Selector
        etiqueta="Parámetro"
        id="historial-parametro"
        className="historial-filtro-etapa"
        valor={parametro.clave}
        onChange={(valor) => valor && setClave(valor)}
        opciones={disponibles.map((item) => ({ valor: item.clave, etiqueta: item.etiqueta }))}
      />
      {etapasFiltro.length ? (
        <Selector
          etiqueta="Etapa"
          id="historial-metrica-etapa"
          className="historial-filtro-etapa"
          valor={etapaFiltro || TODAS_LAS_ETAPAS}
          onChange={(valor) => setEtapaFiltro(!valor || valor === TODAS_LAS_ETAPAS ? "" : valor)}
          opciones={[
            { valor: TODAS_LAS_ETAPAS, etiqueta: "Todas las etapas" },
            ...etapasFiltro.map((etapa) => ({ valor: etapa, etiqueta: etiquetaEtapaHistorial(etapa) })),
          ]}
        />
      ) : null}
      <div className="tarjeta historial-grafico">
        <div className="historial-grafico__cabecera">
          <p className="historial-grafico__titulo">{parametro.etiqueta}</p>
          {ultimo ? (
            <p className="historial-grafico__ultimo">
              Último: <strong>{formatearNumero(ultimo.valor)}</strong>
              {parametro.unidad ? ` ${parametro.unidad}` : ""}
              {ultimo.dia != null ? ` · día ${ultimo.dia}` : ""}
            </p>
          ) : null}
        </div>
        {serie.length > 1 && metrica ? (
          <GraficoEvolucion serie={serie} parametro={parametro} etapas={etapasGrafico} metrica={metrica} />
        ) : null}
        {!serie.length ? (
          <p className="demo__aviso historial-grafico__vacio">
            No hay mediciones de {parametro.etiqueta}
            {etiquetaEtapaActiva ? ` en ${etiquetaEtapaActiva}` : ""} para este alcance.
          </p>
        ) : null}
        {metrica ? (
        <ul className="historial-grafico__stats" aria-label="Estadísticas">
          {resumen.map((item) => (
            <li key={item.etiqueta} className="historial-medicion">
              <span className="historial-medicion__etiqueta">{item.etiqueta}</span>
              <span className="historial-medicion__valor">
                {formatearNumero(item.valor)}
                {parametro.unidad ? <span className="historial-medicion__unidad"> {parametro.unidad}</span> : null}
              </span>
            </li>
          ))}
          <li className="historial-medicion">
            <span className="historial-medicion__etiqueta">Mediciones</span>
            <span className="historial-medicion__valor">{metrica.cantidad}</span>
          </li>
        </ul>
        ) : null}
      </div>
      {!historial.modoApp ? (
        <p className="demo__aviso">
          Las líneas punteadas marcan los cambios de etapa. Cada punto es una medición real cargada ese día.
        </p>
      ) : etapasGrafico.length ? (
        <p className="demo__aviso">
          Las líneas punteadas marcan cambios de etapa cuando hay una secuencia única para el alcance.
        </p>
      ) : null}
    </section>
  );
}
