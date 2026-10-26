"use client";

import { useEffect, useState } from "react";
import Counter from "@/componentes/landing/counter";
import { LANZAMIENTO_MS } from "@/lib/lanzamiento";

const TEXTO_CLARO = "#FDF1D7";

const UNIDADES = [
  { clave: "dias", etiqueta: "Días", minDigits: 2 },
  { clave: "horas", etiqueta: "Horas", minDigits: 2 },
  { clave: "minutos", etiqueta: "Minutos", minDigits: 2 },
  { clave: "segundos", etiqueta: "Segundos", minDigits: 2 },
];

function calcularRestante(ahora) {
  const diff = Math.max(0, LANZAMIENTO_MS - ahora);
  const total = Math.floor(diff / 1000);
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
    listo: diff === 0,
  };
}

export function useRestanteLanzamiento() {
  const [restante, setRestante] = useState(null);

  useEffect(() => {
    let id;

    const tick = () => {
      const siguiente = calcularRestante(Date.now());
      setRestante(siguiente);
      if (siguiente.listo && id) {
        clearInterval(id);
        id = undefined;
      }
    };

    tick();
    id = window.setInterval(tick, 1000);

    const sincronizar = () => {
      if (document.visibilityState === "visible") tick();
    };

    document.addEventListener("visibilitychange", sincronizar);
    window.addEventListener("focus", tick);

    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", sincronizar);
      window.removeEventListener("focus", tick);
    };
  }, []);

  return restante;
}

function UnidadContador({ valor, etiqueta, minDigits, compacto }) {
  return (
    <div className="lanzamiento__unidad">
      <div className="lanzamiento__numero">
        {valor === null ? (
          <span className="lanzamiento__placeholder" />
        ) : (
          <Counter
            value={valor}
            locale="es-AR"
            minDigits={minDigits}
            textColor={TEXTO_CLARO}
            tabular
            fontSize="inherit"
            fontWeight={600}
            duration={compacto ? 0.45 : 0.65}
            bounce={compacto ? 0 : 0.12}
            stagger={0.03}
            gap={compacto ? 1 : 10}
            padding={compacto ? 2 : 22}
            fade={0}
            className="lanzamiento__counter"
          />
        )}
      </div>
      <span className="lanzamiento__etiqueta">{etiqueta}</span>
    </div>
  );
}

export function ContadorLanzamiento({ restante, compacto = false }) {
  return (
    <div
      className={`lanzamiento__contador${compacto ? " lanzamiento__contador--pill" : ""}`}
      aria-hidden="true"
    >
      {UNIDADES.map((unidad, indice) => (
        <div key={unidad.clave} className="lanzamiento__bloque">
          <UnidadContador
            valor={restante ? restante[unidad.clave] : null}
            etiqueta={unidad.etiqueta}
            minDigits={unidad.minDigits}
            compacto={compacto}
          />
          {indice < UNIDADES.length - 1 ? <span className="lanzamiento__sep" /> : null}
        </div>
      ))}
    </div>
  );
}
