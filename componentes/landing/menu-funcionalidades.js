"use client";

import { ArrowRight } from "lucide-react";
import { IconoFuncionalidad } from "@/componentes/landing/iconos-funcionalidades";

export function MenuFuncionalidades({ items, activoId, onSeleccionar }) {
  return (
    <nav className="producto-menu" aria-label="Todas nuestras funcionalidades">
      <ul className="producto-menu__lista" role="list">
        {items.map((item) => {
          const activo = item.id === activoId;
          return (
            <li key={item.id}>
              <button
                type="button"
                className="producto-menu__boton"
                data-activo={activo ? "" : undefined}
                aria-current={activo ? "true" : undefined}
                onClick={() => onSeleccionar(item.id)}
              >
                <span className="producto-menu__icono">
                  <IconoFuncionalidad nombre={item.icono} size={18} />
                </span>
                <span className="producto-menu__label">{item.menu}</span>
                <ArrowRight className="producto-menu__flecha" size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
