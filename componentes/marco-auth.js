"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const imagenesFlora = {
  entrar: "/images/login-mobile.png",
  registro: "/images/register-mobile.png",
};

function esMobileAuth() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
}

function panelMinPx() {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return 26 * rem;
}

export function MarcoAuth({ fondo, children }) {
  const imagen = imagenesFlora[fondo] || imagenesFlora.entrar;
  const esRegistro = fondo === "registro";
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const contenidoRef = useRef(null);
  const alturaRef = useRef(null);
  const drag = useRef(null);
  const [altura, setAltura] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);

  const aplicarAltura = useCallback((valor) => {
    alturaRef.current = valor;
    setAltura(valor);
  }, []);

  const limites = useCallback(() => {
    const root = rootRef.current;
    const min = panelMinPx();
    if (!root) return { min, max: min };
    return { min, max: Math.max(min, root.clientHeight) };
  }, []);

  const alturaActual = useCallback(() => {
    if (alturaRef.current != null) return alturaRef.current;
    const panel = panelRef.current;
    return panel ? panel.getBoundingClientRect().height : panelMinPx();
  }, []);

  const ajustar = useCallback(
    (delta) => {
      const { min, max } = limites();
      const actual = alturaActual();
      const siguiente = Math.min(max, Math.max(min, actual + delta));
      if (siguiente === actual) return false;
      aplicarAltura(siguiente);
      return true;
    },
    [alturaActual, aplicarAltura, limites],
  );

  useEffect(() => {
    if (!esRegistro) return undefined;
    const onResize = () => {
      const { min, max } = limites();
      const actual = alturaRef.current;
      if (actual == null) return;
      aplicarAltura(Math.min(max, Math.max(min, actual)));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [aplicarAltura, esRegistro, limites]);

  useEffect(() => {
    if (!esRegistro) return undefined;
    const panel = panelRef.current;
    const contenido = contenidoRef.current;
    if (!panel || !contenido) return undefined;

    const onWheel = (e) => {
      if (!esMobileAuth()) return;
      const { min, max } = limites();
      const h = alturaActual();
      const arriba = contenido.scrollTop <= 0;

      if (e.deltaY > 0 && h < max) {
        e.preventDefault();
        ajustar(e.deltaY);
        return;
      }

      if (e.deltaY < 0 && arriba && h > min) {
        e.preventDefault();
        ajustar(e.deltaY);
      }
    };

    panel.addEventListener("wheel", onWheel, { passive: false });
    return () => panel.removeEventListener("wheel", onWheel);
  }, [ajustar, alturaActual, esRegistro, limites]);

  const liberar = useCallback(() => {
    const sesion = drag.current;
    if (!sesion) return;
    drag.current = null;
    setArrastrando(false);
    try {
      sesion.objetivo.releasePointerCapture(sesion.id);
    } catch {
      /* ignore */
    }
    const { min, max } = limites();
    const valor = alturaRef.current ?? min;
    const medio = min + (max - min) * 0.4;
    aplicarAltura(valor >= medio ? max : min);
    if (valor < medio && contenidoRef.current) contenidoRef.current.scrollTop = 0;
  }, [aplicarAltura, limites]);

  const onPointerDown = (e) => {
    if (!esRegistro || !esMobileAuth() || e.button !== 0) return;
    if (e.target.closest("input, textarea, button, a, select, label")) return;
    const contenido = contenidoRef.current;
    const { min, max } = limites();
    const h = alturaActual();
    if (contenido && contenido.scrollTop > 0 && h >= max - 1) return;

    drag.current = {
      id: e.pointerId,
      y0: e.clientY,
      h0: h,
      min,
      max,
      objetivo: e.currentTarget,
    };
    setArrastrando(true);
    aplicarAltura(h);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const sesion = drag.current;
    if (!sesion || sesion.id !== e.pointerId) return;
    e.preventDefault();
    const dy = sesion.y0 - e.clientY;
    const siguiente = Math.min(sesion.max, Math.max(sesion.min, sesion.h0 + dy));
    aplicarAltura(siguiente);
  };

  const onPointerUp = (e) => {
    const sesion = drag.current;
    if (!sesion || sesion.id !== e.pointerId) return;
    liberar();
  };

  useEffect(() => {
    if (!esRegistro || !arrastrando) return undefined;
    const onLost = () => liberar();
    window.addEventListener("blur", onLost);
    return () => window.removeEventListener("blur", onLost);
  }, [arrastrando, esRegistro, liberar]);

  const expandido =
    esRegistro &&
    altura != null &&
    rootRef.current != null &&
    altura >= rootRef.current.clientHeight - 1;

  const estiloPanel =
    esRegistro && altura != null ? { ["--auth-panel-h"]: `${altura}px` } : undefined;

  return (
    <div className={`marco-auth marco-auth--${fondo}`} ref={rootRef}>
      <div className="marco-auth__flora" aria-hidden="true">
        <img src={imagen} alt="" />
      </div>
      <div
        className="marco-auth__panel"
        ref={panelRef}
        style={estiloPanel}
        data-arrastre={arrastrando ? "" : undefined}
        data-expandido={expandido ? "" : undefined}
        onPointerDown={esRegistro ? onPointerDown : undefined}
        onPointerMove={esRegistro ? onPointerMove : undefined}
        onPointerUp={esRegistro ? onPointerUp : undefined}
        onPointerCancel={esRegistro ? onPointerUp : undefined}
      >
        {esRegistro ? (
          <div
            className="marco-auth__asa"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Deslizá para ampliar el formulario"
          />
        ) : null}
        <div className="marco-auth__contenido" ref={contenidoRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
