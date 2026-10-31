"use client";

import { useState } from "react";
import { AVISO_IMAGEN_CHAT_NO_GUARDADA } from "@/lib/flora-imagen-chat";

export function AvisoImagenChat({ children }) {
  return (
    <p className="flora-chat-app__aviso-imagen" role="note">
      {children}
    </p>
  );
}

export function ImagenMensajeFlora({ src, alt = "Fotografía enviada" }) {
  const [estado, setEstado] = useState(src ? "cargando" : "error");

  if (!src || estado === "error") {
    return <AvisoImagenChat>No se pudo mostrar la fotografía.</AvisoImagenChat>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={
        estado === "cargando"
          ? "flora-chat-app__adjunto-img flora-chat-app__adjunto-img--cargando"
          : "flora-chat-app__adjunto-img"
      }
      onLoad={() => setEstado("lista")}
      onError={() => setEstado("error")}
    />
  );
}

export function AdjuntoMensajeChat({ adjunto }) {
  if (!adjunto) return null;
  if (adjunto.noDisponible || (adjunto.origen === "transitoria" && !adjunto.vista)) {
    return <AvisoImagenChat>{adjunto.aviso || AVISO_IMAGEN_CHAT_NO_GUARDADA}</AvisoImagenChat>;
  }
  if (!adjunto.vista) {
    return <AvisoImagenChat>No se pudo mostrar la fotografía.</AvisoImagenChat>;
  }
  return (
    <figure className="flora-chat-app__adjunto-msg">
      <ImagenMensajeFlora key={adjunto.vista} src={adjunto.vista} />
      {adjunto.etiqueta ? (
        <figcaption className="flora-chat-app__adjunto-msg-meta">{adjunto.etiqueta}</figcaption>
      ) : null}
    </figure>
  );
}
