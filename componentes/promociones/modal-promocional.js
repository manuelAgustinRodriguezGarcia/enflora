"use client";

import { useEffect, useRef, useState } from "react";
import { EnlaceBoton } from "@/componentes/boton";
import { medirCampana } from "@/componentes/enlace-banner";
import { VistaPreviaPromocion } from "@/componentes/promociones/vista-previa-promocion";
import { registrarMarcaPromocion } from "@/app/inicio/acciones-promocion";
import { DESTINO_PLUS, ESPERA_MODAL_MS, destinoPromocion } from "@/lib/promociones";

export function ModalPromocional({ promocion, esperaMs = ESPERA_MODAL_MS }) {
  const [abierto, setAbierto] = useState(false);
  const medido = useRef(false);
  const destino = promocion
    ? destinoPromocion(promocion.enlace || (promocion.esUpsellPlus ? DESTINO_PLUS : ""), { interno: promocion.tipo === "interna" })
    : null;

  useEffect(() => {
    if (!promocion?.campanaId) return undefined;
    const id = window.setTimeout(() => setAbierto(true), esperaMs);
    return () => window.clearTimeout(id);
  }, [promocion, esperaMs]);

  useEffect(() => {
    if (!abierto || medido.current || !promocion?.campanaId) return;
    medido.current = true;
    medirCampana(promocion.campanaId, "impresion");
    registrarMarcaPromocion(promocion.campanaId, "impresion").catch(() => {});
  }, [abierto, promocion]);

  if (!promocion || !abierto) return null;

  function cerrar() {
    setAbierto(false);
    registrarMarcaPromocion(promocion.campanaId, "cierre").catch(() => {});
  }

  return (
    <div className="promo-modal" role="dialog" aria-modal="false" aria-label={promocion.titulo || "Promoción"}>
      <VistaPreviaPromocion campana={promocion} mostrarCta={false} />
      <div className="promo-modal__acciones">
        {destino ? (
          <EnlaceBoton
            href={destino}
            variante="principal"
            target={destino.startsWith("/") ? undefined : "_blank"}
            rel={destino.startsWith("/") ? undefined : "noopener noreferrer sponsored"}
            onClick={() => medirCampana(promocion.campanaId, "clic")}
          >
            {promocion.cta || "Ver"}
          </EnlaceBoton>
        ) : null}
        <button className="boton boton--secundario" type="button" onClick={cerrar}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
