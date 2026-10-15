"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { TearTicket } from "@/componentes/landing/tear-ticket";
import { textos } from "@/lib/landing";
import { transicionVista } from "@/lib/animaciones";

const CODIGO_DEMO = "ENFLORA-DEMO-NO-VALIDO";
const HREF_REGISTRO = "/registro?campana=pase-gratis-demo";

export function SeccionRegalo() {
  const { regalo } = textos;
  const reducido = useReducedMotion();
  const yaRoto = useRef(false);
  const timerRevelado = useRef(0);
  const timerCopiado = useRef(0);
  const [fase, setFase] = useState("ticket");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRevelado.current);
      window.clearTimeout(timerCopiado.current);
    };
  }, []);

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

  return (
    <section className="regalo" id="regalo" data-logo="light">
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
              <p className="regalo__eyebrow">{regalo.eyebrow}</p>
              <h2 className="regalo__titulo">{regalo.titulo}</h2>
              <p className="regalo__bajada">{regalo.bajada}</p>
              <div className="regalo__escenario">
                <TearTicket
                  orientation="horizontal"
                  width={620}
                  height={280}
                  stubSize={150}
                  radius={16}
                  holes={12}
                  holeSize={6}
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
                  stubBackground="#A4C85B"
                  color="#0B3D2A"
                  border
                  borderColor="#5C402D"
                  borderWidth={1.25}
                  ariaLabel="Romper el ticket de ENFLORA"
                  onTear={revelar}
                  className="regalo__ticket"
                  stub={
                    <div className="regalo-ticket__stub">
                      <span className="regalo-ticket__stub-marca">ENFLORA</span>
                      <strong className="regalo-ticket__stub-accion">ROMPÉ ACÁ</strong>
                      <span className="regalo-ticket__stub-hint" aria-hidden="true">
                        ← deslizá
                      </span>
                    </div>
                  }
                >
                  <div className="regalo-ticket__cuerpo">
                    <div className="regalo-ticket__tope">
                      <Image
                        src="/logos/enflora-logo-apaisado.svg"
                        alt=""
                        width={140}
                        height={22}
                        unoptimized
                      />
                      <span>ENFLORA — EDICIÓN ESPECIAL</span>
                    </div>
                    <p className="regalo-ticket__serie">Nº DEMO · 000421</p>
                    <h3 className="regalo-ticket__headline">TU PASE GRATIS</h3>
                    <p className="regalo-ticket__sub">Un regalo para tu próximo cultivo.</p>
                    <div className="regalo-ticket__perfo" aria-hidden="true" />
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
              </div>
              {reducido ? (
                <button type="button" className="regalo__atajo" onClick={revelar}>
                  Revelar mi regalo
                </button>
              ) : (
                <p className="regalo__ayuda">Arrastrá el extremo verde o usá Enter sobre el stub.</p>
              )}
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
