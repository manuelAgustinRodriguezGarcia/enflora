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

export function EscenaSolar({ children }) {
  const escritorio = useEscritorio();

  return (
    <div className="escena-solar">
      <div className="escena-solar__fondo" aria-hidden="true">
        <div className="escena-solar__rays">
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
        </div>
      </div>
      <div className="escena-solar__contenido">{children}</div>
    </div>
  );
}
