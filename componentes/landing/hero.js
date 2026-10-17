"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import TiltedCard from "@/componentes/landing/tilted-card";
import { TarjetaFlotanteHero } from "@/componentes/landing/tarjeta-flotante-hero";
import { textos } from "@/lib/landing";

export function Hero() {
  const ref = useRef(null);
  const { hero } = textos;

  function irASiguiente(evento) {
    evento.preventDefault();
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const destino = document.getElementById("para-que-sirve");
    if (!destino) return;
    destino.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", "#para-que-sirve");
    }
  }

  useGSAP(() => {
    const seccion = ref.current;
    if (!seccion) return;

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(".hero__marca", { opacity: 0, y: 16, duration: 0.4 })
        .from(".hero__linea", { opacity: 0, y: 28, duration: 0.55, stagger: 0.1 }, 0.08)
        .from(".hero__bajada", { opacity: 0, y: 18, duration: 0.45 }, 0.28)
        .from(".hero__acciones > *", { opacity: 0, y: 14, duration: 0.4, stagger: 0.08 }, 0.4)
        .from(".hero__flora", { opacity: 0, y: 22, scale: 0.97, duration: 0.7 }, 0.4)
        .from(".hero__deco", { opacity: 0, duration: 0.5, stagger: 0.05 }, 0.55);
    });

    mm.add("(min-width: 64rem) and (prefers-reduced-motion: no-preference)", () => {
      if (!seccion.querySelector(".hero__visual")) return;

      gsap.to(".hero__visual", {
        y: 20,
        ease: "none",
        scrollTrigger: {
          trigger: seccion,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    });

    return () => mm.revert();
  }, { scope: ref });

  return (
    <section className="hero" id="inicio" data-logo="dark" ref={ref}>
      <div className="hero__mancha hero__mancha--uno hero__deco" aria-hidden="true" />
      <div className="hero__mancha hero__mancha--dos hero__deco" aria-hidden="true" />

      <div className="hero__pantalla">
        <div className="hero__visual">
          <ul className="hero__beneficios" id="hero-beneficios">
            {hero.beneficios.map((item, indice) => (
              <TarjetaFlotanteHero item={item} indice={indice} key={item.titulo} />
            ))}
          </ul>

          <div className="hero__flora" data-asset="hero-flora">
            <TiltedCard
              className="hero__flora-tilt"
              captionText="Conocé Enflora"
              altText="Flora, la mascota de ENFLORA, tomando sol en una reposera"
              containerWidth="100%"
              containerHeight="100%"
              imageWidth="100%"
              imageHeight="100%"
              rotateAmplitude={9}
              scaleOnHover={1.035}
              glare={0.18}
              glareColor="#f4f8ee"
              shadow={0}
              parallax={0.35}
              radius={0}
              flipOnClick={false}
              showTooltip
              intro={false}
              floating={false}
              gyroscope={false}
              onClick={irASiguiente}
            >
              <Image
                src="/images/flora-landing.png"
                alt=""
                width={1254}
                height={1254}
                priority
                draggable={false}
                sizes="(min-width: 90rem) 34rem, (min-width: 64rem) 32rem, (min-width: 48rem) 26rem, 18rem"
              />
            </TiltedCard>
          </div>
        </div>

        <div className="hero__contenido">
          <p className="hero__marca">{hero.marca}</p>
          <h1>
            <span className="hero__linea hero__linea--oscuro">{hero.titulo[0]}</span>
            <span className="hero__linea hero__linea--claro">{hero.titulo[1]}</span>
          </h1>
          <p className="hero__bajada">{hero.bajada}</p>
          <div className="hero__acciones">
            <Link className="landing__accion landing__accion--principal" href="/registro">
              Registrate hoy
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
