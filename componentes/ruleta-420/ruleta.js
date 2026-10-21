"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { IMAGENES_RULETA, ISOTIPO_ENFLORA } from "@/lib/ruleta-420/configuracion";
import { IconoRuleta } from "@/componentes/ruleta-420/iconos-ruleta";

const RADIO = 90;
const CURVA_GIRO = [0.12, 0.82, 0.18, 1];
const BOMBITAS = Array.from({ length: 16 }, (_, indice) => indice);

function redondear(valor) {
  return Number(valor.toFixed(3));
}

function punto(angulo, radio) {
  const radianes = ((angulo - 90) * Math.PI) / 180;
  return [redondear(radio * Math.cos(radianes)), redondear(radio * Math.sin(radianes))];
}

function trazoSector(inicio, fin, radio) {
  const [x1, y1] = punto(inicio, radio);
  const [x2, y2] = punto(fin, radio);
  const grande = fin - inicio > 180 ? 1 : 0;
  return `M0 0 L${x1} ${y1} A${radio} ${radio} 0 ${grande} 1 ${x2} ${y2} Z`;
}

function ImagenSector({ sector }) {
  const src = sector.imagen ? IMAGENES_RULETA[sector.imagen] : "";
  const [fallida, setFallida] = useState("");

  if (src && fallida !== src) {
    return (
      <image
        href={src}
        x={-21}
        y={-57}
        width={42}
        height={42}
        preserveAspectRatio="xMidYMid meet"
        onError={() => setFallida(src)}
      />
    );
  }

  return (
    <g className="ruleta__placeholder">
      <circle cx={0} cy={-36} r={16} fill={sector.colorTexto} opacity={0.16} />
      <circle
        cx={0}
        cy={-36}
        r={16}
        fill="none"
        stroke={sector.colorTexto}
        strokeOpacity={0.45}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <IconoRuleta nombre={sector.icono} x={-9} y={-45} size={18} color={sector.colorTexto} strokeWidth={1.8} />
    </g>
  );
}

function Sector({ sector, estadoSector }) {
  const lineas = sector.lineas;
  const inicioTexto = lineas.length > 1 ? -73 : -66;

  return (
    <g className={`ruleta__sector${estadoSector ? ` ruleta__sector--${estadoSector}` : ""}`}>
      <path d={trazoSector(sector.inicio, sector.fin, RADIO)} fill={sector.color} />
      <g transform={`rotate(${redondear(sector.centro)})`}>
        <ImagenSector sector={sector} />
        <text className="ruleta__texto" textAnchor="middle" fill={sector.colorTexto}>
          {lineas.map((linea, indice) => (
            <tspan key={linea} x={0} y={inicioTexto + indice * 11}>
              {linea}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  );
}

export function Ruleta({
  sectores,
  rotacion = 0,
  duracion = 3600,
  girando = false,
  ganador = null,
  variante = "categorias",
  decorativa = false,
  etiqueta,
}) {
  const animacion = decorativa
    ? { animate: { rotate: [0, 360] }, transition: { duration: 48, ease: "linear", repeat: Infinity } }
    : { animate: { rotate: rotacion }, transition: { duration: duracion / 1000, ease: CURVA_GIRO } };

  return (
    <div
      className={`ruleta ruleta--${variante}${girando ? " ruleta--girando" : ""}${ganador ? " ruleta--detenida" : ""}`}
      role="img"
      aria-label={etiqueta}
    >
      <div className="ruleta__puntero" aria-hidden="true">
        <svg viewBox="0 0 40 48">
          <path d="M20 46 L4 12 A16 16 0 1 1 36 12 Z" />
          <circle cx="20" cy="16" r="6" />
        </svg>
      </div>
      <motion.div className="ruleta__disco" initial={false} {...animacion}>
        <svg viewBox="-100 -100 200 200" aria-hidden="true">
          <circle className="ruleta__aro" r={98} />
          {sectores.map((sector) => (
            <Sector
              key={sector.id}
              sector={sector}
              estadoSector={ganador ? (ganador === sector.id ? "ganador" : "apagado") : ""}
            />
          ))}
          {sectores.map((sector) => {
            const [x, y] = punto(sector.inicio, RADIO);
            return <line key={sector.id} className="ruleta__division" x1={0} y1={0} x2={x} y2={y} />;
          })}
          {ganador
            ? sectores
                .filter((sector) => sector.id === ganador)
                .map((sector) => (
                  <path
                    key={sector.id}
                    className="ruleta__brillo"
                    d={trazoSector(sector.inicio, sector.fin, RADIO - 2)}
                  />
                ))
            : null}
          {variante === "premios"
            ? BOMBITAS.map((indice) => {
                const [x, y] = punto(indice * (360 / BOMBITAS.length), 94);
                return (
                  <circle
                    key={indice}
                    className={`ruleta__bombita ruleta__bombita--${indice % 2 ? "par" : "impar"}`}
                    cx={x}
                    cy={y}
                    r={2.6}
                  />
                );
              })
            : null}
          <circle className="ruleta__centro" r={21} />
          <image href={ISOTIPO_ENFLORA} x={-13} y={-13} width={26} height={26} />
        </svg>
      </motion.div>
    </div>
  );
}
