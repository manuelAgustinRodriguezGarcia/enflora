"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";

export function PantallaCorreoValidado() {
  return (
    <section className="exito">
      <div className="exito__marca">
        <img src="/enflora-logo.svg" alt="Enflora" />
        <h1>Enflora</h1>
      </div>
      <CircleCheck className="exito__check" size={88} strokeWidth={1.75} aria-hidden="true" />
      <div className="exito__mensaje">
        <p>El mail se validó con éxito</p>
        <Link className="exito__accion" href="/entrar">
          Iniciar Sesión
        </Link>
      </div>
    </section>
  );
}
