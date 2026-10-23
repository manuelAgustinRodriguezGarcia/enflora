"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { desplazarASeccion } from "@/componentes/landing/desplazar-seccion";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import GooeyNav from "@/componentes/landing/gooey-nav";
import { navegacionLanding } from "@/lib/landing";
import { NOMBRE_MARCA } from "@/lib/seo";

const ITEMS_GOOEY = navegacionLanding.map((item) => ({
  label: item.etiqueta,
  href: `#${item.id}`,
  id: item.id,
  accent: Boolean(item.acento),
  tono: item.acento,
}));

const COLOR_PILL = "#0B3D2A";

const PILL_BASE = {
  color: COLOR_PILL,
  texto: "#F4F8EE",
  particulas: ["#0B3D2A", "#A4C85B", "#24764F"],
};

const PILLS_ACENTO = {
  dorado: {
    color: "#d4af37",
    texto: COLOR_PILL,
    particulas: ["#d4af37", "#e0bc45", "#c9a227"],
  },
  rosa: {
    color: "#F0B4B4",
    texto: COLOR_PILL,
    particulas: ["#F0B4B4", "#F6CACA", "#E89C9C"],
  },
};

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
    const nodo = ref.current;
    if (!nodo) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(nodo, { opacity: 0, y: -12, duration: 0.4, ease: "power2.out" });
    });

    return () => mm.revert();
  }, { scope: ref });

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
    const medirActivo = () => {
      if (navegandoRef.current) return;

      const scrollY = window.scrollY;
      if (scrollY < 40) {
        setActivo((actual) => (actual === 0 ? actual : 0));
        return;
      }

      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const ultimo = ITEMS_GOOEY.length - 1;
      if (maxScroll > 0 && maxScroll - scrollY <= 140) {
        setActivo((actual) => (actual === ultimo ? actual : ultimo));
        return;
      }

      const header = ref.current;
      const marca = (header?.getBoundingClientRect().height || 64) + 12;
      let mejor = 0;

      ITEMS_GOOEY.forEach((item, indice) => {
        const nodo = document.getElementById(item.id);
        if (!nodo || !nodo.isConnected) return;
        if (nodo.getBoundingClientRect().top <= marca + 48) {
          mejor = indice;
        }
      });

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

  useEffect(() => {
    let vigente = true;
    const alinear = () => {
      if (!vigente) return;
      const id = window.location.hash.slice(1);
      const destino = id ? document.getElementById(id) : null;
      if (!destino) return;
      const offset = (ref.current?.getBoundingClientRect().height || 64) + 12;
      const y = Math.max(0, window.scrollY + destino.getBoundingClientRect().top - offset);
      if (Math.abs(window.scrollY - y) > 2) window.scrollTo({ top: y, behavior: "auto" });
    };
    const observador = new ResizeObserver(alinear);
    const soltar = () => {
      vigente = false;
      observador.disconnect();
    };
    const eventos = ["wheel", "touchstart", "pointerdown", "keydown"];

    observador.observe(document.body);
    eventos.forEach((evento) => window.addEventListener(evento, soltar, { passive: true }));
    const limite = window.setTimeout(soltar, 4000);

    return () => {
      window.clearTimeout(limite);
      observador.disconnect();
      eventos.forEach((evento) => window.removeEventListener(evento, soltar));
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

    let listo = false;
    const liberar = () => {
      if (listo) return;
      listo = true;
      navegandoRef.current = false;
    };

    desplazarASeccion(id, {
      offset,
      suave: !reducido,
      onInicio: () => {
        navegandoRef.current = true;
      },
      onFin: liberar,
    });

    window.setTimeout(liberar, 3200);
  };

  const tema = logoClaro ? "dark" : "light";
  const items = useMemo(() => ITEMS_GOOEY, []);
  const itemActivo = items[activo];
  const pill = PILLS_ACENTO[itemActivo?.tono] ?? PILL_BASE;

  return (
    <header
      className={`encabezado-publico${logoClaro ? " encabezado-publico--logo-claro" : " encabezado-publico--logo-oscuro"}`}
      ref={ref}
    >
      <div className="encabezado-publico__barra">
        <Link className="encabezado-publico__marca" href="#inicio" aria-label={NOMBRE_MARCA}>
          <img
            className="encabezado-publico__logo encabezado-publico__logo--oscuro"
            src="/logos/enflora-logo-apaisado.svg"
            alt=""
            width={1000}
            height={300}
          />
          <img
            className="encabezado-publico__logo encabezado-publico__logo--claro"
            src="/logos/enflora-logo-apaisado-light.svg"
            alt=""
            width={1000}
            height={300}
          />
        </Link>
        <div className="encabezado-publico__nav">
          <GooeyNav
            items={items}
            activeIndex={activo}
            onChange={irA}
            initialActiveIndex={0}
            theme={tema}
            color={pill.color}
            activeTextColor={pill.texto}
            colors={pill.particulas}
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
