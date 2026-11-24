"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Download } from "lucide-react";
import { ModalInstalacionAndroid } from "@/componentes/landing/modal-instalacion-android";
import { ModalInstalacionIOS } from "@/componentes/landing/modal-instalacion-ios";
import { TextoConMarca } from "@/componentes/marca-enflora";
import { usePWAInstall } from "@/lib/use-pwa-install";

const TEXTO = "Instalá Enflora en tu celular para una mejor experiencia";
const ID_OPCIONES = "aviso-instalacion-opciones";

const BOTONES = [
  {
    tipo: "ios",
    etiqueta: "Instalar en iPhone",
    src: "/images/landing iphone.png",
    ancho: 1086,
    alto: 1448,
  },
  {
    tipo: "android",
    etiqueta: "Instalar en Android",
    src: "/images/landing-samsung.png",
    ancho: 1086,
    alto: 1448,
  },
];

export function AvisoInstalacion() {
  const [modal, setModal] = useState(null);
  const [reinicio, setReinicio] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const pwa = usePWAInstall();
  const visible = pwa.comprobado && !pwa.yaInstalada;

  function abrir(tipo) {
    setReinicio((valor) => valor + 1);
    setModal(tipo);
  }

  if (!pwa.comprobado) return null;
  if (!visible && modal === null) return null;

  return (
    <>
      {visible ? (
        <section
          className={abierto ? "aviso-instalacion aviso-instalacion--abierto" : "aviso-instalacion"}
          aria-label="Instalar Enflora en el celular"
        >
          <button
            type="button"
            className="aviso-instalacion__disparador"
            aria-expanded={abierto}
            aria-controls={ID_OPCIONES}
            onClick={() => setAbierto((valor) => !valor)}
          >
            <Download className="aviso-instalacion__descarga" aria-hidden="true" size={20} strokeWidth={2.25} />
            <span className="aviso-instalacion__texto">
              <TextoConMarca texto={TEXTO} />
            </span>
            <ChevronDown className="aviso-instalacion__chevron" aria-hidden="true" size={20} strokeWidth={2.25} />
          </button>
          <div className="aviso-instalacion__panel" id={ID_OPCIONES}>
            <div className="aviso-instalacion__panel-contenido" inert={abierto ? undefined : true}>
              <div className="aviso-instalacion__acciones">
                {BOTONES.map((boton) => (
                  <button
                    key={boton.tipo}
                    type="button"
                    className="aviso-instalacion__boton"
                    onClick={() => abrir(boton.tipo)}
                  >
                    <span className="aviso-instalacion__foto">
                      <Image
                        src={boton.src}
                        alt=""
                        width={boton.ancho}
                        height={boton.alto}
                        sizes="4.6rem"
                        draggable={false}
                      />
                    </span>
                    <span className="aviso-instalacion__etiqueta">{boton.etiqueta}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <ModalInstalacionAndroid
        abierto={modal === "android"}
        onCerrar={() => setModal(null)}
        pwa={pwa}
        reinicio={reinicio}
      />
      <ModalInstalacionIOS
        abierto={modal === "ios"}
        onCerrar={() => setModal(null)}
        plataforma={pwa.plataforma}
        instalada={pwa.yaInstalada && pwa.plataforma.esIos}
        reinicio={reinicio}
      />
    </>
  );
}
