"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { ModalRuleta } from "@/componentes/ruleta-420/modal-ruleta";
import { confirmarDiversion, enviarContacto } from "@/lib/contactos/cliente";
import {
  MENSAJES_CONTACTOS,
  normalizarEmail,
  normalizarNombre,
  normalizarTelefono,
  validarDiversion,
} from "@/lib/contactos/reglas";

export const CLAVE_DIVERSION_RULETA = "enflora-ruleta-diversion";

export const textosPresentacion = {
  titulo: "¡Flora te quiere conocer!",
  descripcion: "Flora pregunta cómo te llamás. Dejanos tu nombre o una forma de contacto para jugar.",
  nombre: "Nombre",
  correo: "Correo electrónico",
  telefono: "Teléfono",
  jugar: "¡AHORA SÍ, A JUGAR!",
  guardando: "GUARDANDO...",
  cancelar: "VOLVER",
  diversion: "Querés volver a jugar por diversión?",
  diversionAyuda: "Ingresá el mail o numero de telefono que ingresaste y jugá las veces que quieras!",
};

export function leerDiversionRuleta() {
  try {
    return window.sessionStorage.getItem(CLAVE_DIVERSION_RULETA) === "1";
  } catch {
    return false;
  }
}

export function marcarDiversionRuleta() {
  try {
    window.sessionStorage.setItem(CLAVE_DIVERSION_RULETA, "1");
  } catch {}
}

export function validarPresentacion({ nombre, email, telefono }) {
  const errores = {};
  const nombreLimpio = normalizarNombre(nombre);
  if (nombreLimpio === null) errores.nombre = MENSAJES_CONTACTOS.nombreObligatorio;
  else if (nombreLimpio === undefined) errores.nombre = MENSAJES_CONTACTOS.nombre;
  const correo = normalizarEmail(email);
  if (correo === undefined) errores.email = MENSAJES_CONTACTOS.email;
  const tel = normalizarTelefono(telefono);
  if (tel === undefined) errores.telefono = MENSAJES_CONTACTOS.telefono;
  if (!errores.email && !errores.telefono && !correo && !tel) errores.contacto = MENSAJES_CONTACTOS.algunContacto;
  return errores;
}

export function ModalPresentacion({ abierto, onCerrar, onListo }) {
  const idBase = useId();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [errorDiversion, setErrorDiversion] = useState("");
  const [accion, setAccion] = useState("");
  const enviando = accion !== "";

  function cerrar() {
    if (enviando) return;
    setErrores({});
    setErrorGeneral("");
    setErrorDiversion("");
    onCerrar();
  }

  function aplicarFallo(resultado) {
    if (resultado.campo && ["nombre", "email", "telefono", "contacto"].includes(resultado.campo)) {
      setErrores({ [resultado.campo]: resultado.error });
      return;
    }
    setErrorGeneral(resultado.error);
  }

  async function jugarPorDiversion() {
    if (enviando) return;
    const validacion = validarDiversion({ email, telefono, empresa });
    setErrorGeneral("");
    setErrorDiversion("");
    if (!validacion.ok) {
      aplicarFallo(validacion);
      return;
    }
    setErrores({});
    if (validacion.honeypot) {
      onListo("", { diversion: true });
      return;
    }

    setAccion("diversion");
    const resultado = await confirmarDiversion({ email, telefono, empresa });
    setAccion("");
    if (!resultado.ok) {
      if (resultado.campo) aplicarFallo(resultado);
      else setErrorDiversion(resultado.error);
      return;
    }
    setNombre("");
    setEmail("");
    setTelefono("");
    setEmpresa("");
    setErrores({});
    onListo("", { diversion: true });
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) return;
    const detectados = validarPresentacion({ nombre, email, telefono });
    setErrores(detectados);
    setErrorGeneral("");
    setErrorDiversion("");
    if (Object.keys(detectados).length) return;

    setAccion("registro");
    const resultado = await enviarContacto({
      origen: "ruleta_420",
      nombre,
      email,
      telefono,
      consentimiento: false,
      empresa,
    });
    setAccion("");
    if (!resultado.ok) {
      aplicarFallo(resultado);
      return;
    }
    setNombre("");
    setEmail("");
    setTelefono("");
    setEmpresa("");
    setErrores({});
    onListo(normalizarNombre(nombre) || "");
  }

  const t = textosPresentacion;

  return (
    <ModalRuleta
      abierto={abierto}
      onCerrar={cerrar}
      titulo={t.titulo}
      descripcion={t.descripcion}
      className="ruleta-presentacion"
      encabezado={
        <div className="ruleta-presentacion__flora">
          <Image src="/images/flora-saluda.png" alt="" width={1129} height={1176} draggable={false} priority />
        </div>
      }
    >
      <form className="ruleta-presentacion__formulario" onSubmit={enviar} noValidate>
        <label className="ruleta-presentacion__campo" htmlFor={`${idBase}-nombre`}>
          <span className="ruleta-presentacion__etiqueta">{t.nombre}</span>
          <input
            id={`${idBase}-nombre`}
            name="nombre"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            placeholder="Flora Tricoma"
            value={nombre}
            disabled={enviando}
            aria-invalid={errores.nombre ? true : undefined}
            aria-describedby={errores.nombre ? `${idBase}-nombre-error` : undefined}
            onChange={(evento) => setNombre(evento.target.value)}
          />
          {errores.nombre ? (
            <span id={`${idBase}-nombre-error`} className="ruleta-presentacion__error" role="alert">
              {errores.nombre}
            </span>
          ) : null}
        </label>

        <label className="ruleta-presentacion__campo" htmlFor={`${idBase}-email`}>
          <span className="ruleta-presentacion__etiqueta">{t.correo}</span>
          <input
            id={`${idBase}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            placeholder="flora.trico420@gmail.com"
            value={email}
            disabled={enviando}
            aria-invalid={errores.email || errores.contacto ? true : undefined}
            aria-describedby={errores.email ? `${idBase}-email-error` : errores.contacto ? `${idBase}-contacto-error` : undefined}
            onChange={(evento) => setEmail(evento.target.value)}
          />
          {errores.email ? (
            <span id={`${idBase}-email-error`} className="ruleta-presentacion__error" role="alert">
              {errores.email}
            </span>
          ) : null}
        </label>

        <label className="ruleta-presentacion__campo" htmlFor={`${idBase}-telefono`}>
          <span className="ruleta-presentacion__etiqueta">{t.telefono}</span>
          <input
            id={`${idBase}-telefono`}
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={25}
            placeholder="+54 9 11 1234 5678"
            value={telefono}
            disabled={enviando}
            aria-invalid={errores.telefono || errores.contacto ? true : undefined}
            aria-describedby={errores.telefono ? `${idBase}-telefono-error` : errores.contacto ? `${idBase}-contacto-error` : undefined}
            onChange={(evento) => setTelefono(evento.target.value)}
          />
          {errores.telefono ? (
            <span id={`${idBase}-telefono-error`} className="ruleta-presentacion__error" role="alert">
              {errores.telefono}
            </span>
          ) : null}
        </label>

        {errores.contacto ? (
          <p id={`${idBase}-contacto-error`} className="ruleta-presentacion__error" role="alert">
            {errores.contacto}
          </p>
        ) : null}

        <div className="ruleta-presentacion__trampa" aria-hidden="true">
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

        {errorGeneral ? (
          <p className="ruleta-aviso" role="alert">
            {errorGeneral}
          </p>
        ) : null}

        <div className="ruleta-acciones">
          <BotonRuleta type="submit" disabled={enviando} aria-busy={accion === "registro" || undefined}>
            {accion === "registro" ? t.guardando : t.jugar}
          </BotonRuleta>
          <BotonRuleta type="button" variante="secundario" onClick={cerrar} disabled={enviando}>
            {t.cancelar}
          </BotonRuleta>
        </div>

        <div className="ruleta-presentacion__diversion">
          <BotonRuleta
            type="button"
            variante="secundario"
            className="ruleta-presentacion__diversion-boton"
            onClick={jugarPorDiversion}
            disabled={enviando}
            aria-busy={accion === "diversion" || undefined}
          >
            {t.diversion}
          </BotonRuleta>
          <p className="ruleta-presentacion__diversion-texto">{t.diversionAyuda}</p>
          {errorDiversion ? (
            <p className="ruleta-presentacion__error" role="alert">
              {errorDiversion}
            </p>
          ) : null}
        </div>
      </form>
    </ModalRuleta>
  );
}
