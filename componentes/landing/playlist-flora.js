"use client";

import { motion, useReducedMotion } from "motion/react";

export function PlaylistFlora({ playlist }) {
  const reducido = useReducedMotion();

  return (
    <motion.div
      className="flora-playlist"
      initial={reducido ? false : { opacity: 0, y: 18 }}
      whileInView={reducido ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <h3 className="flora-playlist__titulo">{playlist.titulo}</h3>
      <div className="flora-playlist__fila">
        <div className="flora-playlist__embed">
          <iframe
            title="Playlist de Enflora en Spotify"
            src={playlist.src}
            width="100%"
            height="352"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
        <div className="flora-playlist__dj">
          <span className="flora-playlist__dj-etiqueta">{playlist.dj}</span>
        </div>
      </div>
    </motion.div>
  );
}
