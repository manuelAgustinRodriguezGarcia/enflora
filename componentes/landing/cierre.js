"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import { textos } from "@/lib/landing";
import { NOMBRE_MARCA } from "@/lib/seo";

export function Cierre() {
  const ref = useRef(null);
  const { cierre } = textos;

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-cierre]", {
        opacity: 0,
        y: 20,
        duration: 0.55,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 75%",
          once: true,
        },
      });
    });
  }, { scope: ref });

  return (
    <section className="cierre" data-logo="light" ref={ref}>
      <img data-cierre src="/logos/enflora-isotipo-light.svg" alt={NOMBRE_MARCA} />
      <h2 data-cierre>
        {cierre.titulo.map((linea) => (
          <span key={linea}>{linea}</span>
        ))}
      </h2>
      <Link data-cierre className="landing__accion landing__accion--acento" href="/registro">Empezar gratis</Link>
    </section>
  );
}
