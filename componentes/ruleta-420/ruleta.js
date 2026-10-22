"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { IMAGENES_RULETA, ISOTIPO_ENFLORA, PREMIOS } from "@/lib/ruleta-420/configuracion";
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

const PIEZAS_RESTA = [
  { src: "/images/premios/enflora_stickers_web_1280.webp", x: -30 },
  { src: "/images/premios/enflora_filtros_web_1280.webp", x: 2 },
];

function RestaSector() {
  return (
    <g>
      {PIEZAS_RESTA.map((pieza) => (
        <g key={pieza.src}>
          <image href={pieza.src} x={pieza.x} y={-68} width={28} height={28} preserveAspectRatio="xMidYMid meet" />
          <circle cx={pieza.x + 23} cy={-44} r={7} fill="#C2413B" />
          <text className="ruleta__resta" x={pieza.x + 23} y={-44} textAnchor="middle" dominantBaseline="central">
            -1
          </text>
        </g>
      ))}
    </g>
  );
}
function fuentesSector(sector) {
  const base = PREMIOS.find((item) => item.id === sector.id) ?? sector;
  const claves = base.imagenes?.length ? base.imagenes : base.imagen ? [base.imagen] : [];
  return claves.map((clave) => IMAGENES_RULETA[clave]).filter(Boolean);
}

function ImagenSector({ sector }) {
  const fuentes = fuentesSector(sector);
  const [fallidas, setFallidas] = useState([]);
  const visibles = fuentes.filter((src) => !fallidas.includes(src));

  if (visibles.length === 1) {
    return (
      <image
        href={visibles[0]}
        x={-17}
        y={-58}
        width={34}
        height={34}
        preserveAspectRatio="xMidYMid meet"
        onError={() => setFallidas((actual) => [...actual, visibles[0]])}
      />
    );
  }

  if (visibles.length > 1) {
    const tamano = 24;
    const separacion = 2;
    const ancho = visibles.length * tamano + (visibles.length - 1) * separacion;
    const inicio = -ancho / 2;

    return (
      <g>
        {visibles.map((src, indice) => (
          <image
            key={src}
            href={src}
            x={inicio + indice * (tamano + separacion)}
            y={-54}
            width={tamano}
            height={tamano}
            preserveAspectRatio="xMidYMid meet"
            onError={() => setFallidas((actual) => (actual.includes(src) ? actual : [...actual, src]))}
          />
        ))}
      </g>
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

function Sector({ sector, estadoSector, soloTexto }) {
  const lineas = sector.lineas;
  const inicioTexto = soloTexto ? (lineas.length > 1 ? -54 : -42) : lineas.length > 1 ? -73 : -66;
  const paso = soloTexto ? 16 : 11;

  const recorte = `sector-${sector.id}`;

  return (
    <g className={`ruleta__sector${estadoSector ? ` ruleta__sector--${estadoSector}` : ""}`}>
      <defs>
        <clipPath id={recorte}>
          <path d={trazoSector(sector.inicio, sector.fin, RADIO)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${recorte})`}>
        <path d={trazoSector(sector.inicio, sector.fin, RADIO)} fill={sector.color} />
        <g transform={`rotate(${redondear(sector.centro)})`}>
          {sector.id === "CONSOLATION" ? <RestaSector /> : soloTexto ? null : <ImagenSector sector={sector} />}
          <text
            className={`ruleta__texto${soloTexto ? " ruleta__texto--grande" : ""}`}
            textAnchor="middle"
            fill={sector.colorTexto}
          >
            {lineas.map((linea, indice) => (
              <tspan key={linea} x={0} y={inicioTexto + indice * paso}>
                {linea}
              </tspan>
            ))}
          </text>
        </g>
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
  soloTexto = false,
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
        <svg viewBox="0 -10 40 58">
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
              soloTexto={soloTexto}
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
