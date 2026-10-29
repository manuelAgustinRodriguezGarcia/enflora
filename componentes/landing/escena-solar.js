"use client";

import { useEffect, useState } from "react";
import { SideRays } from "@/componentes/landing/side-rays";

function useEscritorio() {
  const [escritorio, setEscritorio] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia("(min-width: 64rem)");
    const actualizar = () => setEscritorio(consulta.matches);
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);

  return escritorio;
}

/** WebGL del fondo: después del primer paint para no competir con LCP (hero Flora). */
function useRayosDiferidos() {
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const activar = () => {
      if (!cancelado) setListo(true);
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(activar, { timeout: 2500 });
      return () => {
        cancelado = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(activar, 300);
    return () => {
      cancelado = true;
      window.clearTimeout(id);
    };
  }, []);

  return listo;
}

export function EscenaSolar({ children }) {
  const escritorio = useEscritorio();
  const rayosListos = useRayosDiferidos();

  return (
    <div className="escena-solar">
      <div className="escena-solar__fondo" aria-hidden="true">
        <div className="escena-solar__rays">
          {rayosListos ? (
            <SideRays
              rayColor1="#FF00AA"
              rayColor2="#D500F9"
              origin="top-right"
              speed={escritorio ? 1.25 : 0.95}
              intensity={escritorio ? 1.45 : 1.15}
              spread={escritorio ? 2 : 1.7}
              density={escritorio ? 5.5 : 4.5}
              sharpness={0.3}
              falloff={escritorio ? 1.15 : 1.3}
              glow={escritorio ? 0.9 : 0.75}
              saturation={1.15}
              dust={0}
              blend={0.4}
              lightMode
              opacity={escritorio ? 0.55 : 0.42}
              followMouse
              mouseInfluence={escritorio ? 0.45 : 0.28}
              intro
              maxDevicePixelRatio={escritorio ? 1.5 : 1.25}
            />
          ) : null}
        </div>
      </div>
      <div className="escena-solar__contenido">{children}</div>
    </div>
  );
}
