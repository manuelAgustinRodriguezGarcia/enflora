"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { MENSAJES_CONTACTO, validarContacto } from "@/lib/contacto";

function ajustarAltura(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function FormularioContacto() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const mensajeRef = useRef(null);
  const enviandoRef = useRef(false);

  useEffect(() => {
    if (!enviado) ajustarAltura(mensajeRef.current);
  }, [mensaje, enviado]);

  async function enviar(evento) {
    evento.preventDefault();
    if (enviandoRef.current) return;

    setError("");

    const resultado = validarContacto({
      nombre,
      correo,
      mensaje,
      empresa,
    });

    if (!resultado.ok) {
      setError(resultado.error || MENSAJES_CONTACTO.generico);
      return;
    }

    if (resultado.honeypot) {
      setNombre("");
      setCorreo("");
      setMensaje("");
      setEmpresa("");
      setEnviado(true);
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);

    try {
      const respuesta = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: resultado.datos.nombre,
          correo: resultado.datos.correo,
          mensaje: resultado.datos.mensaje,
          empresa,
        }),
      });

      let data = null;
      try {
        data = await respuesta.json();
      } catch {
        data = null;
      }

      if (!respuesta.ok || !data?.ok) {
        setError(MENSAJES_CONTACTO.generico);
        return;
      }

      setNombre("");
      setCorreo("");
      setMensaje("");
      setEmpresa("");
      setEnviado(true);
    } catch {
      setError(MENSAJES_CONTACTO.generico);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="contacto__exito" role="status">
        <p>{MENSAJES_CONTACTO.exito}</p>
        <button
          type="button"
          className="contacto__exito-accion"
          onClick={() => {
            setEnviado(false);
            setError("");
          }}
        >
          Enviar otra consulta
        </button>
      </div>
    );
  }

  return (
    <form className="contacto__form" onSubmit={enviar} noValidate>
      <div className="contacto__honeypot" aria-hidden="true">
        <label>
          Empresa
          <input
            type="text"
            name="empresa"
            value={empresa}
            onChange={(evento) => setEmpresa(evento.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="contacto__fila">
        <label className="contacto__campo">
          <span>Nombre</span>
          <input
            type="text"
            name="nombre"
            autoComplete="name"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Tu nombre"
            maxLength={100}
            required
            disabled={enviando}
          />
        </label>
        <label className="contacto__campo">
          <span>Correo</span>
          <input
            type="email"
            name="correo"
            autoComplete="email"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            placeholder="tu@correo.com"
            maxLength={254}
            required
            disabled={enviando}
          />
        </label>
      </div>
      <label className="contacto__campo">
        <span>Mensaje</span>
        <textarea
          ref={mensajeRef}
          name="mensaje"
          rows={4}
          value={mensaje}
          onChange={(evento) => {
            setMensaje(evento.target.value);
            ajustarAltura(evento.target);
          }}
          placeholder="Contame tu consulta..."
          maxLength={3000}
          required
          disabled={enviando}
        />
      </label>
      {error ? (
        <p className="contacto__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="contacto__enviar" disabled={enviando} aria-busy={enviando}>
        {enviando ? (
          <>
            <LoaderCircle size={18} strokeWidth={2} className="contacto__enviar-spinner" aria-hidden="true" />
            <span>{MENSAJES_CONTACTO.enviando}</span>
          </>
        ) : (
          <>
            <span>Enviar consulta</span>
            <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
