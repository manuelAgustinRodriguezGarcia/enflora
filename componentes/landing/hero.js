"use client";

import { ArrowRight, BarChart3, Leaf, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import { textos } from "@/lib/landing";

const iconos = {
  hoja: Leaf,
  progreso: BarChart3,
  decision: Sparkles,
};

export function Hero() {
  const ref = useRef(null);
  const { hero } = textos;

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(".hero__marca", { opacity: 0, y: 16, duration: 0.4 })
        .from(".hero__linea", { opacity: 0, y: 28, duration: 0.55, stagger: 0.1 }, 0.08)
        .from(".hero__bajada", { opacity: 0, y: 18, duration: 0.45 }, 0.28)
        .from(".hero__acciones > *", { opacity: 0, y: 14, duration: 0.4, stagger: 0.08 }, 0.4)
        .from(".hero__beneficio", { opacity: 0, y: 12, duration: 0.35, stagger: 0.06 }, 0.52)
        .from(".hero__mockup", { opacity: 0, y: 40, duration: 0.65, stagger: 0.1 }, 0.35)
        .from(".hero__flora", { opacity: 0, y: 28, scale: 0.96, duration: 0.6 }, 0.45)
        .from(".hero__deco", { opacity: 0, duration: 0.5, stagger: 0.05 }, 0.6);

      gsap.to(".hero__flora", {
        y: -8,
        duration: 2.8,
        delay: 1.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      gsap.to(".hero__mockup--frente", {
        y: -6,
        duration: 3.2,
        delay: 1.4,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    });

    mm.add("(min-width: 64rem) and (prefers-reduced-motion: no-preference)", () => {
      gsap.to(".hero__visual", {
        y: 28,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    });
  }, { scope: ref });

  return (
    <section className="hero" id="inicio" data-logo="dark" ref={ref}>
      <div className="hero__mancha hero__mancha--uno hero__deco" aria-hidden="true" />
      <div className="hero__mancha hero__mancha--dos hero__deco" aria-hidden="true" />
      <div className="hero__suelo hero__deco" aria-hidden="true" />

      <div className="hero__contenido">
        <p className="hero__marca">{hero.marca}</p>
        <h1>
          <span className="hero__linea hero__linea--oscuro">{hero.titulo[0]}</span>
          <span className="hero__linea hero__linea--claro">{hero.titulo[1]}</span>
        </h1>
        <p className="hero__bajada">{hero.bajada}</p>
        <div className="hero__acciones">
          <Link className="landing__accion landing__accion--principal" href="/registro">
            Empezar gratis
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <a className="landing__accion landing__accion--secundaria" href="#para-que-sirve">
            Descubrir ENFLORA
          </a>
        </div>
        <ul className="hero__beneficios">
          {hero.beneficios.map((item) => {
            const Icono = iconos[item.icono];
            return (
              <li className="hero__beneficio" key={item.texto}>
                <span className={`hero__beneficio-icono hero__beneficio-icono--${item.icono}`}>
                  <Icono size={24} strokeWidth={2.1} aria-hidden="true" />
                </span>
                <span>{item.texto}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="hero__visual">
        <div className="hero__mockup hero__mockup--fondo" data-asset="hero-phone-list" aria-hidden="true">
          <div className="hero__phone">
            <p className="hero__phone-kicker">Mi cultivo</p>
            <div className="hero__phone-chips">
              <span>Todas</span>
              <span>Vegetativo</span>
            </div>
            <div className="hero__phone-fila" />
            <div className="hero__phone-fila" />
            <div className="hero__phone-fila" />
          </div>
        </div>
        <div className="hero__mockup hero__mockup--frente" data-asset="hero-phone-dashboard" aria-hidden="true">
          <div className="hero__phone">
            <p className="hero__phone-kicker">Hola</p>
            <strong>Tu cultivo</strong>
            <div className="hero__phone-card">
              <span>Planta 3</span>
              <small>Día 18 · Vegetativo</small>
            </div>
            <div className="hero__phone-stats">
              <span>18d</span>
              <span>12cm</span>
              <span>68%</span>
            </div>
          </div>
        </div>
        <div className="hero__flora" data-asset="hero-flora">
          <img src="/logos/enflora-isotipo-dark-green.svg" alt="Flora" />
        </div>
      </div>
    </section>
  );
}
