"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, Paperclip, X } from "lucide-react";
import { ACEPTAR_FOTOS } from "@/lib/fotos";
import { FLORA_CHAT_MAX_IMAGENES } from "@/lib/flora-imagen-chat";
import { prepararImagenDispositivoParaFlora, liberarAdjuntoFlora } from "@/lib/flora-imagen-cliente";
import { ModalFotosEnflora } from "@/componentes/flora/modal-fotos-enflora";

function idAdjuntoLocal() {
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ModalVisorAdjuntoFlora({ adjunto, onCerrar }) {
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

export function PreviewsAdjuntoFlora({ adjuntos = [], onQuitar, disabled = false }) {
  const [ampliado, setAmpliado] = useState(null);

  if (!adjuntos.length) return null;

  return (
    <>
      <ul className="flora-adjunto__grilla" aria-label="Fotos por enviar">
        {adjuntos.map((item) => (
          <li key={item.id} className="flora-adjunto__celda">
            <button
              type="button"
              className="flora-adjunto__ampliar"
              onClick={() => setAmpliado(item)}
              aria-label="Ver foto en grande"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.vista} alt="" />
            </button>
            <button
              type="button"
              className="flora-adjunto__quitar-celda"
              onClick={() => onQuitar?.(item.id)}
              disabled={disabled}
              aria-label="Quitar imagen"
            >
              <X strokeWidth={2} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <ModalVisorAdjuntoFlora adjunto={ampliado} onCerrar={() => setAmpliado(null)} />
    </>
  );
}

export function MenuDeslizableAdjuntoFlora({
  abierto,
  onCerrar,
  adjuntos = [],
  onAgregar,
  disabled = false,
  preparando = false,
  onPreparandoChange,
  onErrorAdjunto,
}) {
  const [modalEnflora, setModalEnflora] = useState(false);
  const camaraRef = useRef(null);
  const galeriaRef = useRef(null);
  const lleno = adjuntos.length >= FLORA_CHAT_MAX_IMAGENES;

  const procesarArchivo = async (archivo) => {
    if (!archivo || disabled || lleno) return;
    onPreparandoChange?.(true);
    onErrorAdjunto?.("");
    const resultado = await prepararImagenDispositivoParaFlora(archivo);
    onPreparandoChange?.(false);
    if (resultado.error) {
      onErrorAdjunto?.(resultado.error);
      return;
    }
    onAgregar?.({
      id: idAdjuntoLocal(),
      origen: "transitoria",
      mimeType: resultado.adjunto.mimeType,
      datosBase64: resultado.adjunto.datosBase64,
      vista: resultado.adjunto.vista,
      liberar: resultado.adjunto.liberar,
    });
    onCerrar?.();
  };

  const onArchivos = (evento) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    procesarArchivo(archivo);
  };

  const elegirEnflora = (foto) => {
    if (lleno) return;
    onAgregar?.({
      id: idAdjuntoLocal(),
      origen: "enflora",
      fotoId: foto.id,
      vista: foto.url_miniatura,
      etiqueta: [foto.unidad_nombre, foto.planta_etiqueta].filter(Boolean).join(" · "),
    });
    setModalEnflora(false);
    onCerrar?.();
  };

  const abrirCamaraODispositivo = () => {
    const preferirCamara =
      typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    (preferirCamara ? camaraRef : galeriaRef).current?.click();
  };

  return (
    <>
      <div
        className={`flora-adjunto__sheet ${abierto ? "flora-adjunto__sheet--abierto" : ""}`}
        aria-hidden={!abierto}
      >
        <div className="flora-adjunto__sheet-inner" role="menu" aria-labelledby="flora-adjunto-sheet-titulo">
          <p id="flora-adjunto-sheet-titulo" className="flora-adjunto__sheet-titulo">
            Subir imagen desde
          </p>
          <button
            type="button"
            role="menuitem"
            className="flora-adjunto__sheet-item"
            onClick={abrirCamaraODispositivo}
            disabled={disabled || preparando || lleno}
          >
            <Camera strokeWidth={1.75} aria-hidden="true" />
            Cámara o dispositivo
          </button>
          <button
            type="button"
            role="menuitem"
            className="flora-adjunto__sheet-item flora-adjunto__sheet-item--enflora"
            onClick={() => {
              setModalEnflora(true);
              onCerrar?.();
            }}
            disabled={disabled || preparando || lleno}
          >
            <ImagePlus strokeWidth={1.75} aria-hidden="true" />
            <span className="flora-adjunto__sheet-texto">
              Galería de{" "}
              <span className="flora-adjunto__marca-enflora">Enflora</span>
            </span>
          </button>
        </div>
      </div>

      <input
        ref={camaraRef}
        type="file"
        accept={ACEPTAR_FOTOS}
        capture="environment"
        className="flora-adjunto__input"
        onChange={onArchivos}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={galeriaRef}
        type="file"
        accept={ACEPTAR_FOTOS}
        className="flora-adjunto__input"
        onChange={onArchivos}
        tabIndex={-1}
        aria-hidden="true"
      />

      <ModalFotosEnflora
        abierto={modalEnflora}
        onCerrar={() => setModalEnflora(false)}
        onElegir={elegirEnflora}
      />
    </>
  );
}

export function BotonClipAdjuntoFlora({
  abierto = false,
  onToggle,
  disabled = false,
  preparando = false,
  lleno = false,
}) {
  return (
    <button
      type="button"
      className={`flora-adjunto__clip${abierto ? " flora-adjunto__clip--abierto" : ""}`}
      onClick={onToggle}
      disabled={disabled || preparando || lleno}
      aria-expanded={abierto}
      aria-haspopup="menu"
      aria-label={abierto ? "Cerrar menú de adjuntos" : "Adjuntar fotografía"}
    >
      <span className="flora-adjunto__clip-iconos" aria-hidden="true">
        <Paperclip className="flora-adjunto__clip-svg flora-adjunto__clip-svg--adjuntar" strokeWidth={1.75} />
        <X className="flora-adjunto__clip-svg flora-adjunto__clip-svg--cerrar" strokeWidth={1.75} />
      </span>
    </button>
  );
}

export function EstadoAdjuntoFlora({ preparando, errorAdjunto }) {
  if (!preparando && !errorAdjunto) return null;
  return (
    <div className="flora-adjunto__estado-wrap">
      {preparando ? (
        <p className="flora-adjunto__estado" role="status">
          <LoaderCircle className="flora-adjunto__giro" strokeWidth={1.75} aria-hidden="true" />
          Preparando imagen…
        </p>
      ) : null}
      {errorAdjunto ? (
        <p className="flora-adjunto__error" role="alert">
          {errorAdjunto}
        </p>
      ) : null}
    </div>
  );
}

export function liberarAdjuntosFlora(lista) {
  for (const item of lista || []) liberarAdjuntoFlora(item);
}

export function payloadImagenesParaApi(adjuntos) {
  if (!adjuntos?.length) return undefined;
  return adjuntos
    .map((adjunto) => {
      if (adjunto.origen === "transitoria") {
        return {
          origen: "transitoria",
          mimeType: adjunto.mimeType,
          datosBase64: adjunto.datosBase64,
        };
      }
      if (adjunto.origen === "enflora") {
        return { origen: "enflora", fotoId: adjunto.fotoId };
      }
      return null;
    })
    .filter(Boolean);
}

/** @deprecated usar payloadImagenesParaApi */
export function payloadImagenParaApi(adjunto) {
  const lista = payloadImagenesParaApi(adjunto ? [adjunto] : []);
  return lista?.[0];
}
