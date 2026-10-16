"use client";

import { useState } from "react";

const CORREO = "enflora.420@gmail.com";

export function FormularioContacto() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  function enviar(evento) {
    evento.preventDefault();
    setError("");

    const nombreLimpio = nombre.trim();
    const emailLimpio = email.trim();
    const mensajeLimpio = mensaje.trim();

    if (!nombreLimpio || !emailLimpio || !mensajeLimpio) {
      setError("Completá todos los campos para enviar tu consulta.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      setError("Revisá el correo electrónico.");
      return;
    }

    const asunto = encodeURIComponent(`Consulta ENFLORA · ${nombreLimpio}`);
    const cuerpo = encodeURIComponent(
      `Nombre: ${nombreLimpio}\nCorreo: ${emailLimpio}\n\n${mensajeLimpio}`,
    );
    window.location.href = `mailto:${CORREO}?subject=${asunto}&body=${cuerpo}`;
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="contacto__exito" role="status">
        <p>¡Listo! Si no se abrió tu correo, escribinos a {CORREO}.</p>
        <button
          type="button"
          className="landing__accion landing__accion--linea"
          onClick={() => {
            setEnviado(false);
            setMensaje("");
          }}
        >
          Enviar otra consulta
        </button>
      </div>
    );
  }

  return (
    <form className="contacto__form" onSubmit={enviar} noValidate>
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
            required
          />
        </label>
        <label className="contacto__campo">
          <span>Correo</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            placeholder="tu@correo.com"
            required
          />
        </label>
      </div>
      <label className="contacto__campo">
        <span>Mensaje</span>
        <textarea
          name="mensaje"
          rows={4}
          value={mensaje}
          onChange={(evento) => setMensaje(evento.target.value)}
          placeholder="Contanos tu consulta"
          required
        />
      </label>
      {error ? (
        <p className="contacto__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="landing__accion landing__accion--principal">
        Enviar consulta
      </button>
    </form>
  );
}
