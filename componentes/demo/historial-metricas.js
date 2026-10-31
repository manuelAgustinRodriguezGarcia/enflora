"use client";

import { useState } from "react";
import { Selector } from "@/componentes/selector";
import { etiquetaEtapaHistorial, formatearNumero, parametroHistorial } from "@/lib/demo/historial/historial-demo";
import { PARAMETROS_HISTORIAL, seriePorParametro } from "@/lib/demo/historial/normalizar-historial";
import {
  etapasParaFiltroHistorial,
  metricaDeSerie,
  serieMedicionesHistorial,
} from "@/lib/historial-vista-cultivo";

const ANCHO = 320;
const ALTO = 170;
const MARGEN = { arriba: 18, derecha: 10, abajo: 24, izquierda: 38 };

function escala(minimo, maximo, desde, hasta) {
  const rango = maximo - minimo || 1;
  return (valor) => desde + ((valor - minimo) / rango) * (hasta - desde);
}

function limitesY(valores, decimales) {
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  if (minimo === maximo) {
    const margen = decimales ? 1 : Math.max(1, Math.abs(minimo) * 0.05);
    return [minimo - margen, maximo + margen];
  }
  const margen = (maximo - minimo) * 0.12;
  return [minimo - margen, maximo + margen];
}

function Grafico({ serie, parametro, etapas, metrica }) {
  const valores = serie.map((punto) => punto.valor);
  const dias = serie.map((punto) => punto.dia);
  const [minY, maxY] = limitesY(valores, parametro.decimales);
  const minX = Math.min(...dias);
  const maxX = Math.max(...dias);
  const x = escala(minX, maxX === minX ? minX + 1 : maxX, MARGEN.izquierda, ANCHO - MARGEN.derecha);
  const y = escala(minY, maxY, ALTO - MARGEN.abajo, MARGEN.arriba);
  const puntos = serie.map((punto) => [x(punto.dia), y(punto.valor)]);
  const linea = puntos.map(([px, py], indice) => `${indice ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const base = ALTO - MARGEN.abajo;
  const area = `${linea} L${puntos.at(-1)[0].toFixed(1)} ${base} L${puntos[0][0].toFixed(1)} ${base} Z`;
  const cortes = etapas.filter((etapa) => etapa.diaInicio !== null && etapa.diaInicio > minX && etapa.diaInicio <= maxX);
  const unidad = parametro.unidad ? ` ${parametro.unidad}` : "";
  const descripcion = `${parametro.etiqueta}: mínimo ${formatearNumero(metrica.minimo)}${unidad}, máximo ${formatearNumero(
    metrica.maximo
  )}${unidad}, promedio ${formatearNumero(metrica.promedio)}${unidad} en ${metrica.cantidad} mediciones entre el día ${minX} y el día ${maxX}.`;

  return (
    <svg className="historial-grafico__svg" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={descripcion}>
      <line className="historial-grafico__eje" x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={base} y2={base} />
      <line
        className="historial-grafico__guia"
        x1={MARGEN.izquierda}
        x2={ANCHO - MARGEN.derecha}
        y1={y(metrica.maximo)}
        y2={y(metrica.maximo)}
      />
      <line
        className="historial-grafico__guia"
        x1={MARGEN.izquierda}
        x2={ANCHO - MARGEN.derecha}
        y1={y(metrica.minimo)}
        y2={y(metrica.minimo)}
      />
      <text className="historial-grafico__texto" x={MARGEN.izquierda - 4} y={y(metrica.maximo) + 3} textAnchor="end">
        {formatearNumero(metrica.maximo)}
      </text>
      <text className="historial-grafico__texto" x={MARGEN.izquierda - 4} y={y(metrica.minimo) + 3} textAnchor="end">
        {formatearNumero(metrica.minimo)}
      </text>
      {cortes.map((etapa) => (
        <g key={etapa.id}>
          <line
            className="historial-grafico__corte"
            x1={x(etapa.diaInicio)}
            x2={x(etapa.diaInicio)}
            y1={MARGEN.arriba - 6}
            y2={base}
          />
          <text
            className="historial-grafico__texto historial-grafico__texto--corte"
            x={x(etapa.diaInicio) + 4}
            y={MARGEN.arriba - 6}
          >
            {etiquetaEtapaHistorial(etapa.etapa)} · día {etapa.diaInicio}
          </text>
        </g>
      ))}
      <path className="historial-grafico__area" d={area} />
      <path className="historial-grafico__linea" d={linea} />
      {puntos.map(([px, py], indice) => (
        <circle key={`${serie[indice].fecha}-${indice}`} className="historial-grafico__punto" cx={px} cy={py} r={2.2} />
      ))}
      <text className="historial-grafico__texto" x={MARGEN.izquierda} y={ALTO - 8}>
        Día {minX}
      </text>
      <text className="historial-grafico__texto" x={ANCHO - MARGEN.derecha} y={ALTO - 8} textAnchor="end">
        Día {maxX}
      </text>
    </svg>
  );
}

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
          <Grafico serie={serie} parametro={parametro} etapas={etapasGrafico} metrica={metrica} />
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
