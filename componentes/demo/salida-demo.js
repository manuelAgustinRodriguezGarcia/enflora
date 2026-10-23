"use client";

import { useEffect, useState } from "react";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { useDemo } from "@/componentes/demo/proveedor-demo";

const MARCA_GUARDIA = "enfloraDemoGuardia";

let saliendo = false;
let pendiente = false;

function guardiaActiva(estado = window.history.state) {
  return Boolean(estado?.[MARCA_GUARDIA]) && window.location.pathname.startsWith("/demo");
}

function activarGuardia() {
  if (guardiaActiva()) return;
  const actual = window.history.state;
  const base = actual && typeof actual === "object" ? actual : {};
  const url = window.location.pathname.startsWith("/demo")
    ? window.location.href
    : `${window.location.origin}/demo`;
  window.history.pushState({ ...base, __NA: true, [MARCA_GUARDIA]: true }, "", url);
}

export function SalidaDemo() {
  const { reiniciar } = useDemo();
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    saliendo = false;
    activarGuardia();
    if (pendiente) setConfirmando(true);

    function alRetroceder(evento) {
      if (saliendo || evento.state?.[MARCA_GUARDIA]) return;
      evento.stopImmediatePropagation();
      pendiente = true;
      activarGuardia();
      setConfirmando(true);
    }

    window.addEventListener("popstate", alRetroceder, true);
    return () => window.removeEventListener("popstate", alRetroceder, true);
  }, []);

  function cerrar() {
    pendiente = false;
    setConfirmando(false);
  }

  function salir() {
    pendiente = false;
    saliendo = true;
    reiniciar();
    window.location.replace("/");
  }

  return (
    <ModalConfirmacion
      abierto={confirmando}
      onCerrar={cerrar}
      titulo="¿Salir de la demo?"
      descripcion="Vas a perder los datos temporales de esta sesión. Si salís, la demo se reinicia y queda en blanco para volver a probarla."
      textoConfirmar="Salir"
      textoCancelar="Seguir en la demo"
      varianteConfirmar="destructivo"
      onConfirmar={salir}
    />
  );
}
