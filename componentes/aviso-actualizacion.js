"use client";

import { useEffect, useState } from "react";
import { Boton } from "@/componentes/boton";

function hayCambiosSinGuardar() {
  if (typeof document === "undefined") return false;
  if (document.querySelector("[data-edicion-activa='true']")) return true;
  const campos = document.querySelectorAll("form input, form textarea, form select");
  for (const campo of campos) {
    if (campo.closest("[data-permite-actualizar]")) continue;
    if (campo.disabled || campo.type === "hidden" || campo.type === "button" || campo.type === "submit") continue;
    if ((campo.type === "checkbox" || campo.type === "radio") && campo.checked !== campo.defaultChecked) return true;
    if ("value" in campo && campo.value !== campo.defaultValue) return true;
  }
  return false;
}

export function AvisoActualizacion() {
  const [lista, setLista] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    let activo = true;

    function marcar(registro) {
      if (!activo || !registro) return;
      if (registro.waiting && navigator.serviceWorker.controller) setLista(true);
      registro.addEventListener("updatefound", () => {
        const nuevo = registro.installing;
        if (!nuevo) return;
        nuevo.addEventListener("statechange", () => {
          if (nuevo.state === "installed" && navigator.serviceWorker.controller) setLista(true);
        });
      });
    }

    navigator.serviceWorker.getRegistration("/").then(marcar).catch(() => {});
    const alControl = () => {
      if (sessionStorage.getItem("enflora-recargar") !== "1") return;
      sessionStorage.removeItem("enflora-recargar");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", alControl);
    return () => {
      activo = false;
      navigator.serviceWorker.removeEventListener("controllerchange", alControl);
    };
  }, []);

  async function actualizar() {
    if (hayCambiosSinGuardar()) {
      setAviso("Guardá o descartá lo que estás escribiendo antes de actualizar.");
      return;
    }
    const registro = await navigator.serviceWorker.getRegistration("/");
    if (!registro?.waiting) return;
    sessionStorage.setItem("enflora-recargar", "1");
    registro.waiting.postMessage({ tipo: "enflora-activar" });
  }

  if (!lista) return null;

  return (
    <div className="aviso-version" role="status" data-permite-actualizar="true">
      <p>Hay una nueva versión de Enflora disponible</p>
      {aviso ? <p className="aviso-version__detalle">{aviso}</p> : null}
      <Boton type="button" onClick={actualizar}>
        Actualizar
      </Boton>
    </div>
  );
}
