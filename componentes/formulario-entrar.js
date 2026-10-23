"use client";

import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { entrar } from "@/app/acciones/sesion";
import { SlideCommit } from "@/componentes/slide-commit";
import { SpinnerCarga } from "@/componentes/spinner-carga";

function IconoCandado({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="11" width="12" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconoOjo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
      />
      <circle fill="none" stroke="currentColor" strokeWidth="2" cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconoOjoTachado() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M3 3l18 18" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M10.6 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.8 4.4M6.2 6.2C3.8 7.9 2 12 2 12a18 18 0 0 0 7 6"
      />
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function FormularioEntrar({ aviso, siguiente = "" }) {
  const [estado, accion, pendiente] = useActionState(entrar, null);
  const [, startTransition] = useTransition();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState(estado?.email || "");
  const [contrasena, setContrasena] = useState("");
  const [anchoDeslizar, setAnchoDeslizar] = useState(280);
  const formularioRef = useRef(null);
  const observadorRef = useRef(null);
  const esperaRef = useRef(null);
  const pendientePrevio = useRef(false);

  const listo = email.trim().length > 0 && contrasena.trim().length > 0;

  useEffect(() => {
    if (estado?.email) setEmail(estado.email);
  }, [estado?.email]);

  const deslizarRef = useCallback((nodo) => {
    observadorRef.current?.disconnect();
    observadorRef.current = null;
    if (!nodo) return;
    const medir = () => {
      const ancho = Math.round(nodo.getBoundingClientRect().width);
      if (ancho > 0) setAnchoDeslizar(Math.max(200, ancho));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    observadorRef.current = observador;
  }, []);

  useEffect(() => {
    if (pendientePrevio.current && !pendiente && esperaRef.current) {
      const { resolve, reject } = esperaRef.current;
      esperaRef.current = null;
      if (estado?.error) reject(new Error(estado.error));
      else resolve();
    }
    pendientePrevio.current = pendiente;
  }, [pendiente, estado]);

  const confirmarDesliz = () =>
    new Promise((resolve, reject) => {
      const formulario = formularioRef.current;
      if (!formulario || !listo) {
        reject(new Error("Completá email y contraseña."));
        return;
      }
      esperaRef.current = { resolve, reject };
      startTransition(() => {
        accion(new FormData(formulario));
      });
    });

  return (
    <>
      <section className="auth">
        <div className="auth__intro">
          <h1>Iniciar Sesión</h1>
          <p>Que bueno tenerte por acá!</p>
        </div>
        <form
          ref={formularioRef}
          key={estado?.error || "inicial"}
          className="formulario"
          action={accion}
        >
          {siguiente ? <input type="hidden" name="siguiente" value={siguiente} /> : null}
          <label className="formulario__campo">
            Email
            <input
              name="email"
              type="text"
              autoComplete="email"
              placeholder="flora.trico420@mail.com"
              defaultValue={estado?.email || ""}
              onChange={(evento) => setEmail(evento.target.value)}
            />
          </label>
          <label className="formulario__campo">
            Contraseña
            <span className="formulario__clave">
              <IconoCandado className="formulario__icono" />
              <input
                name="contrasena"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                onChange={(evento) => setContrasena(evento.target.value)}
              />
              <button
                className="formulario__revelar"
                type="button"
                aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={visible}
                onClick={() => setVisible((valor) => !valor)}
              >
                {visible ? <IconoOjoTachado /> : <IconoOjo />}
              </button>
            </span>
          </label>
          <button
            className="formulario__enviar formulario__enviar--escritorio"
            type="submit"
            disabled={pendiente}
            aria-busy={pendiente}
            aria-label={pendiente ? "Entrando" : undefined}
          >
            {pendiente ? (
              <SpinnerCarga size={22} etiqueta="Entrando" />
            ) : (
              <>
                Entrar
                <ArrowRight size={20} strokeWidth={2} color="#FDF1D7" aria-hidden="true" />
              </>
            )}
          </button>
          <div className="formulario__deslizar" ref={deslizarRef}>
            <SlideCommit
              label="Deslizar para entrar"
              doneLabel="Listo"
              errorLabel="No se pudo entrar"
              onConfirm={confirmarDesliz}
              disabled={!listo || pendiente}
              trackColor="#0B3D2A"
              handleColor="#F4F8EE"
              successColor="#A4C85B"
              dangerColor="#9b2c2c"
              width={anchoDeslizar}
              height={48}
              radius={18}
              holdMs={0}
            />
          </div>
        </form>
        <p className="auth__alta">No tenés cuenta? <Link href="/registro">Creá una</Link>.</p>
      </section>
      {estado?.error || aviso ? (
        <p className="auth__aviso" role={estado?.error ? "alert" : "status"}>
          <Info size={16} strokeWidth={2} aria-hidden="true" />
          {estado?.error || aviso}
        </p>
      ) : null}
    </>
  );
}
