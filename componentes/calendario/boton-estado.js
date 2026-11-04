"use client";

import { useActionState } from "react";

export function BotonEstado({ action, etiqueta, children, className = "boton boton--ghost" }) {
  const [estado, accion, pendiente] = useActionState(action, null);

  return (
    <form action={accion} className="calendario__form-estado">
      {children}
      <button type="submit" className={className} disabled={pendiente}>
        {etiqueta}
      </button>
      {estado?.error ? (
        <p className="formulario__error" role="alert">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
