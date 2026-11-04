"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { eliminarGeneticaPersonalizada } from "@/app/geneticas/acciones";
import { Boton } from "@/componentes/boton";
import { FormularioGenetica } from "@/componentes/formulario-genetica";
import { IconoBasura, IconoLapiz, IconoPlanta } from "@/componentes/iconos-ui";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
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

export function ModalGenetica({ abierto, detalle, nombre, onCerrar, onActualizada, onEliminada }) {
  const [local, setLocal] = useState(null);
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState("");
  const ficha = local?.id && local.id === detalle?.id ? local : detalle;
  const titulo = ficha?.nombre || nombre || "Genética";
  const externa = ficha?.origen === "strainapi";
  const propia = ficha?.origen === "personalizada" && Boolean(ficha?.id);

  function cerrar() {
    setEditando(false);
    setBorrando(false);
    setErrorBorrar("");
    setLocal(null);
    onCerrar();
  }

  async function confirmarBorrado() {
    if (pendiente || !propia) return;
    setPendiente(true);
    setErrorBorrar("");
    const resultado = await eliminarGeneticaPersonalizada(ficha.id);
    setPendiente(false);
    if (resultado?.error) {
      setErrorBorrar(resultado.error);
      return;
    }
    const id = ficha.id;
    setBorrando(false);
    setLocal(null);
    onEliminada?.(id);
    onCerrar();
  }

  return (
    <>
      <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente) cerrar(); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="modal__fondo" />
          <Dialog.Viewport className="modal__vista">
            <Dialog.Popup className="modal__panel genetica-modal">
              <div className="genetica-modal__figura">
                <ImagenGenetica detalle={ficha} nombre={titulo} grande />
                <button type="button" className="genetica-modal__cerrar" aria-label="Cerrar" onClick={cerrar}>
                  <X strokeWidth={2} aria-hidden="true" />
                </button>
                <div className="genetica-modal__pie">
                  <Dialog.Title className="genetica-modal__titulo">{titulo}</Dialog.Title>
                  {propia ? (
                    <div className="genetica-modal__acciones">
                      <Boton
                        className="boton boton--secundario boton--icono"
                        type="button"
                        aria-label="Editar genética"
                        aria-haspopup="dialog"
                        aria-expanded={editando}
                        onClick={() => setEditando(true)}
                      >
                        <IconoLapiz />
                      </Boton>
                      <Boton
                        className="boton boton--destructivo boton--icono"
                        type="button"
                        aria-label="Eliminar genética"
                        onClick={() => {
                          setErrorBorrar("");
                          setBorrando(true);
                        }}
                      >
                        <IconoBasura />
                      </Boton>
                    </div>
                  ) : null}
                </div>
              </div>
              <dl className="genetica-modal__lista">
                <div className="genetica-modal__par">
                  <div>
                    <dt>THC</dt>
                    <dd>{textoPorcentaje(ficha?.thc)}</dd>
                  </div>
                  <div>
                    <dt>CBD</dt>
                    <dd>{textoPorcentaje(ficha?.cbd)}</dd>
                  </div>
                </div>
                <div className="genetica-modal__par">
                  <div>
                    <dt>Sabor</dt>
                    <dd>{textoDato(ficha?.sabor)}</dd>
                  </div>
                  <div>
                    <dt>Aroma</dt>
                    <dd>{textoDato(ficha?.aroma)}</dd>
                  </div>
                </div>
              </dl>
              {externa ? <AtribucionStrain /> : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
      <FormularioGenetica
        abierto={editando}
        detalle={ficha}
        onCerrar={() => setEditando(false)}
        onGuardada={(siguiente) => {
          setLocal(siguiente);
          setEditando(false);
          onActualizada?.(siguiente);
        }}
      />
      <ModalConfirmacion
        abierto={borrando}
        onCerrar={() => {
          if (!pendiente) setBorrando(false);
        }}
        titulo="¿Eliminar esta genética?"
        descripcion="Se borra de tu lista. Las plantas que ya la usan conservan el nombre."
        textoConfirmar="Eliminar"
        pendiente={pendiente}
        error={errorBorrar}
        onConfirmar={confirmarBorrado}
        icono={<IconoBasura />}
        varianteConfirmar="destructivo"
      />
    </>
  );
}

export function FiguraGenetica({ detalle, nombre }) {
  return <ImagenGenetica detalle={detalle} nombre={nombre} />;
}
