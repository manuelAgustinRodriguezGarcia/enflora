"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { IconoPlanta } from "@/componentes/iconos-ui";
import { ATRIBUCION_STRAINAPI, URL_STRAINAPI, textoDato, textoPorcentaje } from "@/lib/geneticas/reglas";

function ImagenGenetica({ detalle, nombre, grande = false }) {
  if (detalle?.imagenUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={grande ? "genetica-modal__imagen" : "genetica-tarjeta__imagen"}
        src={detalle.imagenUrl}
        alt=""
      />
    );
  }
  return (
    <span className="genetica-tarjeta__placeholder" aria-label={nombre ? `Sin imagen de ${nombre}` : "Sin imagen"}>
      <IconoPlanta />
    </span>
  );
}

export function AtribucionStrain() {
  return (
    <p className="genetica-atribucion">
      <a href={URL_STRAINAPI} target="_blank" rel="noreferrer">
        {ATRIBUCION_STRAINAPI}
      </a>
    </p>
  );
}

export function ModalGenetica({ abierto, detalle, nombre, onCerrar }) {
  const titulo = detalle?.nombre || nombre || "Genética";
  const externa = detalle?.origen === "strainapi";

  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente) onCerrar(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal__fondo" />
        <Dialog.Viewport className="modal__vista">
          <Dialog.Popup className="modal__panel genetica-modal">
            <div className="genetica-modal__figura">
              <ImagenGenetica detalle={detalle} nombre={titulo} grande />
              <button type="button" className="genetica-modal__cerrar" aria-label="Cerrar" onClick={onCerrar}>
                <X strokeWidth={2} aria-hidden="true" />
              </button>
              <Dialog.Title className="genetica-modal__titulo">{titulo}</Dialog.Title>
            </div>
            <dl className="genetica-modal__lista">
              <div>
                <dt>THC</dt>
                <dd>{textoPorcentaje(detalle?.thc)}</dd>
              </div>
              <div>
                <dt>CBD</dt>
                <dd>{textoPorcentaje(detalle?.cbd)}</dd>
              </div>
              <div>
                <dt>Sabor</dt>
                <dd>{textoDato(detalle?.sabor)}</dd>
              </div>
              <div>
                <dt>Aroma</dt>
                <dd>{textoDato(detalle?.aroma)}</dd>
              </div>
            </dl>
            {externa ? <AtribucionStrain /> : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FiguraGenetica({ detalle, nombre }) {
  return <ImagenGenetica detalle={detalle} nombre={nombre} />;
}
