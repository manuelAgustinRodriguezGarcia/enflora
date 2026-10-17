"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";

export function Revelar({ children, className }) {
  const ref = useRef(null);

  useGSAP(() => {
    const contenedor = ref.current;
    if (!contenedor) return;

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const objetivos = gsap.utils.toArray("[data-revelar]", contenedor);
      if (!objetivos.length) return;

      gsap.from(objetivos, {
        opacity: 0,
        y: 22,
        duration: 0.6,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: {
          trigger: contenedor,
          start: "top 82%",
          once: true,
        },
      });
    });

    return () => mm.revert();
  }, { scope: ref });

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}
