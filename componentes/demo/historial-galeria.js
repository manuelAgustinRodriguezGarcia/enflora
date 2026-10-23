"use client";

import { Dialog } from "@base-ui/react/dialog";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { IconoChevron } from "@/componentes/iconos-ui";
import { fechaLarga, textoDiaCultivo } from "@/lib/demo/historial/historial-demo";

const UMBRAL_DESLIZ = 48;

export function textoFoto(foto) {
  return `${textoDiaCultivo(foto.dia)} · ${fechaLarga(foto.fecha)}`;
}

export function GaleriaDia({ fotos, dia, onAbrir }) {
  if (!fotos.length) return null;
  return (
    <ul className="historial-galeria" aria-label={`Fotos del día ${dia.dia}`}>
      {fotos.map((foto, indice) => (
        <li key={foto.id} className="historial-galeria__item">
          <button
            type="button"
            className="historial-galeria__foto demo-pulsable"
            onClick={() => onAbrir(foto.id)}
            aria-label={`Ampliar foto ${indice + 1} de ${fotos.length} del día ${dia.dia}`}
          >
            <Image
              src={foto.miniatura}
              alt=""
              width={foto.anchoMiniatura}
              height={foto.altoMiniatura}
              unoptimized
              loading="lazy"
              draggable={false}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

function precargar(foto) {
  if (!foto || typeof window === "undefined") return;
  const imagen = new window.Image();
  imagen.src = foto.url;
}

export function VisorFotos({ fotos, fotoId, onCerrar, onCambiar }) {
  const indice = fotos.findIndex((foto) => foto.id === fotoId);
  const foto = indice >= 0 ? fotos[indice] : null;
  const anterior = indice > 0 ? fotos[indice - 1] : null;
  const siguiente = indice >= 0 && indice < fotos.length - 1 ? fotos[indice + 1] : null;
  const inicioDesliz = useRef(null);

  useEffect(() => {
    precargar(anterior);
    precargar(siguiente);
  }, [anterior, siguiente]);

  function manejarTecla(evento) {
    if (evento.key === "ArrowLeft" && anterior) {
      evento.preventDefault();
      onCambiar(anterior.id);
    }
    if (evento.key === "ArrowRight" && siguiente) {
      evento.preventDefault();
      onCambiar(siguiente.id);
    }
  }

  function empezarDesliz(evento) {
    inicioDesliz.current = { x: evento.clientX, y: evento.clientY };
  }

  function terminarDesliz(evento) {
    const inicio = inicioDesliz.current;
    inicioDesliz.current = null;
    if (!inicio) return;
    const dx = evento.clientX - inicio.x;
    const dy = evento.clientY - inicio.y;
    if (Math.abs(dx) < UMBRAL_DESLIZ || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0 && siguiente) onCambiar(siguiente.id);
    if (dx > 0 && anterior) onCambiar(anterior.id);
  }

  return (
    <Dialog.Root
      open={Boolean(foto)}
      onOpenChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="historial-visor__fondo" />
        <Dialog.Viewport className="historial-visor__vista">
          <Dialog.Popup className="historial-visor" onKeyDown={manejarTecla}>
            {foto ? (
              <>
                <header className="historial-visor__cabecera">
                  <div className="historial-visor__textos">
                    <Dialog.Title className="historial-visor__titulo">{textoFoto(foto)}</Dialog.Title>
                    <Dialog.Description className="historial-visor__contador">
                      Foto {indice + 1} de {fotos.length}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close className="historial-visor__cerrar demo-pulsable" aria-label="Cerrar visor">
                    <span aria-hidden="true">×</span>
                  </Dialog.Close>
                </header>
                <figure
                  className="historial-visor__figura"
                  onPointerDown={empezarDesliz}
                  onPointerUp={terminarDesliz}
                  onPointerCancel={() => {
                    inicioDesliz.current = null;
                  }}
                >
                  <Image
                    key={foto.id}
                    src={foto.url}
                    alt={`Foto del cultivo en el ${textoFoto(foto).toLowerCase()}`}
                    width={foto.ancho}
                    height={foto.alto}
                    unoptimized
                    priority
                    draggable={false}
                    className="historial-visor__imagen"
                  />
                </figure>
                <div className="historial-visor__controles">
                  <button
                    type="button"
                    className="historial-visor__control demo-pulsable"
                    onClick={() => anterior && onCambiar(anterior.id)}
                    disabled={!anterior}
                    aria-label="Foto anterior"
                  >
                    <IconoChevron />
                  </button>
                  <button
                    type="button"
                    className="historial-visor__control historial-visor__control--siguiente demo-pulsable"
                    onClick={() => siguiente && onCambiar(siguiente.id)}
                    disabled={!siguiente}
                    aria-label="Foto siguiente"
                  >
                    <IconoChevron />
                  </button>
                </div>
              </>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
