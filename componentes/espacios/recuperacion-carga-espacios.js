"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Boton } from "@/componentes/boton";
import { recargarListadoEspacios } from "@/app/espacios/acciones";

const AUTO_REINTENTO_MS = 400;

function mensajeParaUsuario(tipo) {
  switch (tipo) {
    case "red":
    case "timeout":
    case "servidor":
      return "No pudimos cargar tus espacios por un problema de conexión. Probá de nuevo.";
    case "autorizacion":
    case "sin_sesion":
      return "Tu sesión no está disponible. Volvé a iniciar sesión.";
    case "rls":
      return "No tenés permiso para ver estos espacios con la sesión actual.";
    default:
      return "No se pudieron cargar los espacios. Probá de nuevo.";
  }
}

export function RecuperacionCargaEspacios({ diagnosticoInicial = null }) {
  const router = useRouter();
  const [estado, setEstado] = useState("auto");
  const [mensaje, setMensaje] = useState(
    mensajeParaUsuario(diagnosticoInicial?.tipo || "interno"),
  );
  const intentoAutoRef = useRef(false);
  const ocupadoRef = useRef(false);

  const reintentar = useCallback(async () => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setEstado("cargando");
    setMensaje("Volviendo a cargar tus espacios…");

    try {
      const resultado = await recargarListadoEspacios();
      if (resultado.ok) {
        router.refresh();
        return;
      }
      setMensaje(mensajeParaUsuario(resultado.clasificado?.tipo || "interno"));
      setEstado("error");
    } catch {
      setMensaje("No pudimos conectar. Revisá tu internet e intentá otra vez.");
      setEstado("error");
    } finally {
      ocupadoRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (intentoAutoRef.current) return;
    intentoAutoRef.current = true;
    const timer = setTimeout(() => {
      reintentar();
    }, AUTO_REINTENTO_MS);
    return () => clearTimeout(timer);
  }, [reintentar]);

  return (
    <div className="espacios-carga-error" role="alert">
      <p>{mensaje}</p>
      {estado === "cargando" ? (
        <p className="espacios-carga-error__meta" aria-live="polite">
          Reintentando…
        </p>
      ) : (
        <Boton type="button" variante="secundario" onClick={reintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}
