"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatearFecha } from "@/lib/etapas";
import { diaArgentina } from "@/lib/historial-registros";

// Visor ampliado. Muestra primero la miniatura (ya cargada) y pide la foto grande firmada
// solo para la imagen abierta, así la lista nunca descarga originales.
export function VisorFotos({ fotos = [], indice = null, onCambiar, onCerrar, obtenerUrl }) {
  const abierto = indice !== null && fotos[indice] !== undefined;
  const foto = abierto ? fotos[indice] : null;
  // Resultados por id de foto: se derivan en el render, sin setState sincrónico dentro del efecto.
  const [resultados, setResultados] = useState({});
  const pedidas = useRef(new Set());
  const idFoto = foto?.id || "";

  useEffect(() => {
    if (!idFoto || !obtenerUrl || pedidas.current.has(idFoto)) return;
    pedidas.current.add(idFoto);
    obtenerUrl(idFoto)
      .then((respuesta) => {
        setResultados((previo) => ({
          ...previo,
          [idFoto]: respuesta.error || !respuesta.url ? { error: true } : { url: respuesta.url },
        }));
      })
      .catch(() => {
        setResultados((previo) => ({ ...previo, [idFoto]: { error: true } }));
      });
  }, [idFoto, obtenerUrl]);

  const resultado = resultados[idFoto];
  const grande = { id: idFoto, url: resultado?.url || "" };
  const error = resultado?.error ? "No se pudo cargar la foto en tamaño completo." : "";

  if (!abierto) return null;

  const dia = foto.fecha_evento ? diaArgentina(foto.fecha_evento) : "";
  const url = grande.id === foto.id && grande.url ? grande.url : foto.url_miniatura;
  const hayVarias = fotos.length > 1;

  return (
    <Dialog.Root open onOpenChange={(siguiente) => !siguiente && onCerrar?.()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="visor-fotos__fondo" />
        <Dialog.Viewport className="visor-fotos__vista">
          <Dialog.Popup className="visor-fotos__panel">
            <Dialog.Title className="visor-fotos__titulo">
              {dia ? formatearFecha(dia) : "Foto"}
            </Dialog.Title>
            <Dialog.Description className="visor-fotos__descripcion">
              {foto.compartida
                ? `Foto compartida del registro (${foto.cantidad_plantas} plantas).`
                : foto.aplica_a === "ambiente"
                  ? "Foto del ambiente de la unidad."
                  : "Foto del registro."}
            </Dialog.Description>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="visor-fotos__imagen" src={url} alt="Foto del cultivo" decoding="async" />
            {error ? <p className="visor-fotos__error">{error}</p> : null}
            <div className="visor-fotos__barra">
              {hayVarias ? (
                <button
                  type="button"
                  className="visor-fotos__boton"
                  onClick={() => onCambiar?.((indice - 1 + fotos.length) % fotos.length)}
                  aria-label="Foto anterior"
                >
                  <ChevronLeft strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
              {foto.registro_id ? (
                <Link className="visor-fotos__enlace" href={`/registros?editar=${foto.registro_id}`}>
                  Ver registro de origen
                </Link>
              ) : null}
              {hayVarias ? (
                <button
                  type="button"
                  className="visor-fotos__boton"
                  onClick={() => onCambiar?.((indice + 1) % fotos.length)}
                  aria-label="Foto siguiente"
                >
                  <ChevronRight strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <Dialog.Close className="visor-fotos__cerrar" aria-label="Cerrar">
              <X strokeWidth={2} aria-hidden="true" />
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
