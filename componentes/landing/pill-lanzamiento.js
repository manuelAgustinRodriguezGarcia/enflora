"use client";

import Image from "next/image";
import { ContadorLanzamiento } from "@/componentes/landing/contador-lanzamiento";
import { textos } from "@/lib/landing";

export function CuerpoPillLanzamiento({ restante, conTitulo = true }) {
  const { lanzamiento } = textos;

  return (
    <>
      <span className="pill-lanzamiento__marco">
        <Image
          className="pill-lanzamiento__flora"
          src="/images/flora-astronauta.png"
          alt=""
          width={1254}
          height={1254}
          draggable={false}
          sizes="(min-width: 64rem) 240px, 36px"
          aria-hidden="true"
        />
      </span>
      <span className="pill-lanzamiento__cuerpo">
        {conTitulo ? <span className="pill-lanzamiento__titulo">{lanzamiento.titulo}</span> : null}
        {restante?.listo ? (
          <span className="pill-lanzamiento__listo">{lanzamiento.disponible}</span>
        ) : (
          <ContadorLanzamiento restante={restante} compacto />
        )}
      </span>
    </>
  );
}
