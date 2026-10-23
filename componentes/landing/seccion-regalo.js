"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversacionFlora } from "@/componentes/landing/conversacion-flora";
import { TearTicket } from "@/componentes/landing/tear-ticket";
import { textos } from "@/lib/landing";
import { MarcaEnflora, TextoConMarca } from "@/componentes/marca-enflora";
import { transicionVista } from "@/lib/animaciones";

const HREF_REGISTRO = "/registro";
const CONSULTA_DESKTOP = "(min-width: 64rem)";
const FONDO_DESKTOP = "/images/flora-landing-patova.png";
const FONDO_MOBILE_CHAT = "/images/flora-register-mobile.png";
const FONDO_MOBILE_ENTRADA = "/images/flora-login-mobile.png";

export function SeccionRegalo() {
  const { regalo } = textos;
  const reducido = useReducedMotion();
  const seccionRef = useRef(null);
  const yaRoto = useRef(false);
  const yaEntrada = useRef(false);
  const timerRevelado = useRef(0);
  const [fase, setFase] = useState("chat");
  const [chatActivo, setChatActivo] = useState(false);
  const [avisoChat, setAvisoChat] = useState(false);
  const [esDesktop, setEsDesktop] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_DESKTOP);
    const actualizar = () => setEsDesktop(consulta.matches);
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRevelado.current);
    };
  }, []);

  useEffect(() => {
    const seccion = seccionRef.current;
    if (!seccion || yaEntrada.current) return undefined;

    if (reducido) {
      yaEntrada.current = true;
      setChatActivo(true);
      return undefined;
    }

    const umbral = window.matchMedia(CONSULTA_DESKTOP).matches ? 0.28 : 0.18;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting || yaEntrada.current) return;
        yaEntrada.current = true;
        observador.disconnect();
        setChatActivo(true);
        setAvisoChat(true);
      },
      { threshold: umbral, rootMargin: "0px 0px -8% 0px" },
    );

    observador.observe(seccion);
    return () => observador.disconnect();
  }, [reducido]);

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

  const ticketVisible = fase === "ticket" || fase === "celebrando";
  const oscurecido = fase === "celebrando" || fase === "revelado";
  const entradaConseguida = fase !== "chat";
  const fondoMobile = entradaConseguida ? FONDO_MOBILE_ENTRADA : FONDO_MOBILE_CHAT;

  return (
    <section
      className={[
        "regalo",
        oscurecido ? "regalo--oscuro" : "",
        ticketVisible ? "regalo--con-ticket" : "",
        entradaConseguida ? "regalo--entrada" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      id="regalo"
      data-logo="light"
      ref={seccionRef}
    >
      <div className="regalo__fondo" aria-hidden="true">
        <Image
          src={FONDO_DESKTOP}
          alt=""
          fill
          sizes="100vw"
          className="regalo__fondo-img regalo__fondo-img--desktop"
          priority={false}
        />
        <Image
          src={fondoMobile}
          alt=""
          fill
          sizes="100vw"
          className="regalo__fondo-img regalo__fondo-img--mobile"
          priority={false}
        />
        <div className="regalo__velo" />
        <div className="regalo__oscuridad" />
      </div>

      <div className="regalo__contenido">
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
                      className="regalo__fase-chat"
                      initial={reducido ? false : { opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducido ? { opacity: 0 } : { opacity: 0, y: -12 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <header className="regalo__pista">
                        <Star
                          className="regalo__pista-icono"
                          size={22}
                          strokeWidth={1.75}
                          fill="#d4af37"
                          aria-hidden="true"
                        />
                        <div className="regalo__pista-texto">
                          <h2 className="regalo__pista-titulo">{regalo.pistaTitulo}</h2>
                          <p className="regalo__pista-bajada">{regalo.pistaBajada}</p>
                        </div>
                      </header>
                      <div className="regalo__chat-wrap">
                        <ConversacionFlora
                          onContinuar={mostrarTicket}
                          activo={chatActivo}
                          className={avisoChat ? "flora-chat--aviso" : ""}
                          onAnimationEnd={(evento) => {
                            if (evento.animationName === "flora-chat-aviso") {
                              setAvisoChat(false);
                            }
                          }}
                        />
                      </div>
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
                        orientation={esDesktop ? "horizontal" : "vertical"}
                        width={esDesktop ? 680 : 268}
                        height={esDesktop ? 310 : 460}
                        stubSize={esDesktop ? 165 : 76}
                        radius={esDesktop ? 18 : 14}
                        holes={esDesktop ? 12 : 9}
                        holeSize={esDesktop ? 7 : 5}
                        roughness={1}
                        tearAngle={30}
                        stretch={esDesktop ? 30 : 22}
                        resistance={0.45}
                        rotate={esDesktop ? -2 : 0}
                        tilt={esDesktop}
                        tiltMax={6}
                        parallax={esDesktop ? 6 : 0}
                        recenter
                        background="#F4F8EE"
                        stubBackground="#0B3D2A"
                        color="#0B3D2A"
                        border
                        borderColor="#0B3D2A"
                        borderWidth={1.25}
                        ariaLabel="Romper el ticket de Enflora"
                        onTear={revelar}
                        className={`regalo__ticket${esDesktop ? "" : " regalo__ticket--vertical"}`}
                        stub={
                          <div className="regalo-ticket__stub">
                            <div className="regalo-ticket__stub-fila">
                              <ChevronDown
                                className="regalo-ticket__stub-flecha"
                                size={20}
                                strokeWidth={2.5}
                                aria-hidden="true"
                              />
                              <strong className="regalo-ticket__stub-accion">ROMPÉ ACÁ</strong>
                              <ChevronDown
                                className="regalo-ticket__stub-flecha"
                                size={20}
                                strokeWidth={2.5}
                                aria-hidden="true"
                              />
                            </div>
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
                            <span>
                              <MarcaEnflora /> - INVITADO ESPECIAL
                            </span>
                          </div>
                          <p className="regalo-ticket__serie">ENTRADA N° 000420</p>
                          <h3 className="regalo-ticket__headline">Rompé este ticket</h3>
                          <p className="regalo-ticket__sub">
                            Zekieeeel te habla Flora, te dejo este regalito para que la vaciles con tus
                            cultivos. Un abrazo.
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
                      <span>
                        <TextoConMarca texto={item} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link className="landing__accion landing__accion--acento regalo__cta" href={HREF_REGISTRO}>
                Crear mi cuenta ya!
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
