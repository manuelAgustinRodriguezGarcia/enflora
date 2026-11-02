"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineDrawShape,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { etiquetaEtapaHistorial, formatearNumero } from "@/lib/demo/historial/historial-demo";

const RELACION = 170 / 320;
const ANIMACION = {
  isAnimationActive: "auto",
  animationBegin: 0,
  animationDuration: 1500,
  animationEasing: "ease",
};

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

function firmaEntrada(serie, etapas, metrica, parametro) {
  let texto = `${parametro.clave}|${parametro.decimales ?? ""}|${parametro.etiqueta}|${parametro.unidad || ""}#`;
  for (const punto of serie) {
    texto += `${punto.dia}|${punto.valor}|${punto.fecha || ""};`;
  }
  texto += "#";
  for (const etapa of etapas || []) {
    texto += `${etapa.id}|${etapa.etapa}|${etapa.diaInicio};`;
  }
  if (metrica) {
    texto += `#${metrica.minimo}|${metrica.maximo}|${metrica.promedio}|${metrica.cantidad}`;
  }
  return texto;
}

function construirModelo(serie, parametro, etapas, metrica) {
  const datos = serie.map((punto, indice) => ({
    eje: Number.isFinite(punto.dia) ? punto.dia : indice,
    dia: Number.isFinite(punto.dia) ? punto.dia : null,
    valor: punto.valor,
    fecha: punto.fecha || "",
  }));
  const valores = datos.map((punto) => punto.valor);
  const [minY, maxY] = limitesY(valores, parametro.decimales);
  let minX = datos[0].eje;
  let maxX = datos[0].eje;
  for (const punto of datos) {
    if (punto.eje < minX) minX = punto.eje;
    if (punto.eje > maxX) maxX = punto.eje;
  }
  const cortes = (etapas || []).filter(
    (etapa) => etapa.diaInicio !== null && etapa.diaInicio > minX && etapa.diaInicio <= maxX
  );
  const unidad = parametro.unidad ? ` ${parametro.unidad}` : "";
  const dias = datos.map((punto) => punto.dia).filter((dia) => dia !== null);
  const rango = dias.length ? ` entre el día ${Math.min(...dias)} y el día ${Math.max(...dias)}` : "";
  return {
    datos,
    minY,
    maxY,
    minX,
    dominioX: [minX, maxX === minX ? minX + 1 : maxX],
    ticksX: minX === maxX ? [minX] : [minX, maxX],
    ticksY: metrica.minimo === metrica.maximo ? [metrica.minimo] : [metrica.minimo, metrica.maximo],
    cortes,
    descripcion: `${parametro.etiqueta}: mínimo ${formatearNumero(metrica.minimo)}${unidad}, máximo ${formatearNumero(
      metrica.maximo
    )}${unidad}, promedio ${formatearNumero(metrica.promedio)}${unidad} en ${metrica.cantidad} mediciones${rango}.`,
  };
}

function fraccionesDelTrazo(puntos) {
  const fracciones = new Array(puntos.length).fill(0);
  if (puntos.length < 2) return fracciones;
  let total = 0;
  const distancias = [0];
  for (let indice = 1; indice < puntos.length; indice += 1) {
    const anterior = puntos[indice - 1];
    const actual = puntos[indice];
    total += Math.hypot((actual.x ?? 0) - (anterior.x ?? 0), (actual.y ?? 0) - (anterior.y ?? 0));
    distancias.push(total);
  }
  if (!total) return fracciones;
  return distancias.map((distancia) => distancia / total);
}

function FormaLinea(props) {
  const puntos = props.points || [];
  const progreso = props.animationElapsedTime ?? 1;
  const trazando = Boolean(props.isEntrance) && progreso < 1;
  const fracciones = trazando ? fraccionesDelTrazo(puntos) : null;

  return (
    <>
      <LineDrawShape {...props} />
      {puntos.map((punto, indice) => {
        if (punto.x == null || punto.y == null) return null;
        if (fracciones && progreso + 0.015 < fracciones[indice]) return null;
        const clave = punto.payload?.fecha ? `${punto.payload.fecha}-${indice}` : indice;
        return <circle key={clave} className="historial-grafico__punto" cx={punto.x} cy={punto.y} r={2.2} />;
      })}
    </>
  );
}

function MarcaDia({ x, y, payload, esInicio }) {
  if (payload?.value == null || x == null || y == null) return null;
  return (
    <text x={x} y={y} dy={12} textAnchor={esInicio ? "start" : "end"} className="historial-grafico__texto">
      Día {payload.value}
    </text>
  );
}

function MarcaValor({ x, y, payload }) {
  if (payload?.value == null || x == null || y == null) return null;
  return (
    <text x={x} y={y} dy={3} textAnchor="end" className="historial-grafico__texto">
      {formatearNumero(payload.value)}
    </text>
  );
}

function EtiquetaCorte({ x, y, value }) {
  if (value == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (
    <text x={x + 4} y={y} className="historial-grafico__texto historial-grafico__texto--corte">
      {value}
    </text>
  );
}

function ContenidoTooltip({ active, payload, etiqueta, unidad }) {
  if (!active || !payload?.length) return null;
  const punto = payload.find((item) => Number.isFinite(item?.payload?.valor))?.payload;
  if (!punto) return null;
  const sufijo = unidad ? ` ${unidad}` : "";
  return (
    <div className="historial-grafico__tooltip">
      <p>{punto.dia === null ? "Sin día" : `Día ${punto.dia}`}</p>
      <p>
        {etiqueta}: <strong>{formatearNumero(punto.valor)}</strong>
        {sufijo}
      </p>
    </div>
  );
}

export function GraficoEvolucion({ serie, parametro, etapas, metrica }) {
  const contenedor = useRef(null);
  const [ancho, setAncho] = useState(0);
  const firmaActual = firmaEntrada(serie, etapas, metrica, parametro);
  const [firmaModelo, setFirmaModelo] = useState(firmaActual);
  const [modelo, setModelo] = useState(() => construirModelo(serie, parametro, etapas, metrica));
  if (firmaActual !== firmaModelo) {
    setFirmaModelo(firmaActual);
    setModelo(construirModelo(serie, parametro, etapas, metrica));
  }

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return undefined;
    const medir = () => {
      const medida = Math.round(nodo.clientWidth);
      if (medida <= 0) return;
      setAncho((actual) => (actual && Math.abs(actual - medida) < 2 ? actual : medida));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const alto = ancho ? Math.max(120, Math.round(ancho * RELACION)) : 0;

  return (
    <div
      ref={contenedor}
      className={`historial-grafico__lienzo${ancho ? "" : " historial-grafico__lienzo--reserva"}`}
    >
      {ancho > 0 ? (
        <ComposedChart
          className="historial-grafico__superficie"
          width={ancho}
          height={alto}
          data={modelo.datos}
          margin={{ top: 18, right: 8, bottom: 0, left: 0 }}
          title={parametro.etiqueta}
          desc={modelo.descripcion}
        >
          <CartesianGrid vertical={false} syncWithTicks stroke="rgba(0,0,0,0.07)" strokeDasharray="2 3" />
          <XAxis
            dataKey="eje"
            type="number"
            domain={modelo.dominioX}
            ticks={modelo.ticksX}
            interval={0}
            padding={{ left: 8, right: 8 }}
            height={22}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tick={(marca) => <MarcaDia {...marca} esInicio={marca?.payload?.value === modelo.minX} />}
          />
          <YAxis
            domain={[modelo.minY, modelo.maxY]}
            ticks={modelo.ticksY}
            width={40}
            tickLine={false}
            axisLine={false}
            tick={MarcaValor}
          />
          <Tooltip
            content={<ContenidoTooltip etiqueta={parametro.etiqueta} unidad={parametro.unidad || ""} />}
            cursor={{ stroke: "rgba(0,0,0,0.12)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          {modelo.cortes.map((etapa) => (
            <ReferenceLine
              key={etapa.id}
              x={etapa.diaInicio}
              className="historial-grafico__corte"
              stroke="var(--brand-accent)"
              strokeDasharray="3 3"
              strokeWidth={1.2}
              zIndex={300}
              ifOverflow="discard"
              label={{
                value: `${etiquetaEtapaHistorial(etapa.etapa)} · día ${etapa.diaInicio}`,
                position: "insideTopLeft",
                offset: 4,
                content: EtiquetaCorte,
              }}
            />
          ))}
          <Area
            type="monotone"
            dataKey="valor"
            stroke="none"
            fill="var(--surface-green)"
            fillOpacity={0.8}
            dot={false}
            activeDot={false}
            legendType="none"
            tooltipType="none"
            {...ANIMACION}
          />
          <Line
            type="monotone"
            dataKey="valor"
            stroke="var(--brand-medium)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            shape={FormaLinea}
            activeDot={{ r: 4, fill: "var(--surface)", stroke: "var(--brand-dark)", strokeWidth: 1.2 }}
            {...ANIMACION}
          />
        </ComposedChart>
      ) : null}
    </div>
  );
}
