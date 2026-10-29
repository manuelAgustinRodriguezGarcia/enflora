"use client";

import { EsperaFlora } from "@/componentes/flora/espera-flora";
import { PERSONALIDAD_FLORA_DEFAULT } from "@/lib/flora-personalidad";

/** @deprecated Preferí `EsperaFlora` con personalidad y contexto de imagen. */
export function IndicadorFloraEscribiendo({
  personalidad = PERSONALIDAD_FLORA_DEFAULT,
  conImagen = false,
}) {
  return <EsperaFlora personalidad={personalidad} conImagen={conImagen} />;
}
