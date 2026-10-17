"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import {
  MENSAJES_PARTNERS,
  OPCIONES_PLAN_FORMULARIO,
  PLAN_INDEFINIDO,
  validarPartners,
} from "@/lib/partners";

function ajustarAltura(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function FormularioPartners({ planInicial = PLAN_INDEFINIDO }) {
  const [comercio, setComercio] = useState("");
  const [representante, setRepresentante] = useState("");
  const [correo, setCorreo] = useState("");
  const [sitio, setSitio] = useState("");
  const [rubro, setRubro] = useState("");
  const [plan, setPlan] = useState(planInicial || PLAN_INDEFINIDO);
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

    const resultado = validarPartners({
      comercio,
      representante,
      correo,
      sitio,
      rubro,
      plan,
      mensaje,
      empresa,
    });

    if (!resultado.ok) {
      setError(resultado.error || MENSAJES_PARTNERS.generico);
      return;
    }

    if (resultado.honeypot) {
      setComercio("");
      setRepresentante("");
      setCorreo("");
      setSitio("");
      setRubro("");
      setPlan(PLAN_INDEFINIDO);
      setMensaje("");
      setEmpresa("");
      setEnviado(true);
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);

    try {
      const respuesta = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...resultado.datos,
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
        setError(MENSAJES_PARTNERS.generico);
        return;
      }

      setComercio("");
      setRepresentante("");
      setCorreo("");
      setSitio("");
      setRubro("");
      setPlan(PLAN_INDEFINIDO);
      setMensaje("");
      setEmpresa("");
      setEnviado(true);
    } catch {
      setError(MENSAJES_PARTNERS.generico);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="partners__exito" role="status">
        <p>{MENSAJES_PARTNERS.exito}</p>
        <button
          type="button"
          className="partners__exito-accion"
          onClick={() => {
            setEnviado(false);
            setError("");
          }}
        >
          Enviar otra propuesta
        </button>
      </div>
    );
  }

  return (
    <form className="partners__form" onSubmit={enviar} noValidate id="partners-formulario">
      <div className="partners__honeypot" aria-hidden="true">
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

      <label className="partners__campo">
        <span>Nombre del comercio o marca</span>
        <input
          type="text"
          name="comercio"
          autoComplete="organization"
          value={comercio}
          onChange={(evento) => setComercio(evento.target.value)}
          placeholder="Tu marca o growshop"
          maxLength={120}
          required
          disabled={enviando}
        />
      </label>

      <div className="partners__fila">
        <label className="partners__campo">
          <span>Nombre y apellido del representante</span>
          <input
            type="text"
            name="representante"
            autoComplete="name"
            value={representante}
            onChange={(evento) => setRepresentante(evento.target.value)}
            placeholder="Quién nos escribe"
            maxLength={100}
            required
            disabled={enviando}
          />
        </label>
        <label className="partners__campo">
          <span>Correo electrónico</span>
          <input
            type="email"
            name="correo"
            autoComplete="email"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            placeholder="hola@tumarca.com"
            maxLength={254}
            required
            disabled={enviando}
          />
        </label>
      </div>

      <div className="partners__fila">
        <label className="partners__campo">
          <span>Sitio web o Instagram</span>
          <input
            type="text"
            name="sitio"
            autoComplete="url"
            value={sitio}
            onChange={(evento) => setSitio(evento.target.value)}
            placeholder="https://… o @usuario"
            maxLength={200}
            disabled={enviando}
          />
        </label>
        <label className="partners__campo">
          <span>Rubro del comercio</span>
          <input
            type="text"
            name="rubro"
            value={rubro}
            onChange={(evento) => setRubro(evento.target.value)}
            placeholder="Insumos, genética, growshop…"
            maxLength={80}
            disabled={enviando}
          />
        </label>
      </div>

      <label className="partners__campo">
        <span>Plan publicitario de interés</span>
        <select
          name="plan"
          value={plan}
          onChange={(evento) => setPlan(evento.target.value)}
          required
          disabled={enviando}
        >
          {OPCIONES_PLAN_FORMULARIO.map((opcion) => (
            <option key={opcion.id} value={opcion.id}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="partners__campo">
        <span>Mensaje o propuesta comercial</span>
        <textarea
          ref={mensajeRef}
          name="mensaje"
          rows={4}
          value={mensaje}
          onChange={(evento) => {
            setMensaje(evento.target.value);
            ajustarAltura(evento.target);
          }}
          placeholder="Contanos sobre tu marca y cómo te imaginás el acuerdo…"
          maxLength={3000}
          disabled={enviando}
        />
      </label>

      {error ? (
        <p className="partners__error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="partners__enviar" disabled={enviando} aria-busy={enviando}>
        {enviando ? (
          <>
            <LoaderCircle size={18} strokeWidth={2} className="partners__enviar-spinner" aria-hidden="true" />
            <span>{MENSAJES_PARTNERS.enviando}</span>
          </>
        ) : (
          <>
            <span>Enviar propuesta</span>
            <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
