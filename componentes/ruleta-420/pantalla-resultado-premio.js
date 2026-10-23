"use client";

import { motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { Confeti } from "@/componentes/ruleta-420/confeti";
import { ImagenRuleta } from "@/componentes/ruleta-420/imagen-ruleta";
import { RESULTADOS_PREMIO } from "@/lib/ruleta-420/configuracion";
import { TextoConMarca } from "@/componentes/marca-enflora";

const FOTO_STICKERS = "/images/premios/enflora_stickers_web_1280.webp";
const FOTO_FILTROS = "/images/premios/enflora_filtros_web_1280.webp";

const PIEZAS_RESTA = [
  { src: FOTO_STICKERS, alt: "Sticker" },
  { src: FOTO_FILTROS, alt: "Filtro" },
];

const PACKS = {
  SAFE_PACK: [
    { src: FOTO_STICKERS, alt: "Stickers", cantidad: 2 },
    { src: FOTO_FILTROS, alt: "Filtros", cantidad: 2 },
  ],
  BONUS_PACK: [
    { src: FOTO_STICKERS, alt: "Stickers", cantidad: 3 },
    { src: FOTO_FILTROS, alt: "Filtros", cantidad: 3 },
  ],
};

function PackPremio({ piezas }) {
  const etiqueta = piezas.map((pieza) => `x${pieza.cantidad} ${pieza.alt.toLowerCase()}`).join(" y ");

  return (
    <div className="ruleta-pack" aria-label={etiqueta}>
      {piezas.map((pieza) => (
        <span className="ruleta-pack__premio" key={pieza.src}>
          <img src={pieza.src} alt={pieza.alt} width="160" height="160" />
          <span className="ruleta-pack__marca">x{pieza.cantidad}</span>
        </span>
      ))}
    </div>
  );
}

function RestaPremio() {
  return (
    <div className="ruleta-resta">
      {PIEZAS_RESTA.map((pieza) => (
        <span className="ruleta-resta__premio" key={pieza.src}>
          <img src={pieza.src} alt={pieza.alt} width="96" height="96" />
          <span className="ruleta-resta__marca">-1</span>
        </span>
      ))}
    </div>
  );
}

export function PantallaResultadoPremio({ premioId, onVolver }) {
  const consuelo = premioId === "CONSOLATION";
  const resultado = RESULTADOS_PREMIO[premioId];
  if (!resultado) return null;

  if (consuelo) {
    return (
      <div className="ruleta-cierre ruleta-cierre--nada">
        <RestaPremio />
        <h1 className="ruleta-titulo">{resultado.titulo}</h1>
        <p className="ruleta-cierre__destacado">
          <TextoConMarca texto={resultado.descripcion} />
        </p>
        <p className="ruleta-cierre__texto">{resultado.secundario}</p>
        <div className="ruleta-acciones">
          <BotonRuleta variante="secundario" onClick={onVolver}>
            VOLVER AL INICIO
          </BotonRuleta>
        </div>
      </div>
    );
  }

  return (
    <div className={`ruleta-cierre ruleta-cierre--${resultado.tono}`}>
      <Confeti />
      <motion.div
        className="ruleta-cierre__flora"
        initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 14 }}
      >
        {PACKS[premioId] ? (
          <PackPremio piezas={PACKS[premioId]} />
        ) : (
          <ImagenRuleta
            clave={resultado.imagen}
            alt={resultado.descripcion}
            icono={resultado.icono}
            etiqueta="Tu premio"
            tono={resultado.tono}
          />
        )}
      </motion.div>
      <motion.h1
        className="ruleta-titulo"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.35 }}
      >
        {resultado.titulo}
      </motion.h1>
      <motion.p
        className="ruleta-cierre__destacado"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <TextoConMarca texto={resultado.descripcion} />
      </motion.p>
      {resultado.secundario ? <p className="ruleta-cierre__texto">{resultado.secundario}</p> : null}
      <div className="ruleta-acciones">
        <BotonRuleta variante="secundario" onClick={onVolver}>
          VOLVER AL INICIO
        </BotonRuleta>
      </div>
    </div>
  );
}
