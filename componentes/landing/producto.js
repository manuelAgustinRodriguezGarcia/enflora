"use client";

import { textos } from "@/lib/landing";

export function Producto() {
  const { producto } = textos;

  return (
    <section className="producto" id="producto" data-logo="dark">
      <div className="producto__escena">
        <div className="producto__texto">
          <h2>{producto.titulo}</h2>
          <p>{producto.bajada}</p>
        </div>
      </div>
    </section>
  );
}
