"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/boton";

function rutaInterna(valor) {
  if (typeof valor !== "string" || !valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) {
    return "/inicio";
  }
  return valor;
}

export function publicarMensajeInterno(detalle) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("enflora-mensaje-interno", { detail: detalle }));
}

export function MensajeInterno() {
  const router = useRouter();
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    function mostrar(detalle, origen) {
      if (!detalle || typeof detalle.titulo !== "string") return;
      setAviso({
        titulo: detalle.titulo.slice(0, 120),
        mensaje: typeof detalle.mensaje === "string" ? detalle.mensaje.slice(0, 280) : "",
        url: rutaInterna(detalle.url),
        origen,
      });
    }

    function alInterno(evento) {
      mostrar(evento.detail, "interno");
    }

    function alPush(evento) {
      const datos = evento.data;
      if (!datos || datos.tipo !== "enflora-aviso") return;
      mostrar(datos, "push");
    }

    window.addEventListener("enflora-mensaje-interno", alInterno);
    const worker = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    worker?.addEventListener("message", alPush);
    return () => {
      window.removeEventListener("enflora-mensaje-interno", alInterno);
      worker?.removeEventListener("message", alPush);
    };
  }, []);

  if (!aviso) return null;
  const esPush = aviso.origen === "push";

  return (
    <div className="mensaje-interno" role="status" data-permite-actualizar="true">
      <p className="mensaje-interno__tipo">{esPush ? "Notificación en la aplicación" : "Mensaje interno"}</p>
      <p className="mensaje-interno__titulo">{aviso.titulo}</p>
      {aviso.mensaje ? <p className="mensaje-interno__texto">{aviso.mensaje}</p> : null}
      <div className="mensaje-interno__acciones">
        <Boton type="button" onClick={() => router.push(aviso.url)}>
          Abrir
        </Boton>
        <Boton type="button" variante="ghost" onClick={() => setAviso(null)}>
          Cerrar
        </Boton>
      </div>
    </div>
  );
}
