"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CerrarSesion } from "@/componentes/cerrar-sesion";
import { EditorSeguimiento } from "@/componentes/editor-seguimiento";
import { FormularioPerfil } from "@/componentes/formulario-perfil";
import { InvitacionFeedback } from "@/componentes/invitacion-feedback";
import { PanelNotificaciones } from "@/componentes/panel-notificaciones";
import { PerfilGuardarFlotante } from "@/componentes/perfil-guardar-flotante";
import { SeccionClimaPerfil } from "@/componentes/perfil-clima";
import { PreferenciasFlora } from "@/componentes/preferencias-flora";
import { muestraEstadoNotificaciones } from "@/lib/perfil/notificaciones-visibles";

function esRedireccion(error) {
  return typeof error?.digest === "string" && error.digest.startsWith("NEXT_REDIRECT");
}

const CLAVE_SCROLL_PREFERENCIAS_FLORA = "enflora-scroll-preferencias-flora";

function consumirIrPreferenciasFloraDesdeChat() {
  try {
    const ir = sessionStorage.getItem(CLAVE_SCROLL_PREFERENCIAS_FLORA) === "1";
    if (ir) sessionStorage.removeItem(CLAVE_SCROLL_PREFERENCIAS_FLORA);
    return ir;
  } catch {
    return false;
  }
}

function irAClimaPerfil() {
  document.getElementById("clima")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function irArribaPerfil() {
  if (typeof window === "undefined") return;
  if (window.location.hash === "#clima") return;
  if (window.location.hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

function reforzarArribaPerfil() {
  irArribaPerfil();
  const id = requestAnimationFrame(() => {
    irArribaPerfil();
  });
  const t1 = window.setTimeout(irArribaPerfil, 0);
  const t2 = window.setTimeout(irArribaPerfil, 220);
  return () => {
    cancelAnimationFrame(id);
    window.clearTimeout(t1);
    window.clearTimeout(t2);
  };
}

export function PerfilVista({
  perfil,
  email,
  avatar = { url: "", expira: 0 },
  seguimiento = null,
  personalidadFlora = "cercana_natural",
  clima = null,
}) {
  const ruta = usePathname();
  const perfilRef = useRef(null);
  const seguimientoRef = useRef(null);
  const [sucioPerfil, setSucioPerfil] = useState(false);
  const [sucioSeguimiento, setSucioSeguimiento] = useState(false);

  const alSucioPerfil = useCallback((valor) => setSucioPerfil(Boolean(valor)), []);
  const alSucioSeguimiento = useCallback((valor) => setSucioSeguimiento(Boolean(valor)), []);

  const irPreferenciasFloraRef = useRef(null);
  if (irPreferenciasFloraRef.current === null) {
    irPreferenciasFloraRef.current = consumirIrPreferenciasFloraDesdeChat();
  }

  useLayoutEffect(() => {
    if (irPreferenciasFloraRef.current) return;
    irArribaPerfil();
  }, [ruta]);

  useEffect(() => {
    if (irPreferenciasFloraRef.current) {
      const nodo = document.getElementById("preferencias-flora");
      nodo?.scrollIntoView({ behavior: "smooth", block: "start" });
      return undefined;
    }

    if (window.location.hash === "#clima") {
      irAClimaPerfil();
      const id = requestAnimationFrame(irAClimaPerfil);
      const espera = window.setTimeout(irAClimaPerfil, 220);
      return () => {
        cancelAnimationFrame(id);
        window.clearTimeout(espera);
      };
    }

    return reforzarArribaPerfil();
  }, [ruta]);

  const sucio = sucioPerfil || sucioSeguimiento;

  async function guardar() {
    try {
      if (sucioSeguimiento) {
        const okSeguimiento = await seguimientoRef.current?.guardar();
        if (!okSeguimiento) return false;
      }
      if (sucioPerfil) {
        const okPerfil = await perfilRef.current?.guardar();
        if (!okPerfil) return false;
      }
      return true;
    } catch (error) {
      if (esRedireccion(error)) return true;
      return false;
    }
  }

  return (
    <section className="perfil" data-edicion-activa={sucio ? "true" : undefined}>
      <h1>Perfil</h1>
      <FormularioPerfil
        ref={perfilRef}
        perfil={perfil}
        email={email}
        avatar={avatar}
        onSucioChange={alSucioPerfil}
        idFormulario="formulario-perfil"
      />
      {seguimiento?.error ? <p>No se pudieron cargar las preferencias.</p> : null}
      {seguimiento && !seguimiento.error ? (
        <EditorSeguimiento
          ref={seguimientoRef}
          modo="edicion"
          encabezado="Elegí qué registrar"
          tipoInicial={perfil.tipo_seguimiento}
          acciones={seguimiento.acciones}
          parametros={seguimiento.parametros}
          opcionesIniciales={seguimiento.opciones}
          ocultarGuardar
          desplazarAlExpandir={false}
          idFormulario="formulario-seguimiento"
          onSucioChange={alSucioSeguimiento}
        />
      ) : null}
      <PreferenciasFlora personalidadInicial={personalidadFlora} />
      <SeccionClimaPerfil clima={clima} />
      {muestraEstadoNotificaciones(email) ? <PanelNotificaciones /> : null}
      <InvitacionFeedback />
      <PerfilGuardarFlotante visible={sucio} onGuardar={guardar} />
      <CerrarSesion />
    </section>
  );
}
