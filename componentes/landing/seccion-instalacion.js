"use client";

import { useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import {
  IconoAndroid,
  IconoApple,
} from "@/componentes/landing/ilustraciones-instalacion";
import { ModalInstalacionAndroid } from "@/componentes/landing/modal-instalacion-android";
import { ModalInstalacionIOS } from "@/componentes/landing/modal-instalacion-ios";
import Silk from "@/componentes/landing/silk";
import { toque, transicionToque } from "@/lib/animaciones";
import { usePWAInstall } from "@/lib/use-pwa-install";

function ImagenPerspectiva() {
  const reducir = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const resorte = { stiffness: 160, damping: 18, mass: 0.4 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [11, -11]), resorte);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-14, 14]), resorte);
  const escala = useSpring(1, resorte);

  function mover(evento) {
    if (reducir) return;
    const caja = evento.currentTarget.getBoundingClientRect();
    x.set((evento.clientX - caja.left) / caja.width - 0.5);
    y.set((evento.clientY - caja.top) / caja.height - 0.5);
  }

  function entrar() {
    if (!reducir) escala.set(1.03);
  }

  function salir() {
    x.set(0);
    y.set(0);
    escala.set(1);
  }

  return (
    <div
      className="instalacion__visual"
      data-revelar
      onMouseEnter={entrar}
      onMouseMove={mover}
      onMouseLeave={salir}
    >
      <motion.img
        className="instalacion__imagen"
        src="/images/landing-descargas.png"
        alt="ENFLORA instalada en un Samsung y un iPhone"
        width={720}
        height={720}
        style={
          reducir
            ? undefined
            : {
                rotateX,
                rotateY,
                scale: escala,
                transformPerspective: 920,
              }
        }
      />
    </div>
  );
}

export function SeccionInstalacion({ textos }) {
  const [modal, setModal] = useState(null);
  const [reinicio, setReinicio] = useState(0);
  const pwa = usePWAInstall();

  function abrir(tipo) {
    setReinicio((valor) => valor + 1);
    setModal(tipo);
  }

  return (
    <>
      <section className="instalacion" id="instalar" data-logo="light">
        <div className="instalacion__fondo" aria-hidden="true">
          <Silk
            color="#0B3D2A"
            sheenColor="#A4C85B"
            speed={3.5}
            scale={1}
            rotation={0}
            sheen={0.28}
            depth={0.4}
            glow={0.18}
            noiseIntensity={1.1}
            fade={0}
            mouseInteraction={false}
            clickRipple={false}
            intro
          />
        </div>
        <div className="instalacion__contenedor">
          <ImagenPerspectiva />
          <div className="instalacion__texto" data-revelar>
            <h2>
              <span className="instalacion__marca">Enflora</span> va con vos.
            </h2>
            <p className="instalacion__bajada">{textos.bajada}</p>
            <div className="instalacion__acciones">
              <motion.button
                type="button"
                className="instalacion__btn instalacion__btn--android"
                whileTap={toque}
                transition={transicionToque}
                onClick={() => abrir("android")}
              >
                <IconoAndroid size={18} />
                {textos.botonAndroid}
              </motion.button>
              <motion.button
                type="button"
                className="instalacion__btn instalacion__btn--apple"
                whileTap={toque}
                transition={transicionToque}
                onClick={() => abrir("ios")}
              >
                <IconoApple size={18} />
                {textos.botonApple}
              </motion.button>
            </div>
            <p className="instalacion__nota">{textos.nota}</p>
          </div>
        </div>
      </section>

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
        reinicio={reinicio}
      />
    </>
  );
}
