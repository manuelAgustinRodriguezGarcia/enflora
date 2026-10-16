"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { desplazarASeccion } from "@/componentes/landing/desplazar-seccion";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import GooeyNav from "@/componentes/landing/gooey-nav";
import { navegacionLanding } from "@/lib/landing";

const ITEMS_GOOEY = navegacionLanding.map((item) => ({
  label: item.etiqueta,
  href: `#${item.id}`,
  id: item.id,
  accent: Boolean(item.acento),
}));

const COLOR_PILL = "#0B3D2A";
const COLOR_PILL_ACENTO = "#d4af37";
const COLORES_PARTICULAS = ["#0B3D2A", "#A4C85B", "#24764F"];
const COLORES_PARTICULAS_ACENTO = ["#d4af37", "#e0bc45", "#c9a227"];

const SECCIONES_SIN_CTA = new Set(["con-enflora", "regalo"]);

function idSeccionActiva(seccion) {
  if (!seccion) return "";
  return seccion.id || seccion.getAttribute("id") || "";
}

export function EncabezadoPublico() {
  const ref = useRef(null);
  const navegandoRef = useRef(false);
  const [logoClaro, setLogoClaro] = useState(false);
  const [activo, setActivo] = useState(0);
  const [compacto, setCompacto] = useState(false);
  const [mostrarCta, setMostrarCta] = useState(true);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(ref.current, { opacity: 0, y: -12, duration: 0.4, ease: "power2.out" });
    });
  });

  useEffect(() => {
    const consulta = window.matchMedia("(min-width: 64rem) and (max-width: 89.99rem)");
    const actualizar = () => setCompacto(consulta.matches);
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);

  useEffect(() => {
    const secciones = Array.from(document.querySelectorAll("[data-logo]"));
    if (!secciones.length) return undefined;

    const medirBanda = () => {
      const header = ref.current;
      const alto = header ? header.getBoundingClientRect().height : 64;
      const y = Math.max(0, alto * 0.55);
      const x = Math.min(window.innerWidth - 1, Math.max(0, window.innerWidth * 0.5));
      const prev = header?.style.pointerEvents;
      if (header) header.style.pointerEvents = "none";
      const nodo = document.elementFromPoint(x, y);
      if (header) header.style.pointerEvents = prev || "";
      if (!nodo) return;
      const seccion = nodo.closest?.("[data-logo]");
      if (!seccion) return;
      const claro = seccion.getAttribute("data-logo") === "light";
      setLogoClaro((actual) => (actual === claro ? actual : claro));
      const id = idSeccionActiva(seccion);
      const visible = !SECCIONES_SIN_CTA.has(id);
      setMostrarCta((actual) => (actual === visible ? actual : visible));
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        medirBanda();
      });
    };

    medirBanda();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    const observer = new IntersectionObserver(onScroll, {
      root: null,
      threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
      rootMargin: "-8% 0px -70% 0px",
    });
    secciones.forEach((seccion) => observer.observe(seccion));

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const nodos = ITEMS_GOOEY
      .map((item) => document.getElementById(item.id))
      .filter(Boolean);
    if (!nodos.length) return undefined;

    const medirActivo = () => {
      if (navegandoRef.current) return;
      const header = ref.current;
      const marca = (header?.getBoundingClientRect().height || 64) + 12;
      let mejor = 0;
      let mejorDist = Number.POSITIVE_INFINITY;
      nodos.forEach((nodo, indice) => {
        const top = nodo.getBoundingClientRect().top;
        const dist = Math.abs(top - marca);
        if (top <= marca + 48 && dist < mejorDist) {
          mejorDist = dist;
          mejor = indice;
        }
      });
      if (window.scrollY < 40) mejor = 0;
      setActivo((actual) => (actual === mejor ? actual : mejor));
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        medirActivo();
      });
    };

    medirActivo();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const irA = (indice, item) => {
    const id = item?.id || ITEMS_GOOEY[indice]?.id;
    if (!id || !document.getElementById(id)) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const offset = (ref.current?.getBoundingClientRect().height || 64) + 12;

    setActivo(indice);
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", `#${id}`);
    }

    desplazarASeccion(id, {
      offset,
      suave: !reducido,
      onInicio: () => {
        navegandoRef.current = true;
      },
      onFin: () => {
        navegandoRef.current = false;
      },
    });
  };

  const tema = logoClaro ? "dark" : "light";
  const items = useMemo(() => ITEMS_GOOEY, []);
  const itemActivo = items[activo];
  const pillAcento = Boolean(itemActivo?.accent);

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
        <div className="encabezado-publico__nav">
          <GooeyNav
            items={items}
            activeIndex={activo}
            onChange={irA}
            initialActiveIndex={0}
            theme={tema}
            color={pillAcento ? COLOR_PILL_ACENTO : COLOR_PILL}
            activeTextColor={pillAcento ? COLOR_PILL : "#F4F8EE"}
            colors={pillAcento ? COLORES_PARTICULAS_ACENTO : COLORES_PARTICULAS}
            size={compacto ? "sm" : "md"}
            frame
            particleCount={10}
            spread={38}
            animationTime={500}
            timeVariance={180}
            gooeyness={0.45}
            wobble={0.3}
            hoverEffect
            className="encabezado-publico__gooey"
          />
        </div>
        <div
          className={`encabezado-publico__acceso${mostrarCta ? "" : " encabezado-publico__acceso--oculto"}`}
          aria-hidden={mostrarCta ? undefined : true}
        >
          <Link
            className="landing__accion landing__accion--principal"
            href="/registro"
            tabIndex={mostrarCta ? undefined : -1}
          >
            Empezá hoy
          </Link>
        </div>
      </div>
    </header>
  );
}
