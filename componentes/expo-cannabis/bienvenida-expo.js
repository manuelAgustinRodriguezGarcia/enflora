"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { irASeccionExpo } from "@/componentes/expo-cannabis/enlace-desplazar";
import { RuletaVitrina } from "@/componentes/expo-cannabis/entrada-expo";
import { useExpo } from "@/componentes/expo-cannabis/proveedor-expo";
import { ESTADOS_EXPO, expoCannabis } from "@/lib/expo-cannabis/configuracion";

const CLAVE_SESION = "enflora-expo-bienvenida";
const { bienvenida: configuracion, textos, ids } = expoCannabis;
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
  const irAlCerrar = useRef(false);
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

  const participar = () => {
    irAlCerrar.current = true;
    setAbierto(false);
  };

  const alTerminar = (abiertoAhora) => {
    if (abiertoAhora || !irAlCerrar.current) return;
    irAlCerrar.current = false;
    irASeccionExpo(ids.desafio);
  };

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto} onOpenChangeComplete={alTerminar}>
      <Dialog.Portal>
        <Dialog.Backdrop className="expo-bienvenida__fondo" />
        <Dialog.Viewport className="expo-bienvenida__vista">
          <Dialog.Popup className="expo-bienvenida" aria-modal="true">
            <Dialog.Close className="expo-bienvenida__cerrar" aria-label={texto.cerrar}>
              <X size={20} strokeWidth={2.4} aria-hidden="true" />
            </Dialog.Close>
            <div className="expo-bienvenida__arte">
              <RuletaVitrina etiqueta={textos.desafio.etiquetaRuleta} />
            </div>
            <div className="expo-bienvenida__contenido">
              <Dialog.Title className="expo-bienvenida__titulo">{texto.titulo}</Dialog.Title>
              <Dialog.Description className="expo-bienvenida__texto">{texto.descripcion}</Dialog.Description>
              <div className="expo-bienvenida__acciones">
                <a
                  className="landing__accion landing__accion--principal expo-bienvenida__cta"
                  href={`#${ids.desafio}`}
                  onClick={(evento) => {
                    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
                    evento.preventDefault();
                    participar();
                  }}
                >
                  {texto.cta}
                  <ArrowUpRight size={18} strokeWidth={2.4} aria-hidden="true" />
                </a>
                <Dialog.Close className="expo-bienvenida__descartar">{texto.descartar}</Dialog.Close>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
