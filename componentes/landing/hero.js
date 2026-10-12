"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import { textos } from "@/lib/landing";

export function Hero() {
  const ref = useRef(null);
  const { hero } = textos;

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(".hero__marca", { opacity: 0, y: 16, duration: 0.45 })
        .from(".hero__linea", { opacity: 0, y: 28, duration: 0.55, stagger: 0.12 }, 0.12)
        .from(".hero__bajada", { opacity: 0, y: 20, duration: 0.5 }, 0.35)
        .from(".hero__acciones a", { opacity: 0, y: 16, duration: 0.4, stagger: 0.08 }, 0.48)
        .from(".hero__flora", { opacity: 0, y: 36, duration: 0.7 }, 0.3);

      gsap.to(".hero__flora", {
        y: -10,
        duration: 2.8,
        delay: 1.05,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    });

    mm.add("(min-width: 64rem) and (prefers-reduced-motion: no-preference)", () => {
      gsap.to(".hero__flora-eje", {
        y: 36,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    });
  }, { scope: ref });

  return (
    <section className="hero" id="inicio" ref={ref}>
      <div className="hero__mancha hero__mancha--uno" aria-hidden="true" />
      <div className="hero__mancha hero__mancha--dos" aria-hidden="true" />
      <div className="hero__mancha hero__mancha--tres" aria-hidden="true" />
      <div className="hero__contenido">
        <p className="hero__marca">ENFLORA</p>
        <h1>
          {hero.titulo.map((linea) => (
            <span className="hero__linea" key={linea}>{linea}</span>
          ))}
        </h1>
        <p className="hero__bajada">{hero.bajada}</p>
        <div className="hero__acciones">
          <Link className="landing__accion landing__accion--principal" href="/registro">Empezar gratis</Link>
          <a className="landing__accion landing__accion--secundaria" href="#que-es">Conocer ENFLORA</a>
        </div>
      </div>
      <div className="hero__flora-eje">
        <img className="hero__flora" src="/logos/enflora-isotipo-light.svg" alt="Flora" />
      </div>
    </section>
  );
}
