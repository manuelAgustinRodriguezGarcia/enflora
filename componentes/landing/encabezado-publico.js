"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import { navegacionLanding } from "@/lib/landing";

export function EncabezadoPublico() {
  const ref = useRef(null);
  const [logoClaro, setLogoClaro] = useState(false);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(ref.current, { opacity: 0, y: -12, duration: 0.4, ease: "power2.out" });
    });
  });

  useEffect(() => {
    const secciones = Array.from(document.querySelectorAll("[data-logo]"));
    if (!secciones.length) return undefined;

    const visibles = new Map();

    const actualizar = () => {
      let elegida = null;
      let maxRatio = 0;
      visibles.forEach((ratio, nodo) => {
        if (ratio >= maxRatio) {
          maxRatio = ratio;
          elegida = nodo;
        }
      });
      if (!elegida) return;
      setLogoClaro(elegida.getAttribute("data-logo") === "light");
    };

    const observer = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            visibles.set(entrada.target, entrada.intersectionRatio);
          } else {
            visibles.delete(entrada.target);
          }
        });
        actualizar();
      },
      {
        rootMargin: "-12% 0px -55% 0px",
        threshold: [0.08, 0.2, 0.35, 0.5, 0.7],
      },
    );

    secciones.forEach((seccion) => observer.observe(seccion));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`encabezado-publico${logoClaro ? " encabezado-publico--logo-claro" : " encabezado-publico--logo-oscuro"}`}
      ref={ref}
    >
      <div className="encabezado-publico__barra">
        <Link className="encabezado-publico__marca" href="#inicio" aria-label="ENFLORA">
          <img
            className="encabezado-publico__logo encabezado-publico__logo--oscuro"
            src="/logos/enflora-logo-apaisado.svg"
            alt=""
          />
          <img
            className="encabezado-publico__logo encabezado-publico__logo--claro"
            src="/logos/enflora-logo-apaisado-light.svg"
            alt=""
          />
        </Link>
        <nav className="encabezado-publico__nav" aria-label="Secciones">
          {navegacionLanding.map((item) => (
            <a href={`#${item.id}`} key={item.id}>{item.etiqueta}</a>
          ))}
        </nav>
        <div className="encabezado-publico__acceso">
          <Link className="landing__accion landing__accion--principal" href="/registro">
            Empezar gratis
          </Link>
        </div>
      </div>
    </header>
  );
}
