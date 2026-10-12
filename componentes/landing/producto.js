"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import { textos } from "@/lib/landing";

export function Producto() {
  const ref = useRef(null);
  const { producto } = textos;

  useGSAP(() => {
    const mm = gsap.matchMedia();
    const pantallas = gsap.utils.toArray(".producto__pantalla");

    mm.add("(min-width: 64rem) and (prefers-reduced-motion: no-preference)", () => {
      gsap.set(pantallas, { opacity: 0, y: 28 });
      gsap.set(pantallas[0], { opacity: 1, y: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "+=150%",
          pin: ".producto__escena",
          scrub: 0.5,
        },
      });

      pantallas.forEach((pantalla, indice) => {
        if (indice === 0) return;
        tl.to(pantallas[indice - 1], { opacity: 0, y: -24, duration: 0.35 }, indice - 0.15)
          .to(pantalla, { opacity: 1, y: 0, duration: 0.35 }, indice - 0.15);
      });
    });

    mm.add("(max-width: 63.99rem) and (prefers-reduced-motion: no-preference)", () => {
      gsap.from(pantallas, {
        opacity: 0,
        y: 20,
        duration: 0.45,
        stagger: 0.08,
        scrollTrigger: {
          trigger: ref.current,
          start: "top 75%",
          once: true,
        },
      });
    });
  }, { scope: ref });

  return (
    <section className="producto" id="producto" ref={ref}>
      <div className="producto__escena">
        <div className="producto__texto">
          <h2>{producto.titulo}</h2>
          <p>{producto.bajada}</p>
        </div>
        <div className="producto__marco">
          {producto.pantallas.map((pantalla) => (
            <article className="producto__pantalla" key={pantalla.kicker}>
              <p>{pantalla.kicker}</p>
              <h3>{pantalla.titulo}</h3>
              <span>{pantalla.detalle}</span>
              <ul>
                {pantalla.lineas.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
