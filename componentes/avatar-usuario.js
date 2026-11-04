"use client";

import { useEffect, useRef, useState } from "react";
import { renovarUrlAvatar } from "@/app/perfil/acciones-avatar";
import { EVENTO_AVATAR, MARGEN_RENOVACION_AVATAR_MS } from "@/lib/perfil/avatar";

let renovacionCompartida = null;

function pedirUrlAvatar() {
  if (!renovacionCompartida) {
    renovacionCompartida = renovarUrlAvatar().finally(() => {
      renovacionCompartida = null;
    });
  }
  return renovacionCompartida;
}

export function publicarAvatar(detalle) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_AVATAR, { detail: detalle }));
}

export function AvatarUsuario({ url = "", expira = 0, alt = "", children }) {
  const [firma, setFirma] = useState({ url, expira });
  const [vistaProps, setVistaProps] = useState({ url, expira });
  const [cargada, setCargada] = useState(false);
  const firmaRef = useRef(firma);
  const fallos = useRef(0);
  const renovando = useRef(false);
  const renovarRef = useRef(async () => {});

  if (vistaProps.url !== url || vistaProps.expira !== expira) {
    setVistaProps({ url, expira });
    setFirma({ url, expira });
    setCargada(false);
  }

  useEffect(() => {
    firmaRef.current = firma;
  }, [firma]);

  useEffect(() => {
    fallos.current = 0;
  }, [url, expira]);

  useEffect(() => {
    function alPublicar(evento) {
      const detalle = evento.detail || {};
      fallos.current = 0;
      setCargada(false);
      setFirma({ url: detalle.url || "", expira: detalle.expira || 0 });
    }
    window.addEventListener(EVENTO_AVATAR, alPublicar);
    return () => window.removeEventListener(EVENTO_AVATAR, alPublicar);
  }, []);

  useEffect(() => {
    if (!firma.url) return undefined;
    const limite = Number(firma.expira);
    if (!Number.isFinite(limite) || limite <= 0) return undefined;
    if (limite > Date.now() + 24 * 60 * 60 * 1000) return undefined;
    const espera = Math.max(0, limite - Date.now() - MARGEN_RENOVACION_AVATAR_MS);
    const id = window.setTimeout(() => {
      renovarRef.current();
    }, espera);
    return () => window.clearTimeout(id);
  }, [firma.url, firma.expira]);

  useEffect(() => {
    renovarRef.current = renovar;
  });

  async function renovar() {
    if (renovando.current || fallos.current > 1) return;
    renovando.current = true;
    try {
      const fresco = await pedirUrlAvatar();
      if (!fresco?.url || fresco.url === firmaRef.current.url) {
        fallos.current += 1;
        if (fallos.current > 1) setFirma({ url: "", expira: 0 });
        return;
      }
      fallos.current = 0;
      setCargada(false);
      setFirma({ url: fresco.url, expira: fresco.expira || 0 });
    } catch {
      fallos.current += 1;
      if (fallos.current > 1) setFirma({ url: "", expira: 0 });
    } finally {
      renovando.current = false;
    }
  }

  const mostrarFoto = Boolean(firma.url) && cargada;

  return (
    <>
      {firma.url ? (
        // Las URLs firmadas vencen y la vista previa es un blob local: no pasan por el optimizador.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={firma.url}
          alt={alt}
          data-lista={mostrarFoto ? "true" : "false"}
          decoding="async"
          onLoad={() => setCargada(true)}
          onError={() => {
            setCargada(false);
            renovar();
          }}
        />
      ) : null}
      {mostrarFoto ? null : children}
    </>
  );
}
