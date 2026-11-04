"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  AVISO_IMAGEN_CHAT_NO_DISPONIBLE,
  AVISO_IMAGEN_CHAT_NO_GUARDADA,
} from "@/lib/flora-imagen-chat";

export function AvisoImagenChat({ children }) {
  return (
    <p className="flora-chat-app__aviso-imagen" role="note">
      {children}
    </p>
  );
}

export function ImagenMensajeFlora({
  src,
  alt = "Fotografía enviada",
  diferida = false,
  onFallo,
}) {
  const [estado, setEstado] = useState(src ? "cargando" : "error");

  if (!src || estado === "error") {
    return <span className="flora-chat-app__aviso-imagen">{AVISO_IMAGEN_CHAT_NO_DISPONIBLE}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={diferida ? "lazy" : "eager"}
      decoding="async"
      className={
        estado === "cargando"
          ? "flora-chat-app__adjunto-img flora-chat-app__adjunto-img--cargando"
          : "flora-chat-app__adjunto-img"
      }
      onLoad={() => setEstado("lista")}
      onError={() => {
        setEstado("error");
        onFallo?.();
      }}
    />
  );
}

export function ModalVisorAdjuntoFlora({ adjunto, onCerrar }) {
  useEffect(() => {
    if (!adjunto?.vista) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjunto, onCerrar]);

  if (!adjunto?.vista) return null;
  return (
    <div className="flora-adjunto-visor" role="dialog" aria-modal="true" aria-label="Vista ampliada">
      <button type="button" className="flora-adjunto-visor__fondo" onClick={onCerrar} aria-label="Cerrar" />
      <div className="flora-adjunto-visor__marco">
        <button type="button" className="flora-adjunto-visor__cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X strokeWidth={2} aria-hidden="true" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={adjunto.vista} alt="" className="flora-adjunto-visor__img" />
      </div>
    </div>
  );
}

export function AdjuntoMensajeChat({ adjunto }) {
  const [ampliado, setAmpliado] = useState(false);
  const [falloCarga, setFalloCarga] = useState(false);

  if (!adjunto) return null;
  if (adjunto.noDisponible || !adjunto.vista || falloCarga) {
    const aviso =
      adjunto.aviso ||
      (adjunto.origen === "transitoria"
        ? AVISO_IMAGEN_CHAT_NO_GUARDADA
        : AVISO_IMAGEN_CHAT_NO_DISPONIBLE);
    return <AvisoImagenChat>{aviso}</AvisoImagenChat>;
  }
  return (
    <figure className="flora-chat-app__adjunto-msg">
      <button
        type="button"
        className="flora-chat-app__adjunto-ampliar"
        onClick={() => setAmpliado(true)}
        aria-label="Ver fotografía en grande"
      >
        <ImagenMensajeFlora
          key={adjunto.vista}
          src={adjunto.vista}
          diferida={Boolean(adjunto.historica)}
          onFallo={() => setFalloCarga(true)}
        />
      </button>
      {adjunto.etiqueta ? (
        <figcaption className="flora-chat-app__adjunto-msg-meta">{adjunto.etiqueta}</figcaption>
      ) : null}
      {ampliado ? (
        <ModalVisorAdjuntoFlora adjunto={adjunto} onCerrar={() => setAmpliado(false)} />
      ) : null}
    </figure>
  );
}
