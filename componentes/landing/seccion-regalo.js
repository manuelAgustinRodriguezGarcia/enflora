"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { ConversacionFlora } from "@/componentes/landing/conversacion-flora";
import { gsap, ScrollTrigger, useGSAP } from "@/componentes/landing/gsap";
import { TearTicket } from "@/componentes/landing/tear-ticket";
import { textos } from "@/lib/landing";
import { transicionVista } from "@/lib/animaciones";

const CODIGO_DEMO = "ENFLORA-DEMO-NO-VALIDO";
const HREF_REGISTRO = "/registro?campana=pase-gratis-demo";

function Estrella({ className }) {
  return (
    <svg className={className} viewBox="0 0 12 12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 0.6l1.35 3.55 3.8.2-2.95 2.4.95 3.7L6 8.55 2.85 10.45l.95-3.7L.85 4.35l3.8-.2z"
      />
    </svg>
  );
}

function OrnamentoHoja() {
  return (
    <div className="regalo-ticket__ornamento" aria-hidden="true">
      <span className="regalo-ticket__ornamento-linea" />
      <svg className="regalo-ticket__hoja" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2.2c4.2 1.4 6.8 5.2 6.2 9.4-2.6-.2-5.4-1.6-7.2-4.1C7.2 10 4.4 11.4 1.8 11.6 1.2 7.4 3.8 3.6 10 2.2Z"
          fill="currentColor"
        />
        <path
          d="M10 2.4c0 5.2-1.4 8.6-4.2 11"
          stroke="#0B3D2A"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.35"
        />
      </svg>
      <span className="regalo-ticket__ornamento-linea" />
    </div>
  );
}

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

  useGSAP(
    () => {
      const seccion = seccionRef.current;
      if (!seccion || reducido) return undefined;

      const desktop = window.matchMedia("(min-width: 64rem)");
      if (!desktop.matches) return undefined;

      let consumido = false;
      let animando = false;
      let tween = null;
      const CERCA = 0.22;

      const yDestino = () => Math.max(0, window.scrollY + seccion.getBoundingClientRect().top);

      const estaCerca = () => {
        const top = seccion.getBoundingClientRect().top;
        return top > 4 && top < window.innerHeight * CERCA;
      };

      const frenar = () => {
        if (animando || consumido || !estaCerca()) return;
        animando = true;
        consumido = true;
        const desde = window.scrollY;
        const hasta = yDestino();
        if (Math.abs(hasta - desde) < 2) {
          animando = false;
          return;
        }
        tween?.kill();
        const proxy = { y: desde };
        tween = gsap.to(proxy, {
          y: hasta,
          duration: 0.4,
          ease: "power2.out",
          overwrite: true,
          onUpdate: () => {
            window.scrollTo(0, proxy.y);
          },
          onComplete: () => {
            animando = false;
            tween = null;
            ScrollTrigger.update();
          },
        });
      };

      const onWheel = (evento) => {
        if (!desktop.matches) return;
        if (animando) {
          evento.preventDefault();
          return;
        }

        const rect = seccion.getBoundingClientRect();
        const vh = window.innerHeight;

        if (evento.deltaY < 0 && rect.top > vh * 0.35) {
          consumido = false;
          return;
        }

        if (evento.deltaY <= 0 || consumido) return;

        if (estaCerca()) {
          evento.preventDefault();
          frenar();
        }
      };

      const trigger = ScrollTrigger.create({
        trigger: seccion,
        start: "top 22%",
        end: "bottom top",
        onEnter: (self) => {
          if (self.direction === 1) frenar();
        },
        onLeaveBack: () => {
          consumido = false;
        },
      });

      window.addEventListener("wheel", onWheel, { passive: false });

      return () => {
        tween?.kill();
        trigger.kill();
        window.removeEventListener("wheel", onWheel);
      };
    },
    { scope: seccionRef, dependencies: [reducido] },
  );

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
      await navigator.clipboard.writeText(CODIGO_DEMO);
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
      className={`regalo${oscurecido ? " regalo--oscuro" : ""}`}
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
                            <Estrella className="regalo-ticket__stub-estrella regalo-ticket__stub-estrella--a" />
                            <span className="regalo-ticket__stub-marca">ENFLORA</span>
                            <strong className="regalo-ticket__stub-accion">ROMPÉ ACÁ</strong>
                            <span className="regalo-ticket__stub-hint" aria-hidden="true">
                              ← deslizá
                            </span>
                            <Estrella className="regalo-ticket__stub-estrella regalo-ticket__stub-estrella--b" />
                          </div>
                        }
                      >
                        <div className="regalo-ticket__cuerpo">
                          <Estrella className="regalo-ticket__estrella regalo-ticket__estrella--1" />
                          <Estrella className="regalo-ticket__estrella regalo-ticket__estrella--2" />
                          <Estrella className="regalo-ticket__estrella regalo-ticket__estrella--3" />
                          <div className="regalo-ticket__tope">
                            <Image
                              src="/logos/enflora-logo-apaisado.svg"
                              alt=""
                              width={170}
                              height={27}
                              unoptimized
                            />
                            <span>ENFLORA — EDICIÓN ESPECIAL</span>
                          </div>
                          <p className="regalo-ticket__serie">N° DEMO · 000421</p>
                          <h3 className="regalo-ticket__headline">TU PASE GRATIS</h3>
                          <p className="regalo-ticket__sub">Un regalo para tu próximo cultivo.</p>
                          <OrnamentoHoja />
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
                <p className="regalo__bajada">{regalo.exitoBajada}</p>
                <ul className="regalo__beneficios">
                  {regalo.beneficios.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="regalo__codigo">
                  <div className="regalo__codigo-info">
                    <span>Código de demostración</span>
                    <code>{CODIGO_DEMO}</code>
                    <p>No es un código válido. Sirve solo para probar la interfaz.</p>
                  </div>
                  <button type="button" className="regalo__copiar" onClick={copiarCodigo}>
                    {copiado ? <Check size={18} strokeWidth={2.25} /> : <Copy size={18} strokeWidth={2.25} />}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <Link className="landing__accion landing__accion--acento" href={HREF_REGISTRO}>
                  Registrarme y activar mi regalo
                </Link>
              </div>
              <div className="regalo__flora" data-asset="flora-regalo">
                <Image
                  src="/logos/enflora-isotipo-light.svg"
                  alt="Flora"
                  width={180}
                  height={180}
                  unoptimized
                />
                <p>Flora celebra tu regalo</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="regalo__mobile" data-variant="mobile" />
    </section>
  );
}
