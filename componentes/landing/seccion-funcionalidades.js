"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MenuFuncionalidades } from "@/componentes/landing/menu-funcionalidades";
import { PanelFuncionalidad } from "@/componentes/landing/panel-funcionalidad";
import { funcionalidadesLanding } from "@/lib/funcionalidades-landing";

export function SeccionFuncionalidades() {
  const [activoId, setActivoId] = useState(funcionalidadesLanding[0].id);
  const chipsRef = useRef(null);
  const activo = funcionalidadesLanding.find((item) => item.id === activoId) || funcionalidadesLanding[0];

  const seleccionar = useCallback((id) => {
    setActivoId(id);
  }, []);

  useEffect(() => {
    const pista = chipsRef.current;
    if (!pista) return;
    const chip = pista.querySelector(`[data-id="${activoId}"]`);
    if (!(chip instanceof HTMLElement)) return;
    const preferReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chip.scrollIntoView({
      behavior: preferReduced ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activoId]);

  return (
    <div className="producto__escena">
      <div className="producto__layout">
        <div className="producto__nav">
          <header className="producto__encabezado">
            <h2>Todas nuestras funcionalidades</h2>
          </header>

          <div className="producto__menu-desktop">
            <MenuFuncionalidades
              items={funcionalidadesLanding}
              activoId={activo.id}
              onSeleccionar={seleccionar}
            />
          </div>

          <div className="producto__menu-mobile" ref={chipsRef}>
            <div className="producto-chips" role="tablist" aria-label="Todas nuestras funcionalidades">
              {funcionalidadesLanding.map((item) => {
                const activoChip = item.id === activo.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    data-id={item.id}
                    className="producto-chips__item"
                    data-activo={activoChip ? "" : undefined}
                    aria-selected={activoChip}
                    onClick={() => seleccionar(item.id)}
                  >
                    {item.menu}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <PanelFuncionalidad funcionalidad={activo} />
      </div>
    </div>
  );
}
