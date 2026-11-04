"use client";

import { useId } from "react";
import { svgMeteocons } from "@/lib/clima/meteocons-flat";

export function IconoClima({ nombre }) {
  const base = useId().replace(/:/g, "");

  return (
    <span className="clima-icono">
      <span
        className="clima-icono__animado"
        dangerouslySetInnerHTML={{ __html: svgMeteocons(nombre, { prefijo: `${base}a` }) }}
      />
      <span
        className="clima-icono__quieto"
        dangerouslySetInnerHTML={{ __html: svgMeteocons(nombre, { estatico: true, prefijo: `${base}q` }) }}
      />
    </span>
  );
}
