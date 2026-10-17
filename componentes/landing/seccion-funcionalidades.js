"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconoFuncionalidad } from "@/componentes/landing/iconos-funcionalidades";
import { MenuFuncionalidades } from "@/componentes/landing/menu-funcionalidades";
import { PanelFuncionalidad } from "@/componentes/landing/panel-funcionalidad";
import { funcionalidadesLanding } from "@/lib/funcionalidades-landing";

const CONSULTA_MOBILE = "(max-width: 63.99rem)";

function limitesPanel(panel) {
  if (!panel) return { overflow: false, arriba: true, abajo: true };
  const maximo = Math.max(0, panel.scrollHeight - panel.clientHeight);
  return {
    overflow: maximo > 2,
    arriba: panel.scrollTop <= 1,
    abajo: panel.scrollTop >= maximo - 1,
  };
}

function seccionActiva(seccion) {
  const rect = seccion.getBoundingClientRect();
  const alto = window.innerHeight || 1;
  return rect.top <= 64 && rect.bottom >= alto * 0.55;
}

export function SeccionFuncionalidades() {
  const [activoId, setActivoId] = useState(funcionalidadesLanding[0].id);
  const activo = funcionalidadesLanding.find((item) => item.id === activoId) || funcionalidadesLanding[0];
  const panelRef = useRef(null);
  const toqueY = useRef(null);

  const seleccionar = useCallback((id) => {
    setActivoId(id);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (panel) panel.scrollTop = 0;
  }, [activoId]);

  useEffect(() => {
    const seccion = document.getElementById("producto");
    if (!seccion) return undefined;

    const consulta = window.matchMedia(CONSULTA_MOBILE);

    const esMobile = () => consulta.matches;

    const consumir = (delta) => {
      const panel = panelRef.current;
      const { overflow, arriba, abajo } = limitesPanel(panel);
      if (!panel || !overflow || !delta) return false;

      if (delta > 0 && !abajo) {
        panel.scrollTop += delta;
        return true;
      }
      if (delta < 0 && !arriba) {
        panel.scrollTop += delta;
        return true;
      }
      return false;
    };

    const redirigirSiCorresponde = (evento, delta) => {
      if (!esMobile() || !seccionActiva(seccion)) return false;
      if (!consumir(delta)) return false;
      evento.preventDefault();
      return true;
    };

    const onWheel = (evento) => {
      redirigirSiCorresponde(evento, evento.deltaY);
    };

    const onTouchStart = (evento) => {
      if (!esMobile() || !evento.touches[0]) return;
      toqueY.current = evento.touches[0].clientY;
    };

    const onTouchMove = (evento) => {
      if (!esMobile() || toqueY.current == null || !evento.touches[0]) return;
      const actualY = evento.touches[0].clientY;
      const delta = toqueY.current - actualY;
      toqueY.current = actualY;
      redirigirSiCorresponde(evento, delta);
    };

    const onTouchEnd = () => {
      toqueY.current = null;
    };

    const onCambioConsulta = () => {
      toqueY.current = null;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    consulta.addEventListener("change", onCambioConsulta);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      consulta.removeEventListener("change", onCambioConsulta);
    };
  }, []);

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

        <PanelFuncionalidad ref={panelRef} funcionalidad={activo} />

        <div className="producto__menu-mobile">
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
                  <span className="producto-chips__imagen" aria-hidden="true">
                    <IconoFuncionalidad nombre={item.icono} size={28} />
                  </span>
                  <span className="producto-chips__texto">{item.menu}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
