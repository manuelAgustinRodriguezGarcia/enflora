"use client";

import { IconoFlecha } from "@/componentes/iconos-ui";
import { useDemo } from "@/componentes/demo/proveedor-demo";

export function VolverDemo({ etiqueta = "Volver" }) {
  const { atras } = useDemo();

  return (
    <button type="button" className="enlace-volver demo-pulsable" aria-label={etiqueta} onClick={atras}>
      <IconoFlecha />
    </button>
  );
}
