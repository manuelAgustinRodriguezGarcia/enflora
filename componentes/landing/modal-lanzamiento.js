"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Dialog } from "@base-ui/react/dialog";
import { motion, useReducedMotion } from "motion/react";
import { BellRing, CircleAlert, X } from "lucide-react";
import { Boton } from "@/componentes/boton";
import { TextoConMarca } from "@/componentes/marca-enflora";
import { textoLimite, useNotificacionesPush } from "@/componentes/usar-notificaciones-push";
import { transicionRapida, transicionVista } from "@/lib/animaciones";
import { descripcionModalLanzamiento, textosModalLanzamiento as t } from "@/lib/lanzamiento";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.96, y: 14 };

function vistaModal(estado, resultado) {
  if (resultado === "exito") return "exito";
  if (estado === "activado") return "suscripto";
  if (estado === "denegado") return "denegado";
  if (estado === "no-compatible") return "no-compatible";
  if (estado === "requiere-instalacion") return "ios";
  if (estado === "error") return "error";
  if (estado === "limite") return "limite";
  if (resultado === "descartado") return "descartado";
  return "inicial";
}

function Estado({ tono, children }) {
  const Icono = tono === "ok" ? BellRing : CircleAlert;
  return (
    <p
      className={`lanzamiento-modal__estado lanzamiento-modal__estado--${tono}`}
      role={tono === "ok" ? "status" : "alert"}
    >
      <Icono size={20} strokeWidth={2.2} aria-hidden="true" />
      <span>
        <TextoConMarca texto={children} />
      </span>
    </p>
  );
}

export function ModalLanzamiento({ abierto, plan, onCerrar }) {
  const acciones = useRef(null);
  const reducir = useReducedMotion();
  const push = useNotificacionesPush("landing");
  const { recargar } = push;
  const [resultado, setResultado] = useState(null);
  const vista = vistaModal(push.estado, resultado);
  const puedeAvisar = ["inicial", "descartado", "error", "limite"].includes(vista);
  const reintento = vista === "error" || vista === "limite";

  useEffect(() => {
    if (abierto) recargar(true);
  }, [abierto, recargar]);

  function cerrar() {
    setResultado(null);
    onCerrar();
  }

  function cambiar(siguiente, detalles) {
    if (!siguiente) {
      detalles?.preventUnmountOnClose?.();
      cerrar();
    }
  }

  async function avisar() {
    if (push.ocupado || push.estado === "cargando") return;
    const final = await push.activar();
    if (final === "activado") setResultado("exito");
    else if (final === "disponible") setResultado("descartado");
    else setResultado(null);
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiar} actionsRef={acciones}>
      <Dialog.Portal>
        <Dialog.Backdrop
          render={
            <motion.div
              className="modal__fondo lanzamiento-modal__fondo"
              initial={{ opacity: 0 }}
              animate={{ opacity: abierto ? 1 : 0 }}
              transition={reducir ? { duration: 0 } : transicionRapida}
            />
          }
        />
        <Dialog.Viewport className="modal__vista lanzamiento-modal__vista">
          <Dialog.Popup
            render={
              <motion.div
                className="modal__panel lanzamiento-modal"
                initial={reducir ? false : panelCerrado}
                animate={abierto ? panelAbierto : reducir ? { opacity: 0 } : panelCerrado}
                transition={reducir ? { duration: 0 } : { ...transicionVista, duration: 0.28 }}
                onAnimationComplete={() => {
                  if (!abierto) acciones.current?.unmount();
                }}
              />
            }
          >
            <Dialog.Close className="lanzamiento-modal__cerrar" aria-label="Cerrar">
              <X size={20} strokeWidth={2.2} aria-hidden="true" />
            </Dialog.Close>

            <div className="lanzamiento-modal__flora">
              <Image
                src="/images/flora-astronauta.png"
                alt=""
                width={1024}
                height={1024}
                draggable={false}
                sizes="(min-width: 40rem) 13rem, 8rem"
              />
            </div>

            <div className="lanzamiento-modal__cuerpo">
              <div className="lanzamiento-modal__encabezado">
                <Dialog.Title className="lanzamiento-modal__titulo">
                  <TextoConMarca texto={t.titulo} />
                </Dialog.Title>
                <Dialog.Description className="lanzamiento-modal__texto">
                  {descripcionModalLanzamiento(plan)}
                </Dialog.Description>
              </div>

              {puedeAvisar ? (
                <>
                  <p className="lanzamiento-modal__destacado">{t.destacado}</p>
                  <p className="lanzamiento-modal__permisos">
                    <TextoConMarca texto={t.permisos} />
                  </p>
                </>
              ) : null}

              {vista === "exito" ? <Estado tono="ok">{t.exito}</Estado> : null}
              {vista === "suscripto" ? <Estado tono="ok">{t.suscripto}</Estado> : null}
              {vista === "denegado" ? <Estado tono="alerta">{t.denegado}</Estado> : null}
              {vista === "no-compatible" ? <Estado tono="alerta">{t.noCompatible}</Estado> : null}
              {vista === "descartado" ? <Estado tono="alerta">{t.descartado}</Estado> : null}
              {vista === "error" ? <Estado tono="alerta">{t.error}</Estado> : null}
              {vista === "limite" ? <Estado tono="alerta">{textoLimite(push.espera)}</Estado> : null}

              {vista === "ios" ? (
                <div className="lanzamiento-modal__ios" role="status">
                  <p className="lanzamiento-modal__ios-titulo">
                    <TextoConMarca texto={t.iosTitulo} />
                  </p>
                  <ol>
                    {t.iosPasos.map((paso) => (
                      <li key={paso}>
                        <TextoConMarca texto={paso} />
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <div className="lanzamiento-modal__acciones">
                <Boton type="button" variante="ghost" className="lanzamiento-modal__volver" onClick={cerrar}>
                  {t.volver}
                </Boton>
                {puedeAvisar ? (
                  <Boton
                    type="button"
                    className="boton lanzamiento-modal__avisar"
                    onClick={avisar}
                    disabled={push.ocupado || push.estado === "cargando"}
                    aria-busy={push.ocupado || undefined}
                  >
                    <img
                      className="lanzamiento-modal__avisar-isotipo"
                      src="/logos/enflora-isotipo-light.svg"
                      alt=""
                      width={24}
                      height={24}
                    />
                    {reintento ? t.reintentar : t.avisar}
                  </Boton>
                ) : null}
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
