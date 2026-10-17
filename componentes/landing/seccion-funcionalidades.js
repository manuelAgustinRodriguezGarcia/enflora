"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { MenuFuncionalidades } from "@/componentes/landing/menu-funcionalidades";
import { PanelFuncionalidad } from "@/componentes/landing/panel-funcionalidad";
import { funcionalidadesLanding } from "@/lib/funcionalidades-landing";

export function SeccionFuncionalidades() {
  const [activoId, setActivoId] = useState(funcionalidadesLanding[0].id);
  const activo = funcionalidadesLanding.find((item) => item.id === activoId) || funcionalidadesLanding[0];
  const panelRef = useRef(null);
  const chipsRef = useRef(null);
  const [alturaMin, setAlturaMin] = useState(0);

  const seleccionar = useCallback((id) => {
    if (id === activoId) return;
    const chips = chipsRef.current;
    const ancla = chips ? chips.getBoundingClientRect().top : null;
    setActivoId(id);
    if (ancla == null) return;
    requestAnimationFrame(() => {
      const siguientes = chipsRef.current;
      if (!siguientes) return;
      const delta = siguientes.getBoundingClientRect().top - ancla;
      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta, left: 0, behavior: "auto" });
      }
    });
  }, [activoId]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const bloque = panel.querySelector(".producto-panel__bloque");
    const alto = bloque?.getBoundingClientRect().height || panel.getBoundingClientRect().height;
    if (alto > 0) {
      setAlturaMin((actual) => (alto > actual ? Math.ceil(alto) : actual));
    }
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

        <PanelFuncionalidad
          ref={panelRef}
          funcionalidad={activo}
          style={alturaMin ? { minHeight: `${alturaMin}px` } : undefined}
        />
      </div>
    </div>
  );
}
