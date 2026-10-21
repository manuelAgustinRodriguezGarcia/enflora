"use client";

import { desplazarASeccion } from "@/componentes/landing/desplazar-seccion";

export function irASeccionExpo(id) {
  if (!document.getElementById(id)) return;
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const encabezado = document.querySelector(".encabezado-publico");
  const offset = (encabezado?.getBoundingClientRect().height || 64) + 12;
  desplazarASeccion(id, { offset, suave: !reducido });
}

export function EnlaceDesplazar({ destino, className, children }) {
  return (
    <a
      className={className}
      href={`#${destino}`}
      onClick={(evento) => {
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
        evento.preventDefault();
        irASeccionExpo(destino);
      }}
    >
      {children}
    </a>
  );
}
