"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useActionState } from "react";
import { guardarPerfil, revisarNombreUsuario } from "@/app/perfil/acciones";
import { FotoPerfil } from "@/componentes/foto-perfil";
import { MENSAJE_USUARIO_OCUPADO, normalizarNombreUsuario } from "@/lib/perfil/nombre-usuario";

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
  { perfil, email, avatar = { url: "", expira: 0 }, onSucioChange, idFormulario = "formulario-perfil" },
  ref,
) {
  const formRef = useRef(null);
  const [estado, accion] = useActionState(guardarPerfil, null);
  const [errorLocal, setErrorLocal] = useState("");
  const [usuarioOcupado, setUsuarioOcupado] = useState(false);
  const [sugerenciaUsuario, setSugerenciaUsuario] = useState("");
  const limiteAlcanzado = Boolean(perfil && perfil.cambios_nombre_usuario >= 2);
  const nombreGuardado = perfil?.nombre_usuario || "";
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

  useEffect(() => {
    if (!perfil || limiteAlcanzado) return undefined;
    const consultado = normalizarNombreUsuario(valores.nombreUsuario);
    const propio = normalizarNombreUsuario(nombreGuardado);
    setUsuarioOcupado(false);
    setSugerenciaUsuario("");
    if (!consultado || consultado === propio) return undefined;

    let vigente = true;
    const timer = setTimeout(async () => {
      const resultado = await revisarNombreUsuario(consultado);
      if (!vigente || resultado?.consultado !== consultado) return;
      if (resultado.disponible) {
        setUsuarioOcupado(false);
        setSugerenciaUsuario("");
        return;
      }
      setUsuarioOcupado(true);
      setSugerenciaUsuario(resultado.sugerencia || "");
    }, 400);

    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [valores.nombreUsuario, perfil, limiteAlcanzado, nombreGuardado]);

  useImperativeHandle(ref, () => ({
    async guardar() {
      const formulario = formRef.current;
      if (!formulario) return false;
      setErrorLocal("");
      const datos = new FormData(formulario);
      try {
        const resultado = await guardarPerfil(null, datos);
        if (resultado?.error) {
          setValores(valoresDesde(perfil, email, resultado));
          if (resultado.error === MENSAJE_USUARIO_OCUPADO) {
            setUsuarioOcupado(true);
            setSugerenciaUsuario(resultado.sugerencia || "");
            return false;
          }
          setErrorLocal(resultado.error);
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
      <FotoPerfil
        avatar={avatar}
        editable={Boolean(perfil)}
        inicial={(valores.nombreUsuario || valores.nombre || "?").slice(0, 1).toUpperCase()}
      />
      {perfil ? (
        <label className="formulario__campo">
          Nombre de usuario
          <input
            name="nombre_usuario"
            type="text"
            value={valores.nombreUsuario}
            readOnly={limiteAlcanzado}
            aria-invalid={usuarioOcupado || undefined}
            aria-describedby={usuarioOcupado ? "perfil-usuario-ocupado" : undefined}
            onChange={alCambiar("nombreUsuario")}
          />
        </label>
      ) : null}
      {usuarioOcupado ? (
        <div className="perfil__usuario-aviso">
          <p id="perfil-usuario-ocupado" className="formulario__error" role="alert">
            {MENSAJE_USUARIO_OCUPADO}
          </p>
          {sugerenciaUsuario ? (
            <button
              type="button"
              className="perfil__sugerencia"
              onClick={() => {
                setValores((actual) => ({ ...actual, nombreUsuario: sugerenciaUsuario }));
                setUsuarioOcupado(false);
                setSugerenciaUsuario("");
              }}
            >
              {sugerenciaUsuario}
            </button>
          ) : null}
        </div>
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
