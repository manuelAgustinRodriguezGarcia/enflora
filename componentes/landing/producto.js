"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import { textos } from "@/lib/landing";

const PIN_PROPS =
  "position,top,left,right,bottom,width,height,maxWidth,maxHeight,margin,padding,transform,inset,zIndex";

export function Producto() {
  const ref = useRef(null);
  const { producto } = textos;

  useGSAP(
    () => {
      const seccion = ref.current;
      if (!seccion) return undefined;

      const mm = gsap.matchMedia();
      const pantallas = gsap.utils.toArray(".producto__pantalla", seccion);
      const escena = seccion.querySelector(".producto__escena");

      mm.add("(min-width: 64rem) and (prefers-reduced-motion: no-preference)", () => {
        gsap.set(pantallas, { autoAlpha: 0, y: 28 });
        gsap.set(pantallas[0], { autoAlpha: 1, y: 0 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: seccion,
            start: "top top",
            end: "+=150%",
            pin: escena,
            pinType: "fixed",
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        pantallas.forEach((pantalla, indice) => {
          if (indice === 0) return;
          tl.to(pantallas[indice - 1], { autoAlpha: 0, y: -24, duration: 0.35 }, indice - 0.15).to(
            pantalla,
            { autoAlpha: 1, y: 0, duration: 0.35 },
            indice - 0.15,
          );
        });

        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
          gsap.set(pantallas, { clearProps: "opacity,visibility,transform" });
          if (escena) gsap.set(escena, { clearProps: PIN_PROPS });
        };
      });

      mm.add("(max-width: 63.99rem) and (prefers-reduced-motion: no-preference)", () => {
        gsap.from(pantallas, {
          autoAlpha: 0,
          y: 20,
          duration: 0.45,
          stagger: 0.08,
          scrollTrigger: {
            trigger: seccion,
            start: "top 75%",
            once: true,
          },
        });
      });

      return () => {
        mm.revert();
        if (escena) gsap.set(escena, { clearProps: PIN_PROPS });
        gsap.set(pantallas, { clearProps: "opacity,visibility,transform" });
      };
    },
    { scope: ref },
  );

  return (
    <section className="producto" id="producto" data-logo="dark" ref={ref}>
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
