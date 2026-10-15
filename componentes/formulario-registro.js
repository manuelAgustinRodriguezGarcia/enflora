"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { registrar } from "@/app/acciones/sesion";
import { SpinnerCarga } from "@/componentes/spinner-carga";

function Icono({ className, size = 20, children }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const REQUISITOS = [
  {
    id: "largo",
    texto: "Mínimo 8 caracteres",
    cumple: (clave) => clave.length >= 8,
  },
  {
    id: "minuscula",
    texto: "Contiene minúscula",
    cumple: (clave) => /\p{Ll}/u.test(clave),
  },
  {
    id: "mayuscula",
    texto: "Contiene mayúscula",
    cumple: (clave) => /\p{Lu}/u.test(clave),
  },
  {
    id: "numero",
    texto: "Contiene un número",
    cumple: (clave) => /\d/.test(clave),
  },
];

export function FormularioRegistro() {
  const [estado, accion, pendiente] = useActionState(registrar, null);
  const [visibles, setVisibles] = useState(false);
  const [escritos, setEscritos] = useState({});
  const [clave, setClave] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [avisoClaveId, setAvisoClaveId] = useState(0);
  const [avisoClaveBottom, setAvisoClaveBottom] = useState(16);
  const [montado, setMontado] = useState(false);
  const marca = estado?.error ?? "";
  const [marcaVista, setMarcaVista] = useState(marca);
  const tipoClave = visibles ? "text" : "password";
  const faltantes = new Set(estado?.faltantes || []);

  if (marca !== marcaVista) {
    setMarcaVista(marca);
    setEscritos({});
    setClave("");
    setConfirmar("");
    setAvisoClaveId(0);
  }

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!avisoClaveId) return;
    const ocultar = window.setTimeout(() => setAvisoClaveId(0), 3000);
    return () => window.clearTimeout(ocultar);
  }, [avisoClaveId]);

  useEffect(() => {
    if (!avisoClaveId) return;
    const actualizar = () => {
      const vista = window.visualViewport;
      if (!vista) {
        setAvisoClaveBottom(16);
        return;
      }
      const teclado = Math.max(0, window.innerHeight - vista.height - vista.offsetTop);
      setAvisoClaveBottom(teclado + 16);
    };
    actualizar();
    const vista = window.visualViewport;
    vista?.addEventListener("resize", actualizar);
    vista?.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      vista?.removeEventListener("resize", actualizar);
      vista?.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, [avisoClaveId]);
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
        <form
          key={estado?.error || "inicial"}
          className="formulario"
          action={accion}
          onSubmit={(evento) => {
            if (clave.length > 0 && confirmar.length > 0 && clave !== confirmar) {
              evento.preventDefault();
              setAvisoClaveId((id) => id + 1);
              return;
            }
            setAvisoClaveId(0);
          }}
        >
          <div className="formulario__fila">
            <label className={claseCampo("nombre")}>
              Nombre
              <span className="formulario__control">
                <Icono className="formulario__icono">
                  <circle cx="12" cy="8" r="3" />
                  <path d="M6 19c1.2-2.6 3.2-4 6-4s4.8 1.4 6 4" />
                </Icono>
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
                <Icono className="formulario__icono">
                  <circle cx="12" cy="8" r="3" />
                  <path d="M6 19c1.2-2.6 3.2-4 6-4s4.8 1.4 6 4" />
                </Icono>
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
          <div className="formulario__fila">
            <label className="formulario__campo">
              Teléfono
              <span className="formulario__control">
                <Icono className="formulario__icono">
                  <path d="M8 4h3l1.2 3-1.8 1.1a12 12 0 0 0 5.5 5.5L17 12l3 1.2V16a2 2 0 0 1-2.2 2A16 16 0 0 1 6 7.2 2 2 0 0 1 8 4z" />
                </Icono>
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
                <Icono className="formulario__icono">
                  <rect x="4" y="6" width="16" height="12" rx="2" />
                  <path d="m4 8 8 6 8-6" />
                </Icono>
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
          </div>
          <div className="formulario__claves">
            <div className="formulario__fila">
              <label className={claseCampo("contrasena")}>
                Contraseña
                <span className="formulario__clave">
                  <Icono className="formulario__icono">
                    <rect x="6" y="11" width="12" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </Icono>
                  <input
                    name="contrasena"
                    type={tipoClave}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    onChange={(evento) => {
                      setClave(evento.target.value);
                      alEscribir("contrasena")(evento);
                    }}
                  />
                  <button
                    className="formulario__revelar"
                    type="button"
                    aria-label={visibles ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                    aria-pressed={visibles}
                    onClick={() => setVisibles((valor) => !valor)}
                  >
                    {visibles ? (
                      <Icono>
                        <path d="M3 3l18 18" />
                        <path d="M10.5 6.2A10 10 0 0 1 12 6c6 0 10 6 10 6a16 16 0 0 1-3.2 3.8M6.5 6.5C4 8 2 12 2 12a16 16 0 0 0 6.2 5.5" />
                        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      </Icono>
                    ) : (
                      <Icono>
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </Icono>
                    )}
                  </button>
                </span>
              </label>
              <label className={claseCampo("confirmar_contrasena")}>
                Confirmar contraseña
                <span className="formulario__control">
                  <Icono className="formulario__icono">
                    <rect x="6" y="11" width="12" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </Icono>
                  <input
                    name="confirmar_contrasena"
                    type={tipoClave}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    onChange={(evento) => {
                      setConfirmar(evento.target.value);
                      alEscribir("confirmar_contrasena")(evento);
                    }}
                  />
                </span>
              </label>
            </div>
            <div className="auth__requisitos-bloque">
              <p className="auth__requisitos-titulo">Requisitos contraseña:</p>
              <ul className="auth__requisitos" aria-live="polite">
                {REQUISITOS.map((item) => {
                  const ok = item.cumple(clave);
                  return (
                    <li
                      key={item.id}
                      className={ok ? "auth__requisito--ok" : undefined}
                    >
                      <span className="auth__requisito-check" aria-hidden="true">
                        ✓
                      </span>
                      <span>{item.texto}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <button
            className="formulario__enviar"
            type="submit"
            disabled={pendiente}
            aria-busy={pendiente}
            aria-label={pendiente ? "Creando cuenta" : undefined}
          >
            {pendiente ? (
              <SpinnerCarga size={22} etiqueta="Creando cuenta" />
            ) : (
              <>
                Crear cuenta
                <Icono>
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </Icono>
              </>
            )}
          </button>
        </form>
        <p className="auth__alta">
          Ya tenés una cuenta? <Link href="/ingreso">Iniciá sesión</Link>
        </p>
      </section>
      {estado?.error ? (
        <p className="auth__aviso" role="alert">
          <Icono size={16}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </Icono>
          {estado.error}
        </p>
      ) : null}
      {montado && avisoClaveId
        ? createPortal(
            <p
              key={avisoClaveId}
              className="auth__aviso auth__aviso--clave"
              role="alert"
              style={{ bottom: `calc(${avisoClaveBottom}px + env(safe-area-inset-bottom, 0px))` }}
            >
              <Icono size={16}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5" />
                <path d="M12 8h.01" />
              </Icono>
              Las contraseñas no coinciden.
            </p>,
            document.body
          )
        : null}
    </>
  );
}
