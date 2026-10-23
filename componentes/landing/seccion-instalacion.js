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
import { toque, transicionToque } from "@/lib/animaciones";
import { usePWAInstall } from "@/lib/use-pwa-install";

function ImagenPerspectiva({
  className,
  src,
  alt,
  width,
  height,
  onActivar,
  onDesactivar,
  onSeleccionar,
}) {
  const reducir = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const resorte = { stiffness: 160, damping: 18, mass: 0.4 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [11, -11]), resorte);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-14, 14]), resorte);
  const escala = useSpring(1, resorte);

  function mover(evento) {
    if (reducir || evento.pointerType !== "mouse") return;
    const caja = evento.currentTarget.getBoundingClientRect();
    x.set((evento.clientX - caja.left) / caja.width - 0.5);
    y.set((evento.clientY - caja.top) / caja.height - 0.5);
  }

  function entrar(evento) {
    if (evento.pointerType !== "mouse") return;
    if (!reducir) escala.set(1.03);
    onActivar();
  }

  function salir() {
    x.set(0);
    y.set(0);
    escala.set(1);
    onDesactivar();
  }

  return (
    <motion.div
      className={className}
      whileTap={toque}
      transition={transicionToque}
      onClick={onSeleccionar}
      onPointerEnter={entrar}
      onPointerMove={mover}
      onPointerLeave={salir}
    >
      <motion.img
        className="instalacion__imagen"
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
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
    </motion.div>
  );
}

export function SeccionInstalacion({ textos }) {
  const [modal, setModal] = useState(null);
  const [reinicio, setReinicio] = useState(0);
  const [resaltado, setResaltado] = useState(null);
  const pwa = usePWAInstall();

  function claseBoton(tipo) {
    const base = `instalacion__btn instalacion__btn--${tipo === "ios" ? "apple" : "android"}`;
    return resaltado === tipo ? `${base} instalacion__btn--resaltado` : base;
  }

  function abrir(tipo) {
    setReinicio((valor) => valor + 1);
    setModal(tipo);
  }

  return (
    <>
      <section className="instalacion" id="instalar" data-logo="dark">
        <div className="instalacion__contenedor">
          <div className="instalacion__encabezado" data-revelar>
            <h2>
              <span className="instalacion__marca marca-enflora">Enflora</span> va con vos.
            </h2>
            <p className="instalacion__bajada">{textos.bajada}</p>
          </div>
          <div className="instalacion__visual" data-revelar>
            <ImagenPerspectiva
              className="instalacion__telefono instalacion__telefono--android"
              src="/images/landing-samsung.png"
              alt="Enflora instalada en un Samsung"
              width={1086}
              height={1448}
              onActivar={() => setResaltado("android")}
              onDesactivar={() => setResaltado(null)}
              onSeleccionar={() => abrir("android")}
            />
            <ImagenPerspectiva
              className="instalacion__telefono instalacion__telefono--ios"
              src="/images/landing%20iphone.png"
              alt="Enflora instalada en un iPhone"
              width={1086}
              height={1448}
              onActivar={() => setResaltado("ios")}
              onDesactivar={() => setResaltado(null)}
              onSeleccionar={() => abrir("ios")}
            />
          </div>
          <div className="instalacion__descarga" data-revelar>
            <div className="instalacion__acciones">
              <motion.button
                type="button"
                className={claseBoton("android")}
                whileTap={toque}
                transition={transicionToque}
                onClick={() => abrir("android")}
              >
                <IconoAndroid size={18} />
                {textos.botonAndroid}
              </motion.button>
              <motion.button
                type="button"
                className={claseBoton("ios")}
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
