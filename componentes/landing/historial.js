"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import { textos } from "@/lib/landing";

export function Historial() {
  const ref = useRef(null);
  const { historial } = textos;

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(min-width: 64rem) and (prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".historial__linea", { scaleX: 0 }, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 70%",
          end: "bottom 60%",
          scrub: 0.4,
        },
      });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".historial__evento", {
        opacity: 0,
        y: 16,
        duration: 0.45,
        stagger: 0.08,
        scrollTrigger: {
          trigger: ref.current,
          start: "top 80%",
          once: true,
        },
      });
    });
  }, { scope: ref });

  return (
    <section className="historial" id="historial" ref={ref}>
      <div className="historial__texto">
        <h2>{historial.titulo}</h2>
        <p>{historial.bajada}</p>
      </div>
      <div className="historial__pista">
        <div className="historial__linea" aria-hidden="true" />
        <ol>
          {historial.eventos.map((evento) => (
            <li className="historial__evento" key={evento.fecha}>
              <span>{evento.fecha}</span>
              <strong>{evento.hecho}</strong>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
