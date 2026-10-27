"use client";

import { useEffect, useState } from "react";
import { useRestanteLanzamiento } from "@/componentes/landing/contador-lanzamiento";
import { desplazarASeccion } from "@/componentes/landing/desplazar-seccion";
import { CuerpoPillLanzamiento } from "@/componentes/landing/pill-lanzamiento";
import { textos } from "@/lib/landing";

export function PillLanzamientoFlotante() {
  const [oculto, setOculto] = useState(true);
  const restante = useRestanteLanzamiento();
  const { lanzamiento } = textos;

  useEffect(() => {
    const inicio = document.getElementById("inicio");
    const siguiente = document.getElementById("para-que-sirve");
    const seccionLanzamiento = document.getElementById("lanzamiento");
    let raf = 0;

    const medir = () => {
      raf = 0;
      const alto = window.innerHeight || 1;
      const enPrimera = siguiente
        ? siguiente.getBoundingClientRect().top >= alto * 0.72
        : inicio
          ? inicio.getBoundingClientRect().bottom > alto * 0.92
          : window.scrollY < alto * 0.28;
      const cajaLanzamiento = seccionLanzamiento?.getBoundingClientRect();
      const enLanzamiento = cajaLanzamiento
        ? cajaLanzamiento.top < alto * 0.62 && cajaLanzamiento.bottom > alto * 0.38
        : false;
      const siguienteOculto = enPrimera || enLanzamiento;
      setOculto((actual) => (actual === siguienteOculto ? actual : siguienteOculto));
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  function irALanzamiento(evento) {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
    evento.preventDefault();
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    desplazarASeccion("lanzamiento", { suave: !reducido });
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", "#lanzamiento");
    }
  }

  return (
    <a
      className={`pill-lanzamiento pill-lanzamiento-flotante${oculto ? " pill-lanzamiento-flotante--oculto" : ""}`}
      href="#lanzamiento"
      aria-label={`${lanzamiento.titulo}. Ir a la cuenta regresiva.`}
      aria-hidden={oculto || undefined}
      tabIndex={oculto ? -1 : 0}
      onClick={irALanzamiento}
    >
      <CuerpoPillLanzamiento restante={restante} />
    </a>
  );
}
