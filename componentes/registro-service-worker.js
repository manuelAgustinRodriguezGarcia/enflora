"use client";

import { useEffect } from "react";
import { MensajeInterno } from "@/componentes/mensaje-interno";
import { anotarFalloRegistroWorker } from "@/lib/push/fallo-registro";
import { sincronizarVinculoInstalacion } from "@/lib/push/cliente-dispositivo";

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
        sincronizarVinculoInstalacion().catch(() => {});
      })
      .catch((error) => {
        anotarFalloRegistroWorker(error);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return <MensajeInterno />;
}
