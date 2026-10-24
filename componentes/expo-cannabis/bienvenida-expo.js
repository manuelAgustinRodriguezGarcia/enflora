"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconoInstagram } from "@/componentes/iconos-ui";
import { RuletaVitrina } from "@/componentes/expo-cannabis/entrada-expo";
import { useExpo } from "@/componentes/expo-cannabis/proveedor-expo";
import { ESTADOS_EXPO, expoCannabis } from "@/lib/expo-cannabis/configuracion";

const CLAVE_SESION = "enflora-expo-bienvenida";
const { bienvenida: configuracion, textos } = expoCannabis;
const texto = textos.bienvenida;

function yaSeMostro() {
  if (!configuracion.unaVezPorSesion) return false;
  try {
    return window.sessionStorage.getItem(CLAVE_SESION) === "1";
  } catch {
    return false;
  }
}

function recordarMostrada() {
  if (!configuracion.unaVezPorSesion) return;
  try {
    window.sessionStorage.setItem(CLAVE_SESION, "1");
  } catch {
    return;
  }
}

export function BienvenidaExpo() {
  const { estado, listo } = useExpo();
  const [abierto, setAbierto] = useState(false);
  const disponible =
    expoCannabis.publicada && configuracion.visible && estado !== ESTADOS_EXPO.finalizado;

  useEffect(() => {
    if (!listo || !disponible || yaSeMostro()) return undefined;

    const temporizador = window.setTimeout(() => {
      recordarMostrada();
      setAbierto(true);
    }, configuracion.retrasoMs);
    return () => window.clearTimeout(temporizador);
  }, [listo, disponible]);

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Portal>
        <Dialog.Backdrop className="expo-bienvenida__fondo" />
        <Dialog.Viewport className="expo-bienvenida__vista">
          <Dialog.Popup className="expo-bienvenida" aria-modal="true">
            <Dialog.Close className="expo-bienvenida__cerrar" aria-label={texto.cerrar}>
              <X size={20} strokeWidth={2.4} aria-hidden="true" />
            </Dialog.Close>
            <div className="expo-bienvenida__arte">
              <div className="expo-bienvenida__escena">
                <RuletaVitrina etiqueta={textos.desafio.etiquetaRuleta} />
                <img
                  className="expo-bienvenida__flora"
                  src="/images/flora-ruleta.png"
                  alt="Flora"
                  width={1254}
                  height={1254}
                />
              </div>
            </div>
            <div className="expo-bienvenida__contenido">
              <Dialog.Title className="expo-bienvenida__titulo">{texto.titulo}</Dialog.Title>
              <Dialog.Description className="expo-bienvenida__texto">{texto.descripcion}</Dialog.Description>
              <div className="expo-bienvenida__acciones">
                <Link
                  className="landing__accion landing__accion--principal expo-bienvenida__cta"
                  href={`${expoCannabis.rutaJuego}?bienvenida=1`}
                >
                  {texto.cta}
                  <ArrowUpRight size={18} strokeWidth={2.4} aria-hidden="true" />
                </Link>
                <a
                  className="seguinos-pill expo-bienvenida__seguinos"
                  href={expoCannabis.urlInstagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Seguinos
                  <IconoInstagram className="seguinos-pill__icono" />
                </a>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
