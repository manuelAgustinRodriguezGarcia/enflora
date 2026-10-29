"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";

export function MarcaEncabezado({ alt, confirmarSalida }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  function alClick(evento) {
    if (!confirmarSalida) return;
    evento.preventDefault();
    setAbierto(true);
  }

  function confirmar() {
    setAbierto(false);
    router.push("/");
  }

  return (
    <>
      <Link className="encabezado__marca" href="/" onClick={alClick} aria-label={alt}>
        <img
          className="encabezado__logo encabezado__logo--oscuro"
          src="/logos/enflora-logo-apaisado.svg"
          alt=""
          width={1000}
          height={300}
        />
        <img
          className="encabezado__logo encabezado__logo--claro"
          src="/logos/enflora-logo-apaisado-light.svg"
          alt=""
          width={1000}
          height={300}
        />
      </Link>
      {confirmarSalida ? (
        <ModalConfirmacion
          abierto={abierto}
          onCerrar={() => setAbierto(false)}
          titulo="¿Salir de la app?"
          descripcion="Vas a volver a la página de inicio."
          textoConfirmar="Salir"
          onConfirmar={confirmar}
        />
      ) : null}
    </>
  );
}
