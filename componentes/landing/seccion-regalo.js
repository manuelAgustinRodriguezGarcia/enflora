"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversacionFlora } from "@/componentes/landing/conversacion-flora";
import { TearTicket } from "@/componentes/landing/tear-ticket";
import { textos } from "@/lib/landing";
import { transicionVista } from "@/lib/animaciones";

const CODIGO_PROMO = "FLORA-VIP";
const HREF_REGISTRO = "/registro?campana=pase-gratis";

export function SeccionRegalo() {
  const { regalo } = textos;
  const reducido = useReducedMotion();
  const seccionRef = useRef(null);
  const yaRoto = useRef(false);
  const timerRevelado = useRef(0);
  const timerCopiado = useRef(0);
  const [fase, setFase] = useState("chat");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRevelado.current);
      window.clearTimeout(timerCopiado.current);
    };
  }, []);

  const mostrarTicket = useCallback(() => {
    if (fase !== "chat") return;
    setFase("ticket");
  }, [fase]);

  const revelar = useCallback(() => {
    if (yaRoto.current) return;
    yaRoto.current = true;
    if (reducido) {
      setFase("revelado");
      return;
    }
    setFase("celebrando");
    window.clearTimeout(timerRevelado.current);
    timerRevelado.current = window.setTimeout(() => setFase("revelado"), 700);
  }, [reducido]);

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(CODIGO_PROMO);
      setCopiado(true);
      window.clearTimeout(timerCopiado.current);
      timerCopiado.current = window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  }

  const ticketVisible = fase === "ticket" || fase === "celebrando";
  const oscurecido = fase === "celebrando" || fase === "revelado";

  return (
    <section
      className={[
        "regalo",
        oscurecido ? "regalo--oscuro" : "",
        ticketVisible ? "regalo--con-ticket" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      id="regalo"
      data-logo="light"
      ref={seccionRef}
    >
      <div className="regalo__fondo" aria-hidden="true">
        <Image
          src="/images/flora-landing-patova.png"
          alt=""
          fill
          sizes="100vw"
          className="regalo__fondo-img"
          priority={false}
        />
        <div className="regalo__velo" />
        <div className="regalo__oscuridad" />
      </div>

      <div className="regalo__desktop">
        <AnimatePresence mode="wait">
          {fase !== "revelado" ? (
            <motion.div
              key="entrada"
              className="regalo__entrada"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={transicionVista}
            >
              <div className="regalo__escenario">
                <AnimatePresence mode="wait">
                  {fase === "chat" ? (
                    <motion.div
                      key="chat"
                      className="regalo__chat-wrap"
                      initial={reducido ? false : { opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducido ? { opacity: 0 } : { opacity: 0, y: -12 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <ConversacionFlora onContinuar={mostrarTicket} />
                    </motion.div>
                  ) : null}

                  {ticketVisible ? (
                    <motion.div
                      key="ticket"
                      className="regalo__ticket-wrap"
                      initial={reducido ? { opacity: 1, y: 0 } : { opacity: 0, y: 80 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducido ? { opacity: 0 } : { opacity: 0, y: -28 }}
                      transition={
                        reducido
                          ? { duration: 0.01 }
                          : { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
                      }
                    >
                      <TearTicket
                        orientation="horizontal"
                        width={680}
                        height={310}
                        stubSize={165}
                        radius={18}
                        holes={12}
                        holeSize={7}
                        roughness={1}
                        tearAngle={30}
                        stretch={30}
                        resistance={0.45}
                        rotate={-2}
                        tilt
                        tiltMax={6}
                        parallax={6}
                        recenter
                        background="#F4F8EE"
                        stubBackground="#0B3D2A"
                        color="#0B3D2A"
                        border
                        borderColor="#0B3D2A"
                        borderWidth={1.25}
                        ariaLabel="Romper el ticket de ENFLORA"
                        onTear={revelar}
                        className="regalo__ticket"
                        stub={
                          <div className="regalo-ticket__stub">
                            <strong className="regalo-ticket__stub-accion">ROMPÉ ACÁ</strong>
                          </div>
                        }
                      >
                        <div className="regalo-ticket__cuerpo">
                          <div className="regalo-ticket__tope">
                            <Image
                              src="/logos/enflora-logo-apaisado.svg"
                              alt=""
                              width={280}
                              height={45}
                              unoptimized
                            />
                            <span>ENFLORA - INVITADO ESPECIAL</span>
                          </div>
                          <p className="regalo-ticket__serie">ENTRADA N° 000420</p>
                          <h3 className="regalo-ticket__headline">
                            Rompé este ticket 
                          </h3>
                          <p className="regalo-ticket__sub">
                            Zekiel te habla Flora, te dejo este regalito para que la vaciles con tus cultivos.
                          </p>
                        </div>
                      </TearTicket>
                      {fase === "celebrando" ? (
                        <div className="regalo__festejo" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                      ) : null}
                      {reducido ? (
                        <button type="button" className="regalo__atajo" onClick={revelar}>
                          Revelar mi regalo
                        </button>
                      ) : null}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="revelado"
              className="regalo__revelado"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transicionVista}
            >
              <div className="regalo__revelado-texto">
                <p className="regalo__eyebrow">{regalo.exitoEyebrow}</p>
                <h2 className="regalo__titulo">{regalo.exitoTitulo}</h2>
                <p className="regalo__ayuda">{regalo.exitoBajada}</p>
                <ul className="regalo__beneficios">
                  {regalo.beneficios.map((item) => (
                    <li key={item}>
                      <Check className="regalo__check" size={16} strokeWidth={2.5} aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="regalo__revelado-acciones">
                <button
                  type="button"
                  className="regalo__codigo"
                  onClick={copiarCodigo}
                  aria-label={copiado ? "Pase copiado" : "Copiar pase de entrada"}
                >
                  <span>{copiado ? "Copiado" : "Tu pase de entrada"}</span>
                  <code>{CODIGO_PROMO}</code>
                </button>
              </div>
              <Link className="landing__accion landing__accion--acento regalo__cta" href={HREF_REGISTRO}>
                Crear mi cuenta ya!
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="regalo__mobile" data-variant="mobile" />
    </section>
  );
}
