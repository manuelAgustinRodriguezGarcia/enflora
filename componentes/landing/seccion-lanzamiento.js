"use client";

import { useEffect, useState } from "react";
import { AvisoDisponibilidad } from "@/componentes/aviso-disponibilidad";
import Counter from "@/componentes/landing/counter";
import TextLoop from "@/componentes/landing/text-loop";
import { textos } from "@/lib/landing";
import { TextoConMarca } from "@/componentes/marca-enflora";

const OBJETIVO_MS = Date.parse("2026-11-01T00:00:00-03:00");
const TEXTO_CLARO = "#FDF1D7";

const UNIDADES = [
  { clave: "dias", etiqueta: "Días", minDigits: 2 },
  { clave: "horas", etiqueta: "Horas", minDigits: 2 },
  { clave: "minutos", etiqueta: "Minutos", minDigits: 2 },
  { clave: "segundos", etiqueta: "Segundos", minDigits: 2 },
];

function calcularRestante(ahora) {
  const diff = Math.max(0, OBJETIVO_MS - ahora);
  const total = Math.floor(diff / 1000);
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
    listo: diff === 0,
  };
}

function UnidadContador({ valor, etiqueta, minDigits }) {
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
            duration={0.65}
            bounce={0.12}
            stagger={0.03}
            gap={10}
            padding={22}
            fade={0}
            className="lanzamiento__counter"
          />
        )}
      </div>
      <span className="lanzamiento__etiqueta">{etiqueta}</span>
    </div>
  );
}

export function SeccionLanzamiento() {
  const { lanzamiento } = textos;
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

  const listo = restante?.listo ?? false;

  return (
    <section
      className="lanzamiento"
      id="lanzamiento"
      data-logo="light"
      aria-label={lanzamiento.titulo}
    >
      {!listo ? (
        <div className="lanzamiento__cinta">
          <TextLoop
            text={lanzamiento.cinta}
            shape="line"
            speed={120}
            direction="forward"
            separator=""
            curviness={90}
            tilt={0}
            fontSize={40}
            fontWeight={800}
            letterSpacing={1}
            uppercase
            ribbon
            ribbonColor="#0B3D2A"
            ribbonWidth={76}
            edgeFade={0}
            cross
            crossAngle={14}
            crossColor="#e98a3d"
            color="#FDF1D7"
            draggable
            scrollBoost={0}
            outline={false}
            pauseOnHover
          />
        </div>
      ) : null}
      <div className="lanzamiento__contenedor">
        {!listo ? (
          <p className="lanzamiento__faltan">{lanzamiento.faltan}</p>
        ) : null}

        {listo ? (
          <p className="lanzamiento__disponible" role="status">
            <TextoConMarca texto={lanzamiento.disponible} />
          </p>
        ) : (
          <>
            <p className="lanzamiento__sr">{lanzamiento.descripcionAccesible}</p>
            <div className="lanzamiento__contador" aria-hidden="true">
              {UNIDADES.map((unidad, indice) => (
                <div key={unidad.clave} className="lanzamiento__bloque">
                  <UnidadContador
                    valor={restante ? restante[unidad.clave] : null}
                    etiqueta={unidad.etiqueta}
                    minDigits={unidad.minDigits}
                  />
                  {indice < UNIDADES.length - 1 ? (
                    <span className="lanzamiento__sep" />
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
        <AvisoDisponibilidad />
      </div>
    </section>
  );
}
