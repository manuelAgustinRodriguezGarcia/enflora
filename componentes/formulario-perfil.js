"use client";

import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useActionState } from "react";
import { guardarPerfil, revisarNombreUsuario } from "@/app/perfil/acciones";
import { FotoPerfil } from "@/componentes/foto-perfil";
import { MENSAJE_USUARIO_OCUPADO, normalizarNombreUsuario } from "@/lib/perfil/nombre-usuario";
import {
  MENSAJE_TELEFONO_OBLIGATORIO,
  PLACEHOLDER_TELEFONO,
  intentaBorrarTelefono,
} from "@/lib/perfil/telefono";

const MENSAJE_LIMITE_NOMBRE = "Alcanzaste el límite de cambios de nombre de usuario.";

function esRedireccion(error) {
  return typeof error?.digest === "string" && error.digest.startsWith("NEXT_REDIRECT");
}

function FlechaLimiteNombre() {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className="perfil__limite-flecha-relleno"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className="perfil__limite-flecha-borde"
      />
    </svg>
  );
}

function AvisoLimiteNombreUsuario() {
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        className="perfil__limite-info"
        aria-label="Información sobre el límite de cambios de nombre de usuario"
      >
        <Info size={15} strokeWidth={2} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="perfil__limite-positioner"
          side="bottom"
          align="center"
          sideOffset={8}
        >
          <Popover.Popup className="perfil__limite-popup">
            <Popover.Arrow className="perfil__limite-flecha">
              <FlechaLimiteNombre />
            </Popover.Arrow>
            <p>{MENSAJE_LIMITE_NOMBRE}</p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
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
  const [errorTelefono, setErrorTelefono] = useState("");
  const [usuarioOcupado, setUsuarioOcupado] = useState(false);
  const [sugerenciaUsuario, setSugerenciaUsuario] = useState("");
  const limiteAlcanzado = Boolean(perfil && perfil.cambios_nombre_usuario >= 2);
  const nombreGuardado = perfil?.nombre_usuario || "";
  const base = valoresDesde(perfil, email, null);
  const [valores, setValores] = useState(() => valoresDesde(perfil, email, estado));

  useEffect(() => {
    if (!estado?.ok && !estado?.error) return;
    setValores(valoresDesde(perfil, email, estado));
    if (estado?.error === MENSAJE_TELEFONO_OBLIGATORIO) {
      setErrorTelefono(estado.error);
      setErrorLocal("");
      return;
    }
    setErrorTelefono("");
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
      if (intentaBorrarTelefono(perfil?.telefono, datos.get("telefono"))) {
        setErrorTelefono(MENSAJE_TELEFONO_OBLIGATORIO);
        return false;
      }
      setErrorTelefono("");
      try {
        const resultado = await guardarPerfil(null, datos);
        if (resultado?.error) {
          setValores(valoresDesde(perfil, email, resultado));
          if (resultado.error === MENSAJE_TELEFONO_OBLIGATORIO) {
            setErrorTelefono(resultado.error);
            return false;
          }
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

  function alCambiarTelefono(evento) {
    const telefono = evento.target.value;
    setValores((actual) => ({ ...actual, telefono }));
    setErrorTelefono(intentaBorrarTelefono(perfil?.telefono, telefono) ? MENSAJE_TELEFONO_OBLIGATORIO : "");
  }

  return (
    <form
      ref={formRef}
      id={idFormulario}
      className="formulario"
      action={accion}
      onSubmit={(evento) => evento.preventDefault()}
    >
      {errorLocal || (estado?.error && estado.error !== MENSAJE_TELEFONO_OBLIGATORIO) ? (
        <p className="formulario__error">{errorLocal || estado.error}</p>
      ) : null}
      <input type="hidden" name="perfil_existe" value={perfil ? "si" : "no"} />
      <FotoPerfil
        avatar={avatar}
        editable={Boolean(perfil)}
        inicial={(valores.nombreUsuario || valores.nombre || "?").slice(0, 1).toUpperCase()}
      />
      {perfil ? (
        <div className="formulario__campo">
          <span className="perfil__usuario-etiqueta">
            <label htmlFor="perfil-nombre-usuario">Nombre de usuario</label>
            {limiteAlcanzado ? <AvisoLimiteNombreUsuario /> : null}
          </span>
          <input
            id="perfil-nombre-usuario"
            name="nombre_usuario"
            type="text"
            value={valores.nombreUsuario}
            readOnly={limiteAlcanzado}
            aria-invalid={usuarioOcupado || undefined}
            aria-describedby={usuarioOcupado ? "perfil-usuario-ocupado" : undefined}
            onChange={alCambiar("nombreUsuario")}
          />
        </div>
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
      <label className={`formulario__campo${errorTelefono ? " formulario__campo--falta" : ""}`}>
        Teléfono
        <input
          name="telefono"
          type="text"
          inputMode="tel"
          autoComplete="tel"
          placeholder={PLACEHOLDER_TELEFONO}
          value={valores.telefono}
          aria-invalid={errorTelefono ? true : undefined}
          aria-describedby={errorTelefono ? "perfil-telefono-error" : undefined}
          onChange={alCambiarTelefono}
        />
      </label>
      {errorTelefono ? (
        <p id="perfil-telefono-error" className="formulario__error" role="alert">
          {errorTelefono}
        </p>
      ) : null}
    </form>
  );
});
