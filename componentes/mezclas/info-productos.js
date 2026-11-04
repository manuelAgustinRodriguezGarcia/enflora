"use client";

import { useState } from "react";
import { Info, PackageOpen } from "lucide-react";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

const TEXTO_AYUDA_PRODUCTOS =
  "Si anotás los productos que utilizás en tus plantas luego podés crear mezclas para anotar tus riegos y llevar control de lo que tus plantas reciben. Así Flora aprende más de tus plantas para ayudarte mucho mejor.";

export function InfoProductos() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button type="button" className="asistente__info-unidades" onClick={() => setAbierto(true)}>
        <Info size={18} strokeWidth={1.9} aria-hidden="true" />
        ¿Qué son mis productos?
      </button>
      <ModalConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        className="modal--ayuda-productos"
        icono={<PackageOpen strokeWidth={1.75} aria-hidden="true" />}
        titulo="¿Qué son mis productos?"
        descripcion={TEXTO_AYUDA_PRODUCTOS}
        textoConfirmar="Entendido"
        mostrarCancelar={false}
        onConfirmar={() => setAbierto(false)}
      />
    </>
  );
}
