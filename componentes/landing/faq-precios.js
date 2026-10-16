"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { faqPrecios } from "@/lib/planes";
import { formatearFechaCotizacion } from "@/lib/cotizacion";

const transicionAcordeon = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

export function FaqPrecios({ cotizacion }) {
  const [abiertoId, setAbiertoId] = useState(faqPrecios[0]?.id || "");
  const reducido = useReducedMotion();
  const baseId = useId();
  const fecha = formatearFechaCotizacion(cotizacion?.fecha);
  const transicion = reducido ? { duration: 0 } : transicionAcordeon;

  return (
    <div className="precios-faq">
      <h3 className="precios-faq__titulo">Preguntas frecuentes</h3>
      <div className="precios-faq__lista">
        {faqPrecios.map((item) => {
          const abierto = abiertoId === item.id;
          const panelId = `${baseId}-${item.id}-panel`;
          const botonId = `${baseId}-${item.id}-boton`;
          let respuesta = item.respuesta;
          if (item.id === "cotizacion" && cotizacion?.valor) {
            respuesta = fecha
              ? `Usamos el dólar oficial de una API pública. Lo refrescamos cada 12 horas, a las 4:20 y a las 16:20 (hora Argentina). Última actualización: ${fecha}.`
              : item.respuesta;
          }
          return (
            <div
              key={item.id}
              className={`precios-faq__item${abierto ? " precios-faq__item--abierto" : ""}`}
            >
              <button
                type="button"
                id={botonId}
                className="precios-faq__pregunta"
                aria-expanded={abierto}
                aria-controls={panelId}
                onClick={() => setAbiertoId(abierto ? "" : item.id)}
              >
                <span className="precios-faq__pregunta-texto">{item.pregunta}</span>
                <motion.span
                  className="precios-faq__chevron"
                  animate={{ rotate: abierto ? 180 : 0 }}
                  transition={transicion}
                  aria-hidden="true"
                >
                  <ChevronDown size={18} strokeWidth={2.25} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {abierto ? (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={botonId}
                    className="precios-faq__panel"
                    initial={reducido ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={reducido ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                    exit={reducido ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={transicion}
                  >
                    <p className="precios-faq__respuesta">{respuesta}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
