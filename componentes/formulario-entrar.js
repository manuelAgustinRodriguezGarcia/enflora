"use client";

import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { entrar } from "@/app/acciones/sesion";

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

export function FormularioEntrar({ aviso }) {
  const [estado, accion, pendiente] = useActionState(entrar, null);
  const [visible, setVisible] = useState(false);

  return (
    <>
      <section className="auth">
        <h1>Iniciar Sesión</h1>
        <form key={estado?.error || "inicial"} className="formulario" action={accion}>
          <label className="formulario__campo">
            Email
            <input
              name="email"
              type="text"
              autoComplete="email"
              placeholder="flora.trico420@mail.com"
              defaultValue={estado?.email || ""}
            />
          </label>
          <label className="formulario__campo">
            Contraseña
            <span className="formulario__clave">
              <input
                name="contrasena"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={visible}
                onClick={() => setVisible((valor) => !valor)}
              >
                {visible ? <IconoOjoTachado /> : <IconoOjo />}
              </button>
            </span>
          </label>
          <button className="formulario__olvido" type="button">
            Olvidaste tu contraseña?
          </button>
          <button className="formulario__enviar" type="submit" disabled={pendiente}>
            Entrar
            <ArrowRight size={20} strokeWidth={2} color="white" aria-hidden="true" />
          </button>
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
