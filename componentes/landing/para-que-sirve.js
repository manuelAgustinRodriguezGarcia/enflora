"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import TiltedCard, { TiltedCardLayer } from "@/componentes/landing/tilted-card";
import { textos } from "@/lib/landing";

function suscribirMedia(consulta, alCambiar) {
  const media = window.matchMedia(consulta);
  media.addEventListener("change", alCambiar);
  return () => media.removeEventListener("change", alCambiar);
}

function useEsMovil() {
  return useSyncExternalStore(
    (alCambiar) => suscribirMedia("(max-width: 63.99rem)", alCambiar),
    () => window.matchMedia("(max-width: 63.99rem)").matches,
    () => false,
  );
}

function CaraTarjeta({ tarjeta }) {
  return (
    <div className={`para-que-sirve__tilt-panel para-que-sirve__tilt-panel--ilustrada para-que-sirve__tilt-panel--${tarjeta.id}`}>
      <TiltedCardLayer depth={12} className="para-que-sirve__tilt-foto">
        <Image
          src={tarjeta.imagen}
          alt={tarjeta.alt || tarjeta.titulo}
          width={1254}
          height={1254}
          sizes="(min-width: 64rem) 12rem, 72vw"
          draggable={false}
        />
      </TiltedCardLayer>
      <TiltedCardLayer depth={36} className="para-que-sirve__tilt-foto-texto">
        <h3>{tarjeta.titulo}</h3>
      </TiltedCardLayer>
    </div>
  );
}

function ItemTarjeta({ tarjeta }) {
  return (
    <li className="para-que-sirve__tarjeta">
      <TiltedCard
        className="para-que-sirve__tilt para-que-sirve__tilt--flip"
        altText={tarjeta.titulo}
        containerWidth="100%"
        containerHeight="100%"
        imageWidth="100%"
        imageHeight="100%"
        rotateAmplitude={0}
        scaleOnHover={1}
        glare={0}
        shadow={0}
        parallax={0}
        floating={false}
        intro={false}
        showTooltip={false}
        gyroscope={false}
        trackWindow={false}
        flipOnClick
        backContent={
          <div className="para-que-sirve__tilt-reverso">
            {tarjeta.eyebrow ? (
              <p className="para-que-sirve__tilt-reverso-eyebrow">{tarjeta.eyebrow}</p>
            ) : null}
            <h3>{tarjeta.titulo}</h3>
            <p>{tarjeta.descripcion}</p>
          </div>
        }
        radius={20}
        style={{ "--tc-shadow-color": "rgba(11, 61, 42, 0.18)" }}
      >
        <CaraTarjeta tarjeta={tarjeta} />
      </TiltedCard>
    </li>
  );
}

const UMBRAL_ARRASTRE = 10;

function CarruselTarjetas({ tarjetas }) {
  const viewportRef = useRef(null);
  const pistaRef = useRef(null);
  const arrastreRef = useRef({
    activo: false,
    movio: false,
    capturado: false,
    pointerId: null,
    inicioX: 0,
    inicioY: 0,
    origen: 0,
    x: 0,
    indice: tarjetas.length,
    paso: 0,
    anchoViewport: 0,
    anchoItem: 0,
  });

  const items = useMemo(
    () => [...tarjetas, ...tarjetas, ...tarjetas].map((tarjeta, indice) => ({
      ...tarjeta,
      clave: `${tarjeta.id}-${indice}`,
    })),
    [tarjetas],
  );

  const aplicar = (x, animar) => {
    const pista = pistaRef.current;
    if (!pista) return;
    arrastreRef.current.x = x;
    pista.style.transition = animar
      ? "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    pista.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  const centroDe = (indice) => {
    const { paso, anchoViewport, anchoItem } = arrastreRef.current;
    return anchoViewport / 2 - (indice * paso + anchoItem / 2);
  };

  const normalizarIndice = (indice) => {
    const total = tarjetas.length;
    let siguiente = indice;
    if (siguiente < total) siguiente += total;
    if (siguiente >= total * 2) siguiente -= total;
    return siguiente;
  };

  const soltarCaptura = (pointerId) => {
    const estado = arrastreRef.current;
    if (!estado.capturado) return;
    try {
      viewportRef.current?.releasePointerCapture?.(pointerId);
    } catch {
      undefined;
    }
    estado.capturado = false;
  };

  const medir = () => {
    const viewport = viewportRef.current;
    const pista = pistaRef.current;
    const item = pista?.querySelector(".para-que-sirve__tarjeta");
    if (!viewport || !pista || !item) return;
    const estilos = getComputedStyle(pista);
    const gap = Number.parseFloat(estilos.columnGap || estilos.gap) || 12;
    const anchoItem = item.getBoundingClientRect().width;
    arrastreRef.current.anchoItem = anchoItem;
    arrastreRef.current.paso = anchoItem + gap;
    arrastreRef.current.anchoViewport = viewport.getBoundingClientRect().width;
    arrastreRef.current.indice = normalizarIndice(arrastreRef.current.indice);
    aplicar(centroDe(arrastreRef.current.indice), false);
  };

  useEffect(() => {
    medir();
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const observer = new ResizeObserver(() => medir());
    observer.observe(viewport);
    window.addEventListener("orientationchange", medir);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", medir);
    };
  }, [tarjetas.length]);

  const alBajar = (evento) => {
    if (evento.button != null && evento.button !== 0) return;
    const estado = arrastreRef.current;
    estado.activo = true;
    estado.movio = false;
    estado.capturado = false;
    estado.pointerId = evento.pointerId;
    estado.inicioX = evento.clientX;
    estado.inicioY = evento.clientY;
    estado.origen = estado.x;
  };

  const alMover = (evento) => {
    const estado = arrastreRef.current;
    if (!estado.activo || estado.pointerId !== evento.pointerId) return;
    const deltaX = evento.clientX - estado.inicioX;
    const deltaY = evento.clientY - estado.inicioY;

    if (!estado.movio) {
      if (Math.abs(deltaX) < UMBRAL_ARRASTRE && Math.abs(deltaY) < UMBRAL_ARRASTRE) {
        return;
      }
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        estado.activo = false;
        return;
      }
      estado.movio = true;
      pistaRef.current?.setAttribute("data-dragging", "");
      aplicar(estado.origen, false);
      try {
        viewportRef.current?.setPointerCapture?.(evento.pointerId);
        estado.capturado = true;
      } catch {
        undefined;
      }
    }

    aplicar(estado.origen + deltaX, false);
  };

  const alSoltar = (evento) => {
    const estado = arrastreRef.current;
    if (estado.pointerId !== evento.pointerId) return;
    const fueArrastre = estado.movio;
    estado.activo = false;
    pistaRef.current?.removeAttribute("data-dragging");
    soltarCaptura(evento.pointerId);

    if (!fueArrastre) return;

    const { paso, x, anchoViewport, anchoItem } = estado;
    const pista = pistaRef.current;
    if (!paso || !pista) {
      estado.movio = false;
      return;
    }
    const indiceCrudo = Math.round((anchoViewport / 2 - anchoItem / 2 - x) / paso);
    const indiceClamped = Math.max(0, Math.min(items.length - 1, indiceCrudo));
    const destino = normalizarIndice(indiceClamped);
    estado.indice = destino;
    aplicar(centroDe(indiceClamped), true);

    if (destino !== indiceClamped) {
      const alTerminar = (fin) => {
        if (fin.target !== pista || fin.propertyName !== "transform") return;
        pista.removeEventListener("transitionend", alTerminar);
        aplicar(centroDe(destino), false);
      };
      pista.addEventListener("transitionend", alTerminar);
    }

    window.setTimeout(() => {
      estado.movio = false;
    }, 50);
  };

  return (
    <div
      className="para-que-sirve__carrusel"
      ref={viewportRef}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onClickCapture={(evento) => {
        if (arrastreRef.current.movio) {
          evento.preventDefault();
          evento.stopPropagation();
        }
      }}
    >
      <ul
        className="para-que-sirve__tarjetas para-que-sirve__tarjetas--carrusel"
        ref={pistaRef}
        aria-label="Beneficios de ENFLORA"
      >
        {items.map((tarjeta) => (
          <ItemTarjeta key={tarjeta.clave} tarjeta={tarjeta} />
        ))}
      </ul>
    </div>
  );
}

export function ParaQueSirve() {
  const ref = useRef(null);
  const { queEs } = textos;
  const movil = useEsMovil();

  useGSAP(
    () => {
      gsap.set(".para-que-sirve__flora", { clearProps: "transform" });

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(".para-que-sirve__aura", {
          opacity: 0.72,
          duration: 3.2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });
    },
    { scope: ref },
  );

  return (
    <section className="para-que-sirve" id="para-que-sirve" data-logo="dark" ref={ref}>
      <div className="para-que-sirve__layout">
        <div className="para-que-sirve__visual">
          <div className="para-que-sirve__aura" aria-hidden="true" />
          <Image
            className="para-que-sirve__flora"
            src="/images/flora-landing2.png"
            alt="Flora presentando la app ENFLORA en el celular"
            width={1122}
            height={1272}
            sizes="(min-width: 64rem) 30rem, min(88vw, 22rem)"
            draggable={false}
          />
        </div>

        <div className="para-que-sirve__contenido">
          <p className="para-que-sirve__antetitulo" data-revelar>
            {queEs.antetitulo}
          </p>
          <h2 data-revelar>{queEs.titulo}</h2>
          <p className="para-que-sirve__bajada" data-revelar>
            {queEs.bajada}
          </p>

          {movil ? (
            <CarruselTarjetas tarjetas={queEs.tarjetas} />
          ) : (
            <ul className="para-que-sirve__tarjetas" aria-label="Beneficios de ENFLORA">
              {queEs.tarjetas.map((tarjeta) => (
                <ItemTarjeta key={tarjeta.id} tarjeta={tarjeta} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
