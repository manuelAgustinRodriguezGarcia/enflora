"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useActionState } from "react";
import { guardarPerfil } from "@/app/perfil/acciones";

function esRedireccion(error) {
  return typeof error?.digest === "string" && error.digest.startsWith("NEXT_REDIRECT");
}

function valoresDesde(perfil, email, estado) {
  return {
    nombre: estado?.nombre ?? perfil?.nombre ?? "",
    apellido: estado?.apellido ?? perfil?.apellido ?? "",
    telefono: estado?.telefono ?? perfil?.telefono ?? "",
    nombreUsuario: estado?.nombreUsuario ?? perfil?.nombre_usuario ?? "",
    email: email || "",
  };
}

export const FormularioPerfil = forwardRef(function FormularioPerfil(
  { perfil, email, onSucioChange, idFormulario = "formulario-perfil" },
  ref,
) {
  const formRef = useRef(null);
  const [estado, accion] = useActionState(guardarPerfil, null);
  const [errorLocal, setErrorLocal] = useState("");
  const limiteAlcanzado = Boolean(perfil && perfil.cambios_nombre_usuario >= 2);
  const base = valoresDesde(perfil, email, null);
  const [valores, setValores] = useState(() => valoresDesde(perfil, email, estado));

  useEffect(() => {
    if (!estado?.ok && !estado?.error) return;
    setValores(valoresDesde(perfil, email, estado));
    if (estado?.error) setErrorLocal(estado.error);
  }, [estado, perfil, email]);

  useEffect(() => {
    const sucio =
      valores.nombre !== base.nombre ||
      valores.apellido !== base.apellido ||
      valores.telefono !== base.telefono ||
      valores.nombreUsuario !== base.nombreUsuario;
    onSucioChange?.(sucio);
  }, [valores, base.nombre, base.apellido, base.telefono, base.nombreUsuario, onSucioChange]);

  useEffect(() => {
    if (estado?.ok) onSucioChange?.(false);
  }, [estado?.ok, onSucioChange]);

  useImperativeHandle(ref, () => ({
    async guardar() {
      const formulario = formRef.current;
      if (!formulario) return false;
      setErrorLocal("");
      const datos = new FormData(formulario);
      try {
        const resultado = await guardarPerfil(null, datos);
        if (resultado?.error) {
          setErrorLocal(resultado.error);
          setValores(valoresDesde(perfil, email, resultado));
          return false;
        }
        onSucioChange?.(false);
        return true;
      } catch (error) {
        if (esRedireccion(error)) {
          onSucioChange?.(false);
          throw error;
        }
        setErrorLocal("No se pudo guardar el perfil.");
        return false;
      }
    },
  }));

  function alCambiar(campo) {
    return (evento) => {
      setValores((actual) => ({ ...actual, [campo]: evento.target.value }));
    };
  }

  return (
    <form
      ref={formRef}
      id={idFormulario}
      className="formulario"
      action={accion}
      onSubmit={(evento) => evento.preventDefault()}
    >
      {errorLocal || estado?.error ? (
        <p className="formulario__error">{errorLocal || estado?.error}</p>
      ) : null}
      <input type="hidden" name="perfil_existe" value={perfil ? "si" : "no"} />
      <div className="perfil__avatar">
        <div className="perfil__avatar-marco" aria-hidden="true">
          <span className="perfil__avatar-inicial">
            {(valores.nombreUsuario || valores.nombre || "?").slice(0, 1).toUpperCase()}
          </span>
        </div>
        <p className="perfil__avatar-texto">Foto de perfil</p>
      </div>
      {perfil ? (
        <label className="formulario__campo">
          Nombre de usuario
          <input
            name="nombre_usuario"
            type="text"
            value={valores.nombreUsuario}
            readOnly={limiteAlcanzado}
            onChange={alCambiar("nombreUsuario")}
          />
        </label>
      ) : null}
      {limiteAlcanzado ? <p>Alcanzaste el límite de cambios de nombre de usuario.</p> : null}
      <label className="formulario__campo">
        Email
        <input
          className="perfil__email-input"
          type="email"
          value={valores.email}
          readOnly
          tabIndex={-1}
          aria-readonly="true"
        />
      </label>
      <label className="formulario__campo">
        Nombre
        <input name="nombre" type="text" value={valores.nombre} onChange={alCambiar("nombre")} />
      </label>
      <label className="formulario__campo">
        Apellido
        <input name="apellido" type="text" value={valores.apellido} onChange={alCambiar("apellido")} />
      </label>
      <label className="formulario__campo">
        Teléfono
        <input name="telefono" type="text" value={valores.telefono} onChange={alCambiar("telefono")} />
      </label>
    </form>
  );
});
