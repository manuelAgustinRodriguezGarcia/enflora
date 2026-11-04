"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IconoClima } from "@/componentes/clima/icono-clima";
import { transicionVista } from "@/lib/animaciones";
import { temaClima } from "@/lib/clima/tema";
import { textoMilimetros, textoPorcentaje, textoTemperatura, textoViento } from "@/lib/clima/texto";

function presente(texto) {
  return texto || "Sin dato";
}

export function EscenaClima({ espacioNombre, localidad, actual }) {
  const reducido = useReducedMotion();
  const tema = temaClima({
    temperaturaC: actual?.temperaturaC ?? null,
    esDia: actual?.esDia ?? null,
    codigo: actual?.codigo ?? null,
  });
  const temperatura = textoTemperatura(actual?.temperaturaC);
  const sensacion = textoTemperatura(actual?.sensacionC);
  const transicion = reducido ? { duration: 0 } : transicionVista;
  const momento = tema.momento === "dia" ? "Día" : tema.momento === "noche" ? "Noche" : "";

  return (
    <article
      className="clima-hero"
      data-rango={tema.rango}
      data-momento={tema.momento}
      style={{
        "--clima-fondo": tema.paleta.fondo,
        "--clima-fondo-fin": tema.paleta.fondoFin,
        "--clima-tinta": tema.paleta.tinta,
        "--clima-suave": tema.paleta.tintaSuave,
        "--clima-acento": tema.paleta.acento,
      }}
      aria-labelledby="clima-espacio"
    >
      <span className="clima-hero__brillo" aria-hidden="true" />
      <p className="clima-hero__kicker">Clima</p>
        <div className="clima-hero__cuerpo">
          <div className="clima-hero__lugar">
            <h1 id="clima-espacio">{espacioNombre}</h1>
            <p>
              {localidad || "Sin localidad"}
              {momento ? ` · ${momento}` : ""}
            </p>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tema.icono}
              className="clima-hero__icono"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={transicion}
            >
              <IconoClima nombre={tema.icono} />
            </motion.div>
          </AnimatePresence>
          <div className="clima-hero__lectura">
            <p className={temperatura ? "clima-hero__temperatura" : "clima-hero__temperatura clima-hero__temperatura--vacia"}>
              {presente(temperatura)}
            </p>
            <p className="clima-hero__sensacion">{sensacion ? `Sensación ${sensacion}` : "Sensación no informada"}</p>
          </div>
          <p className="clima-hero__condicion">{actual?.condicion || "Condición no informada"}</p>
        </div>
      <dl className="clima-hero__metricas">
        <div>
          <dt>Humedad</dt>
          <dd>{presente(textoPorcentaje(actual?.humedad))}</dd>
        </div>
        <div>
          <dt>Viento</dt>
          <dd>{presente(textoViento(actual?.vientoKph))}</dd>
        </div>
        <div>
          <dt>Precipitación actual</dt>
          <dd>{presente(textoMilimetros(actual?.precipitacionMm))}</dd>
        </div>
      </dl>
    </article>
  );
}
