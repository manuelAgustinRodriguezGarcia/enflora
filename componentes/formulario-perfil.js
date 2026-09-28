"use client";

import { useActionState } from "react";
import { guardarPerfil } from "@/app/perfil/acciones";

export function FormularioPerfil({ perfil, email }) {
  const [estado, accion, pendiente] = useActionState(guardarPerfil, null);
  const limiteAlcanzado = Boolean(perfil && perfil.cambios_nombre_usuario >= 2);
  const nombre = estado?.nombre ?? perfil?.nombre ?? "";
  const apellido = estado?.apellido ?? perfil?.apellido ?? "";
  const telefono = estado?.telefono ?? perfil?.telefono ?? "";
  const nombreUsuario = estado?.nombreUsuario ?? perfil?.nombre_usuario ?? "";

  return (
    <form key={estado?.error || "inicial"} className="formulario" action={accion}>
      {estado?.error ? <p className="formulario__error">{estado.error}</p> : null}
      {email ? <p>Email: {email}</p> : null}
      <input type="hidden" name="perfil_existe" value={perfil ? "si" : "no"} />
      <label className="formulario__campo">
        Nombre
        <input name="nombre" type="text" defaultValue={nombre} />
      </label>
      <label className="formulario__campo">
        Apellido
        <input name="apellido" type="text" defaultValue={apellido} />
      </label>
      <label className="formulario__campo">
        Teléfono
        <input name="telefono" type="text" defaultValue={telefono} />
      </label>
      {perfil ? (
        <label className="formulario__campo">
          Nombre de usuario
          <input
            name="nombre_usuario"
            type="text"
            defaultValue={nombreUsuario}
            readOnly={limiteAlcanzado}
          />
        </label>
      ) : null}
      {limiteAlcanzado ? <p>Alcanzaste el límite de cambios de nombre de usuario.</p> : null}
      <button type="submit" disabled={pendiente}>
        Guardar
      </button>
    </form>
  );
}
