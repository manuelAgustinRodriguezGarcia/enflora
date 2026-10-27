"use client";

import { useRef } from "react";
import { Camera, Images, LoaderCircle, X } from "lucide-react";
import { ACEPTAR_FOTOS } from "@/lib/fotos";

// Selector reutilizable de imágenes: cámara, galería, previews y quitar.
// No sube nada: solo informa qué archivos se eligieron y qué item se quitó.
// items: [{ clave, url, estado: "procesando" | "lista", nueva }]
export function SelectorFotos({
  items = [],
  maximo = 10,
  multiple = true,
  disabled = false,
  etiquetaCamara = "Cámara",
  etiquetaGaleria = "Galería",
  onSeleccionar,
  onAbrir,
  onQuitar,
}) {
  const camara = useRef(null);
  const galeria = useRef(null);
  const lleno = items.length >= maximo;

  function alElegir(evento) {
    const archivos = [...(evento.target.files || [])];
    // Permite volver a elegir el mismo archivo después de quitarlo.
    evento.target.value = "";
    if (archivos.length > 0) onSeleccionar?.(archivos);
  }

  return (
    <div className="fotos-selector">
      {items.length > 0 ? (
        <ul className="fotos-selector__grilla" aria-label="Fotos seleccionadas">
          {items.map((item) => (
            <li key={item.clave} className="fotos-selector__item">
              {item.estado === "procesando" ? (
                <span className="fotos-selector__cargando" role="status" aria-label="Preparando foto">
                  <LoaderCircle className="fotos-selector__giro" strokeWidth={1.75} aria-hidden="true" />
                </span>
              ) : (
                <button
                  type="button"
                  className="fotos-selector__abrir"
                  onClick={() => onAbrir?.(item)}
                  disabled={!onAbrir}
                  aria-label="Ver foto"
                >
                  {/* Vista previa local o miniatura firmada: next/image no aplica a blobs ni URLs privadas. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" loading="lazy" decoding="async" />
                </button>
              )}
              {item.nueva && item.estado !== "procesando" ? (
                <span className="fotos-selector__nueva">Nueva</span>
              ) : null}
              <button
                type="button"
                className="fotos-selector__quitar"
                onClick={() => onQuitar?.(item)}
                disabled={disabled}
                aria-label="Quitar foto"
              >
                <X strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="fotos-selector__acciones">
        <button
          type="button"
          className="fotos-selector__boton"
          onClick={() => camara.current?.click()}
          disabled={disabled || lleno}
        >
          <Camera strokeWidth={1.75} aria-hidden="true" />
          <span>{etiquetaCamara}</span>
        </button>
        <button
          type="button"
          className="fotos-selector__boton"
          onClick={() => galeria.current?.click()}
          disabled={disabled || lleno}
        >
          <Images strokeWidth={1.75} aria-hidden="true" />
          <span>{etiquetaGaleria}</span>
        </button>
      </div>

      <input
        ref={camara}
        type="file"
        accept={ACEPTAR_FOTOS}
        capture="environment"
        className="fotos-selector__input"
        onChange={alElegir}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={galeria}
        type="file"
        accept={ACEPTAR_FOTOS}
        multiple={multiple}
        className="fotos-selector__input"
        onChange={alElegir}
        tabIndex={-1}
        aria-hidden="true"
      />

      {multiple ? (
        <p className="fotos-selector__ayuda">Podés subir hasta {maximo} imágenes.</p>
      ) : null}
    </div>
  );
}
