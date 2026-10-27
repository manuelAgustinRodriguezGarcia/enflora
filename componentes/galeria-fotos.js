"use client";

import { useState } from "react";
import { urlFotoOriginal } from "@/app/registros/acciones";
import { VisorFotos } from "@/componentes/visor-fotos";
import { formatearFecha } from "@/lib/etapas";
import { diaArgentina } from "@/lib/historial-registros";

// Galería de miniaturas con visor. Las miniaturas se cargan de forma diferida (lazy)
// y la foto grande se pide solo al abrirla.
export function GaleriaFotos({ fotos = [], titulo = "Fotos", vacio = "Todavía no hay fotos." }) {
  const [abierta, setAbierta] = useState(null);

  return (
    <section className="galeria-fotos" aria-label={titulo}>
      <h2 className="galeria-fotos__titulo">{titulo}</h2>
      {fotos.length === 0 ? (
        <p className="galeria-fotos__vacio">{vacio}</p>
      ) : (
        <ul className="galeria-fotos__grilla">
          {fotos.map((foto, indice) => {
            const dia = diaArgentina(foto.fecha_evento);
            return (
              <li key={foto.id}>
                <button
                  type="button"
                  className="galeria-fotos__foto"
                  onClick={() => setAbierta(indice)}
                  aria-label={`Ver foto del ${dia ? formatearFecha(dia) : "registro"}`}
                >
                  {foto.url_miniatura ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto.url_miniatura} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="galeria-fotos__sin-imagen">Sin vista previa</span>
                  )}
                  <span className="galeria-fotos__fecha">{dia ? formatearFecha(dia) : ""}</span>
                  {foto.compartida ? (
                    <span className="galeria-fotos__etiqueta">Registro compartido</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <VisorFotos
        fotos={fotos}
        obtenerUrl={urlFotoOriginal}
        indice={abierta}
        onCambiar={setAbierta}
        onCerrar={() => setAbierta(null)}
      />
    </section>
  );
}
