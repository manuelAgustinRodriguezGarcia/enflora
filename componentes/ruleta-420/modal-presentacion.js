"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { ModalRuleta } from "@/componentes/ruleta-420/modal-ruleta";
import { enviarContacto } from "@/lib/contactos/cliente";
import {
  MENSAJES_CONTACTOS,
  TEXTOS_CONSENTIMIENTO,
  normalizarEmail,
  normalizarNombre,
  normalizarTelefono,
} from "@/lib/contactos/reglas";

export const CLAVE_PRESENTACION_RULETA = "enflora-ruleta-presentacion";

export const textosPresentacion = {
  titulo: "¡Flora te quiere conocer!",
  descripcion: "Flora pregunta cómo te llamás. Dejanos tu nombre o una forma de contacto para jugar.",
  nombre: "Nombre",
  correo: "Correo electrónico",
  telefono: "Teléfono",
  opcional: "Opcional",
  obligatorio: "Obligatorio",
  jugar: "¡AHORA SÍ, A JUGAR!",
  guardando: "GUARDANDO...",
  cancelar: "VOLVER",
  privacidad: "Política de privacidad",
};

export function leerPresentacionRuleta() {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_PRESENTACION_RULETA);
    if (!crudo) return null;
    const datos = JSON.parse(crudo);
    return datos && datos.registrado === true ? datos : null;
  } catch {
    return null;
  }
}

export function guardarPresentacionRuleta(nombre) {
  try {
    window.sessionStorage.setItem(CLAVE_PRESENTACION_RULETA, JSON.stringify({ registrado: true, nombre }));
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
  if (!errores.email && !errores.telefono && !correo && !tel) errores.email = MENSAJES_CONTACTOS.algunContacto;
  return errores;
}

export function ModalPresentacion({ abierto, onCerrar, onListo }) {
  const idBase = useId();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [enviando, setEnviando] = useState(false);

  function cerrar() {
    if (enviando) return;
    setErrores({});
    setErrorGeneral("");
    onCerrar();
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) return;
    const detectados = validarPresentacion({ nombre, email, telefono });
    setErrores(detectados);
    setErrorGeneral("");
    if (Object.keys(detectados).length) return;

    setEnviando(true);
    const resultado = await enviarContacto({
      origen: "ruleta_420",
      nombre,
      email,
      telefono,
      consentimiento,
      empresa,
    });
    setEnviando(false);
    if (!resultado.ok) {
      if (resultado.campo && ["nombre", "email", "telefono"].includes(resultado.campo)) {
        setErrores({ [resultado.campo]: resultado.error });
      } else {
        setErrorGeneral(resultado.error);
      }
      return;
    }
    const nombreLimpio = normalizarNombre(nombre) || "";
    guardarPresentacionRuleta(nombreLimpio);
    setErrores({});
    onListo(nombreLimpio);
  }

  const t = textosPresentacion;

  return (
    <ModalRuleta abierto={abierto} onCerrar={cerrar} titulo={t.titulo} descripcion={t.descripcion} className="ruleta-presentacion">
      <form className="ruleta-presentacion__formulario" onSubmit={enviar} noValidate>
        <label className="ruleta-presentacion__campo" htmlFor={`${idBase}-nombre`}>
          <span className="ruleta-presentacion__etiqueta">
            {t.nombre} <small>{t.obligatorio}</small>
          </span>
          <input
            id={`${idBase}-nombre`}
            name="nombre"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
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
          <span className="ruleta-presentacion__etiqueta">
            {t.correo} <small>{t.opcional}</small>
          </span>
          <input
            id={`${idBase}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            disabled={enviando}
            aria-invalid={errores.email ? true : undefined}
            aria-describedby={errores.email ? `${idBase}-email-error` : undefined}
            onChange={(evento) => setEmail(evento.target.value)}
          />
          {errores.email ? (
            <span id={`${idBase}-email-error`} className="ruleta-presentacion__error" role="alert">
              {errores.email}
            </span>
          ) : null}
        </label>

        <label className="ruleta-presentacion__campo" htmlFor={`${idBase}-telefono`}>
          <span className="ruleta-presentacion__etiqueta">
            {t.telefono} <small>{t.opcional}</small>
          </span>
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
            aria-invalid={errores.telefono ? true : undefined}
            aria-describedby={errores.telefono ? `${idBase}-telefono-error` : undefined}
            onChange={(evento) => setTelefono(evento.target.value)}
          />
          {errores.telefono ? (
            <span id={`${idBase}-telefono-error`} className="ruleta-presentacion__error" role="alert">
              {errores.telefono}
            </span>
          ) : null}
        </label>

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

        <label className="ruleta-presentacion__consentimiento" htmlFor={`${idBase}-consentimiento`}>
          <input
            id={`${idBase}-consentimiento`}
            name="consentimiento"
            type="checkbox"
            checked={consentimiento}
            disabled={enviando}
            onChange={(evento) => setConsentimiento(evento.target.checked)}
          />
          <span>{TEXTOS_CONSENTIMIENTO.casilla}</span>
        </label>

        <p className="ruleta-presentacion__finalidad">
          {TEXTOS_CONSENTIMIENTO.finalidadRuleta}{" "}
          <Link href="/privacidad" target="_blank" rel="noopener">
            {t.privacidad}
          </Link>
        </p>

        {errorGeneral ? (
          <p className="ruleta-aviso" role="alert">
            {errorGeneral}
          </p>
        ) : null}

        <div className="ruleta-acciones">
          <BotonRuleta type="submit" disabled={enviando} aria-busy={enviando || undefined}>
            {enviando ? t.guardando : t.jugar}
          </BotonRuleta>
          <BotonRuleta type="button" variante="secundario" onClick={cerrar} disabled={enviando}>
            {t.cancelar}
          </BotonRuleta>
        </div>
      </form>
    </ModalRuleta>
  );
}
