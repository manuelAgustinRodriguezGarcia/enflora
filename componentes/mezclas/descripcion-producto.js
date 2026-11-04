"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function DescripcionProducto({ texto }) {
  const cajaRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [desborda, setDesborda] = useState(false);

  useLayoutEffect(() => {
    const caja = cajaRef.current;
    if (!caja || abierto) return undefined;

    const medir = () => {
      setDesborda(caja.scrollHeight > caja.clientHeight + 2);
    };

    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    return () => observador.disconnect();
  }, [texto, abierto]);

  function abrir() {
    const caja = cajaRef.current;
    if (!caja) return;
    caja.style.setProperty("--alto-abierto", `${caja.scrollHeight}px`);
    setAbierto(true);
  }

  return (
    <p
      ref={cajaRef}
      className={
        abierto
          ? "mezclas__meta mezclas__descripcion mezclas__descripcion--abierta"
          : "mezclas__meta mezclas__descripcion"
      }
    >
      {texto}
      {desborda && !abierto ? (
        <button
          type="button"
          className="mezclas__descripcion-mas"
          onClick={abrir}
          aria-label="Mostrar el resto"
        >
          …
        </button>
      ) : null}
    </p>
  );
}
