"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";

export function Revelar({ children, className }) {
  const ref = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-revelar]", {
        opacity: 0,
        y: 22,
        duration: 0.6,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 82%",
          once: true,
        },
      });
    });
  }, { scope: ref });

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}
