"use client";

import { ArrowRight, Eye, EyeOff, Info, Loader, LockKeyhole, Mail, Phone, User } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { registrar } from "@/app/acciones/sesion";

export function FormularioRegistro() {
  const [estado, accion, pendiente] = useActionState(registrar, null);
  const [visibles, setVisibles] = useState(false);
  const [escritos, setEscritos] = useState({});
  const marca = estado?.error ?? "";
  const [marcaVista, setMarcaVista] = useState(marca);
  const tipoClave = visibles ? "text" : "password";
  const faltantes = new Set(estado?.faltantes || []);

  if (marca !== marcaVista) {
    setMarcaVista(marca);
    setEscritos({});
  }
  const claseCampo = (nombre) =>
    faltantes.has(nombre) && !escritos[nombre]
      ? "formulario__campo formulario__campo--falta"
      : "formulario__campo";
  const alEscribir = (nombre) => (evento) => {
    const escrito = evento.target.value.trim().length > 0;
    setEscritos((prev) => (prev[nombre] === escrito ? prev : { ...prev, [nombre]: escrito }));
  };
  const dejarLetras = (evento) => {
    evento.target.value = evento.target.value.replace(/[^\p{L}\s]/gu, "");
  };
  const dejarDigitos = (evento) => {
    evento.target.value = evento.target.value.replace(/\D/g, "");
  };

  return (
    <>
      <section className="auth">
        <div className="auth__intro">
          <h1>Crear cuenta</h1>
          <p>Registrate hoy y tomá el control de tus cultivos.</p>
        </div>
        <form key={estado?.error || "inicial"} className="formulario" action={accion}>
          <div className="formulario__fila">
            <label className={claseCampo("nombre")}>
              Nombre
              <span className="formulario__control">
                <User className="formulario__icono" size={20} strokeWidth={2} aria-hidden="true" />
                <input
                  name="nombre"
                  type="text"
                  placeholder="Flora"
                  defaultValue={estado?.nombre || ""}
                  onChange={(evento) => {
                    dejarLetras(evento);
                    alEscribir("nombre")(evento);
                  }}
                />
              </span>
            </label>
            <label className="formulario__campo">
              Apellido
              <span className="formulario__control">
                <User className="formulario__icono" size={20} strokeWidth={2} aria-hidden="true" />
                <input
                  name="apellido"
                  type="text"
                  placeholder="Tricoma"
                  defaultValue={estado?.apellido || ""}
                  onChange={dejarLetras}
                />
              </span>
            </label>
          </div>
          <label className="formulario__campo">
            Teléfono
            <span className="formulario__control">
              <Phone className="formulario__icono" size={20} strokeWidth={2} aria-hidden="true" />
              <input
                name="telefono"
                type="text"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="11 4200 4200"
                defaultValue={estado?.telefono || ""}
                onChange={dejarDigitos}
              />
            </span>
          </label>
          <label className={claseCampo("email")}>
            Email
            <span className="formulario__control">
              <Mail className="formulario__icono" size={20} strokeWidth={2} aria-hidden="true" />
              <input
                name="email"
                type="text"
                autoComplete="email"
                placeholder="flora.trico420@mail.com"
                defaultValue={estado?.email || ""}
                onChange={alEscribir("email")}
              />
            </span>
          </label>
          <label className={claseCampo("contrasena")}>
            Contraseña
            <ul className="auth__requisitos">
              <li>Debe contener minúscula, mayúscula y un número.</li>
            </ul>
            <span className="formulario__clave">
              <LockKeyhole className="formulario__icono" size={20} strokeWidth={2} aria-hidden="true" />
              <input
                name="contrasena"
                type={tipoClave}
                autoComplete="new-password"
                placeholder="••••••••"
                onChange={alEscribir("contrasena")}
              />
              <button
                type="button"
                aria-label={visibles ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                aria-pressed={visibles}
                onClick={() => setVisibles((valor) => !valor)}
              >
                {visibles ? (
                  <EyeOff size={20} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Eye size={20} strokeWidth={2} aria-hidden="true" />
                )}
              </button>
            </span>
          </label>
          <label className={claseCampo("confirmar_contrasena")}>
            Confirmar contraseña
            <span className="formulario__control">
              <LockKeyhole className="formulario__icono" size={20} strokeWidth={2} aria-hidden="true" />
              <input
                name="confirmar_contrasena"
                type={tipoClave}
                autoComplete="new-password"
                placeholder="••••••••"
                onChange={alEscribir("confirmar_contrasena")}
              />
            </span>
          </label>
          <button
            className="formulario__enviar"
            type="submit"
            disabled={pendiente}
            aria-busy={pendiente}
            aria-label={pendiente ? "Creando cuenta" : undefined}
          >
            {pendiente ? (
              <Loader className="formulario__carga" size={20} strokeWidth={2} aria-hidden="true" />
            ) : (
              <>
                Crear cuenta
                <ArrowRight size={20} strokeWidth={2} color="white" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
        <p className="auth__alta">
          Ya tenés una cuenta? <Link href="/entrar">Iniciá sesión</Link>
        </p>
      </section>
      {estado?.error ? (
        <p className="auth__aviso" role="alert">
          <Info size={16} strokeWidth={2} aria-hidden="true" />
          {estado.error}
        </p>
      ) : null}
    </>
  );
}
