"use client";

import { useState } from "react";
import Image from "next/image";
import { Boton } from "@/componentes/boton";
import { ContadorLanzamiento, useRestanteLanzamiento } from "@/componentes/landing/contador-lanzamiento";
import { ModalContacto } from "@/componentes/landing/modal-contacto";
import Particles from "@/componentes/landing/particles";
import { textos } from "@/lib/landing";
import { TextoConMarca } from "@/componentes/marca-enflora";

const COLORES_PARTICULAS = ["#fdf1d7", "#ffffff", "#a4c85b"];

export function SeccionLanzamiento() {
  const { lanzamiento } = textos;
  const restante = useRestanteLanzamiento();
  const [contactoAbierto, setContactoAbierto] = useState(false);
  const [contactoMontado, setContactoMontado] = useState(false);

  const listo = restante?.listo ?? false;

  function abrirContacto() {
    setContactoMontado(true);
    setContactoAbierto(true);
  }

  return (
    <section
      className="lanzamiento"
      id="lanzamiento"
      data-logo="light"
      aria-label={lanzamiento.titulo}
    >
      <Particles
        className="lanzamiento__particulas"
        particleColors={COLORES_PARTICULAS}
        particleCount={220}
        particleSpread={10}
        speed={0.1}
        particleBaseSize={90}
        glow={0.5}
        twinkle={0.35}
        alphaParticles
        moveParticlesOnHover
        hoverEffect="parallax"
        particleHoverFactor={0.6}
      />
      <div className="lanzamiento__flora">
        <Image
          src="/images/flora-astronauta.png"
          alt="Flora, la mascota de Enflora, flotando en el espacio vestida de astronauta"
          width={1024}
          height={1024}
          draggable={false}
          sizes="(min-width: 64rem) 38rem, 16rem"
        />
      </div>
      <div className="lanzamiento__contenedor">
        {!listo ? (
          <>
            <h2 className="lanzamiento__titulo">{lanzamiento.titulo}</h2>
            <p className="lanzamiento__faltan">{lanzamiento.faltan}</p>
          </>
        ) : null}

        {listo ? (
          <p className="lanzamiento__disponible" role="status">
            <TextoConMarca texto={lanzamiento.disponible} />
          </p>
        ) : (
          <>
            <p className="lanzamiento__sr">{lanzamiento.descripcionAccesible}</p>
            <ContadorLanzamiento restante={restante} />
          </>
        )}
        <div className="lanzamiento__aviso">
          <Boton type="button" className="lanzamiento__boton" onClick={abrirContacto}>
            Avisame cuando Enflora esté disponible
          </Boton>
        </div>
      </div>
      {contactoMontado ? (
        <ModalContacto abierto={contactoAbierto} onCerrar={() => setContactoAbierto(false)} />
      ) : null}
    </section>
  );
}
