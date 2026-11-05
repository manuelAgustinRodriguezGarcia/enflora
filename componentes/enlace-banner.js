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

export function EnlaceBanner({ href, campanaId, children }) {
  useEffect(() => {
    registrar(campanaId, "impresion", tokenSesion());
  }, [campanaId]);

  return (
    <a
      className="banner-publicitario__enlace"
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => registrar(campanaId, "clic", tokenSesion())}
    >
      {children}
    </a>
  );
}
