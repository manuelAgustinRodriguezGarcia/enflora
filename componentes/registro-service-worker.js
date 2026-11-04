"use client";

import { useEffect } from "react";
import { AvisoActualizacion } from "@/componentes/aviso-actualizacion";
import { MensajeInterno } from "@/componentes/mensaje-interno";
import { anotarFalloRegistroWorker } from "@/lib/push/fallo-registro";

export function RegistroServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    let cancelado = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registro) => {
        anotarFalloRegistroWorker(null);
        if (cancelado) return;
        registro.update().catch(() => {});
      })
      .catch((error) => {
        anotarFalloRegistroWorker(error);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <>
      <AvisoActualizacion />
      <MensajeInterno />
    </>
  );
}
