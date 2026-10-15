"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import { textos } from "@/lib/landing";

export function Caos() {
  const ref = useRef(null);
  const { caos } = textos;

  useGSAP(() => {
    const mm = gsap.matchMedia();
    const piezas = gsap.utils.toArray(".caos__pieza");
    const fases = gsap.utils.toArray(".caos__fase");

    mm.add("(min-width: 64rem) and (prefers-reduced-motion: no-preference)", () => {
      gsap.set(piezas, {
        x: () => gsap.utils.random(-220, 220),
        y: () => gsap.utils.random(-120, 160),
        rotation: () => gsap.utils.random(-16, 16),
      });
      gsap.set(fases, { autoAlpha: 0 });
      gsap.set(fases[0], { autoAlpha: 1 });
      gsap.set(".caos__marco", { autoAlpha: 0.35, scale: 0.96 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "+=170%",
          pin: ".caos__escena",
          scrub: 0.65,
        },
      });

      tl.to(piezas, {
        x: 0,
        y: 0,
        rotation: 0,
        ease: "power2.inOut",
        stagger: 0.04,
      }, 0)
        .to(".caos__marco", { autoAlpha: 1, scale: 1, duration: 0.4 }, 0.15);

      fases.forEach((fase, indice) => {
        if (indice === 0) return;
        tl.to(fases[indice - 1], { autoAlpha: 0, duration: 0.15 }, 0.22 * indice)
          .to(fase, { autoAlpha: 1, duration: 0.15 }, 0.22 * indice);
      });
    });

    mm.add("(max-width: 63.99rem) and (prefers-reduced-motion: no-preference)", () => {
      gsap.from(piezas, {
        opacity: 0,
        y: 18,
        duration: 0.45,
        stagger: 0.06,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 80%",
          once: true,
        },
      });
    });
  }, { scope: ref });

  return (
    <section className="caos" id="problema" data-logo="light" ref={ref}>
      <div className="caos__escena">
        <div className="caos__intro">
          <p className="caos__fases">
            {caos.fases.map((fase) => (
              <span className="caos__fase" key={fase}>{fase}</span>
            ))}
          </p>
          <h2>{caos.titulo}</h2>
        </div>
        <div className="caos__marco">
          <p className="caos__panel">{caos.panel}</p>
          <ul className="caos__piezas">
            {caos.piezas.map((pieza) => (
              <li className="caos__pieza" key={pieza}>{pieza}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
