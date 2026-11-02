"use client";

import { useEffect } from "react";
import { COOKIE_UNIDAD_HISTORIAL, esUuid } from "@/lib/historial-registros";

const UN_ANIO = 60 * 60 * 24 * 400;

export function RecordarUnidadHistorial({ unidadId }) {
  useEffect(() => {
    if (!esUuid(unidadId)) return;
    const segura = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_UNIDAD_HISTORIAL}=${unidadId}; Path=/; Max-Age=${UN_ANIO}; SameSite=Lax${segura}`;
  }, [unidadId]);

  return null;
}
