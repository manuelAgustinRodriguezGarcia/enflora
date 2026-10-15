"use client";

import { useCallback, useRef, useState } from "react";
import { CerrarSesion } from "@/componentes/cerrar-sesion";
import { EditorSeguimiento } from "@/componentes/editor-seguimiento";
import { FormularioPerfil } from "@/componentes/formulario-perfil";
import { PerfilGuardarFlotante } from "@/componentes/perfil-guardar-flotante";

function esRedireccion(error) {
  return typeof error?.digest === "string" && error.digest.startsWith("NEXT_REDIRECT");
}

export function PerfilVista({
  perfil,
  email,
  seguimiento = null,
}) {
  const perfilRef = useRef(null);
  const seguimientoRef = useRef(null);
  const [sucioPerfil, setSucioPerfil] = useState(false);
  const [sucioSeguimiento, setSucioSeguimiento] = useState(false);

  const alSucioPerfil = useCallback((valor) => setSucioPerfil(Boolean(valor)), []);
  const alSucioSeguimiento = useCallback((valor) => setSucioSeguimiento(Boolean(valor)), []);

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
    <section className="perfil">
      <h1>Perfil</h1>
      <FormularioPerfil
        ref={perfilRef}
        perfil={perfil}
        email={email}
        onSucioChange={alSucioPerfil}
        idFormulario="formulario-perfil"
      />
      {seguimiento?.error ? <p>No se pudieron cargar las preferencias.</p> : null}
      {seguimiento && !seguimiento.error ? (
        <EditorSeguimiento
          ref={seguimientoRef}
          modo="edicion"
          encabezado="Seguimiento"
          tipoInicial={perfil.tipo_seguimiento}
          acciones={seguimiento.acciones}
          parametros={seguimiento.parametros}
          opcionesIniciales={seguimiento.opciones}
          ocultarGuardar
          idFormulario="formulario-seguimiento"
          onSucioChange={alSucioSeguimiento}
        />
      ) : null}
      <PerfilGuardarFlotante visible={sucio} onGuardar={guardar} />
      <CerrarSesion />
    </section>
  );
}
