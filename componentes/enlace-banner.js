"use client";

import { useEffect } from "react";

const CLAVE = "enflora-publicidad-token";

function tokenSesion() {
  try {
    const actual = sessionStorage.getItem(CLAVE);
    if (typeof actual === "string" && /^[a-f0-9]{32}$/.test(actual)) return actual;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const nuevo = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(CLAVE, nuevo);
    return nuevo;
  } catch {
    return "";
  }
}

function registrar(campanaId, tipo, token) {
  if (!campanaId || !token) return;
  fetch("/api/publicidad/evento", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ campana: campanaId, tipo, token }),
    keepalive: true,
  }).catch(() => {});
}

export function medirCampana(campanaId, tipo) {
  registrar(campanaId, tipo, tokenSesion());
}

export function RegistroImpresion({ campanaId }) {
  useEffect(() => {
    medirCampana(campanaId, "impresion");
  }, [campanaId]);
  return null;
}

export function EnlaceBanner({ href, campanaId, children, externo = true, className = "banner-publicitario__enlace" }) {
  useEffect(() => {
    medirCampana(campanaId, "impresion");
  }, [campanaId]);

  return (
    <a
      className={className}
      href={href}
      target={externo ? "_blank" : undefined}
      rel={externo ? "noopener noreferrer sponsored" : undefined}
      onClick={() => medirCampana(campanaId, "clic")}
    >
      {children}
    </a>
  );
}
