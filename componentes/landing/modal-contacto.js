"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { Dialog } from "@base-ui/react/dialog";
import { motion, useReducedMotion } from "motion/react";
import { CircleAlert, PartyPopper, Rocket, X } from "lucide-react";
import { Boton } from "@/componentes/boton";
import { TextoConMarca } from "@/componentes/marca-enflora";
import { transicionRapida, transicionVista } from "@/lib/animaciones";
import { enviarContacto } from "@/lib/contactos/cliente";
import { MENSAJES_CONTACTOS, normalizarEmail, normalizarNombre } from "@/lib/contactos/reglas";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.96, y: 14 };

export const textosModalContacto = {
  titulo: "Houston, despegamos el 1/11.",
  descripcion:
    "Estamos preparando todo para nuestro lanzamiento. Dejanos tu mail y te avisamos cuando la nave esté por despegar.",
  nombre: "Nombre",
  nombreAyuda: "Opcional",
  correo: "Correo electrónico",
  correoAyuda: "Obligatorio",
  volver: "Volver",
  enviar: "Avísenme",
  enviando: "Guardando...",
  reintentar: "Reintentar",
  exitoTitulo: "¡Ya sos parte de la lista!",
  exitoTexto: "Gracias por sumarte a Enflora. ¡Nos vemos el 1/11!",
};

function validarFormulario(nombre, email) {
  const errores = {};
  if (normalizarNombre(nombre) === undefined) errores.nombre = MENSAJES_CONTACTOS.nombre;
  const correo = normalizarEmail(email);
  if (correo === null) errores.email = MENSAJES_CONTACTOS.emailObligatorio;
  else if (correo === undefined) errores.email = MENSAJES_CONTACTOS.email;
  return errores;
}

export function ModalContacto({ abierto, onCerrar }) {
  const acciones = useRef(null);
  const reducir = useReducedMotion();
  const idBase = useId();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [errores, setErrores] = useState({});
  const [estado, setEstado] = useState("inicial");
  const [errorGeneral, setErrorGeneral] = useState("");

  function cerrar() {
    onCerrar();
    setErrores({});
    setErrorGeneral("");
    if (estado === "exito") {
      setNombre("");
      setEmail("");
      setEmpresa("");
      setEstado("inicial");
    }
  }

  function cambiar(siguiente, detalles) {
    if (!siguiente) {
      detalles?.preventUnmountOnClose?.();
      cerrar();
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (estado === "enviando") return;
    const detectados = validarFormulario(nombre, email);
    setErrores(detectados);
    setErrorGeneral("");
    if (Object.keys(detectados).length) return;

    setEstado("enviando");
    const resultado = await enviarContacto({
      origen: "landing",
      nombre,
      email,
      consentimiento: false,
      empresa,
    });
    if (resultado.ok) {
      setEstado("exito");
      return;
    }
    setEstado("error");
    if (resultado.campo && ["nombre", "email"].includes(resultado.campo)) {
      setErrores({ [resultado.campo]: resultado.error });
    } else {
      setErrorGeneral(resultado.error);
    }
  }

  const enviando = estado === "enviando";
  const exito = estado === "exito";
  const t = textosModalContacto;

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
                className="modal__panel lanzamiento-modal contacto-modal"
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
              {exito ? (
                <div className="lanzamiento-modal__encabezado">
                  <Dialog.Title className="lanzamiento-modal__titulo">{t.exitoTitulo}</Dialog.Title>
                  <Dialog.Description className="lanzamiento-modal__texto">
                    <TextoConMarca texto={t.exitoTexto} />
                  </Dialog.Description>
                  <p className="lanzamiento-modal__estado lanzamiento-modal__estado--ok" role="status">
                    <PartyPopper size={20} strokeWidth={2.2} aria-hidden="true" />
                    <span>
                      {normalizarNombre(nombre) ? `Gracias, ${normalizarNombre(nombre)}. ` : ""}
                      Guardamos tu correo para contarte las novedades del lanzamiento.
                    </span>
                  </p>
                  <div className="lanzamiento-modal__acciones">
                    <Boton type="button" variante="ghost" className="lanzamiento-modal__volver" onClick={cerrar}>
                      {t.volver}
                    </Boton>
                  </div>
                </div>
              ) : (
                <form className="contacto-modal__formulario" onSubmit={enviar} noValidate>
                  <div className="lanzamiento-modal__encabezado">
                    <Dialog.Title className="lanzamiento-modal__titulo">
                      <TextoConMarca texto={t.titulo} />
                    </Dialog.Title>
                    <Dialog.Description className="lanzamiento-modal__texto">
                      <TextoConMarca texto={t.descripcion} />
                    </Dialog.Description>
                  </div>

                  <div className="contacto-modal__campos">
                    <label className="contacto-modal__campo" htmlFor={`${idBase}-nombre`}>
                      <span className="contacto-modal__etiqueta">
                        {t.nombre} <small>{t.nombreAyuda}</small>
                      </span>
                      <input
                        id={`${idBase}-nombre`}
                        name="nombre"
                        type="text"
                        autoComplete="given-name"
                        placeholder="Flora Tricoma"
                        maxLength={80}
                        value={nombre}
                        disabled={enviando}
                        aria-invalid={errores.nombre ? true : undefined}
                        aria-describedby={errores.nombre ? `${idBase}-nombre-error` : undefined}
                        onChange={(evento) => setNombre(evento.target.value)}
                      />
                      {errores.nombre ? (
                        <span id={`${idBase}-nombre-error`} className="contacto-modal__error" role="alert">
                          {errores.nombre}
                        </span>
                      ) : null}
                    </label>

                    <label className="contacto-modal__campo" htmlFor={`${idBase}-email`}>
                      <span className="contacto-modal__etiqueta">
                        {t.correo} <small>{t.correoAyuda}</small>
                      </span>
                      <input
                        id={`${idBase}-email`}
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="flora.trico420@gmail.com"
                        required
                        maxLength={254}
                        value={email}
                        disabled={enviando}
                        aria-invalid={errores.email ? true : undefined}
                        aria-describedby={errores.email ? `${idBase}-email-error` : undefined}
                        onChange={(evento) => setEmail(evento.target.value)}
                      />
                      {errores.email ? (
                        <span id={`${idBase}-email-error`} className="contacto-modal__error" role="alert">
                          {errores.email}
                        </span>
                      ) : null}
                    </label>

                    <div className="contacto-modal__trampa" aria-hidden="true">
                      <label htmlFor={`${idBase}-empresa`}>Empresa</label>
                      <input
                        id={`${idBase}-empresa`}
                        name="empresa"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={empresa}
                        onChange={(evento) => setEmpresa(evento.target.value)}
                      />
                    </div>
                  </div>

                  {errorGeneral ? (
                    <p className="lanzamiento-modal__estado lanzamiento-modal__estado--alerta" role="alert">
                      <CircleAlert size={20} strokeWidth={2.2} aria-hidden="true" />
                      <span>{errorGeneral}</span>
                    </p>
                  ) : null}

                  <div className="lanzamiento-modal__acciones">
                    <Boton
                      type="submit"
                      className="boton lanzamiento-modal__avisar"
                      disabled={enviando}
                      aria-busy={enviando || undefined}
                    >
                      {enviando ? (
                        t.enviando
                      ) : estado === "error" ? (
                        t.reintentar
                      ) : (
                        <>
                          <Rocket size={18} aria-hidden="true" />
                          {t.enviar}
                        </>
                      )}
                    </Boton>
                  </div>
                </form>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
