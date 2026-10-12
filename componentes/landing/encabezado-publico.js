"use client";

import Link from "next/link";
import { useRef } from "react";
import { ScrollTrigger, useGSAP } from "@/componentes/landing/gsap";

export function EncabezadoPublico() {
  const ref = useRef(null);

  useGSAP(() => {
    ScrollTrigger.create({
      start: 12,
      end: "max",
      onToggle: (self) => {
        ref.current?.classList.toggle("encabezado-publico--solido", self.isActive);
      },
    });
  }, { scope: ref });

  return (
    <header className="encabezado-publico" ref={ref}>
      <div className="encabezado-publico__barra">
        <Link className="encabezado-publico__marca" href="/" aria-label="ENFLORA">
          <img className="encabezado-publico__logo encabezado-publico__logo--claro" src="/logos/enflora-logo-apaisado-light.svg" alt="" />
          <img className="encabezado-publico__logo encabezado-publico__logo--oscuro" src="/logos/enflora-logo-apaisado.svg" alt="" />
        </Link>
        <nav className="encabezado-publico__nav" aria-label="Secciones">
          <a href="#que-es">Qué es</a>
          <a href="#beneficios">Beneficios</a>
          <a href="#planes">Planes</a>
        </nav>
        <div className="encabezado-publico__acceso">
          <Link href="/ingreso">Ingresar</Link>
          <Link className="landing__accion landing__accion--principal" href="/registro">Crear cuenta</Link>
        </div>
      </div>
    </header>
  );
}
