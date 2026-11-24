// La posesión de la instalación es el endpoint que el navegador tiene en
// pushManager. La identidad es la sesión que ve el servidor. Las dos hacen falta
// para asociar un recordatorio privado. Una suscripción anónima de la landing
// se conserva si no hay sesión.

export function decisionVinculo({ sesion, activa, vinculada }) {
  if (activa !== true) return { accion: "inactiva" };
  if (sesion !== true) return { accion: "anonima" };
  if (vinculada === true) return { accion: "confirmar" };
  return { accion: "vincular" };
}

export function resultadoTrasGuardar({ guardado, verificado }) {
  if (!guardado) return { estado: "sin-vincular", registro: "sin-vincular", temporal: true };
  if (verificado?.sesion !== true) {
    return { estado: "activado", registro: "sin-vincular", temporal: false };
  }
  if (verificado.activa === true && verificado.vinculada === true) {
    return { estado: "activado", registro: "vinculada", temporal: false };
  }
  return { estado: "sin-vincular", registro: "sin-vincular", temporal: true };
}

// Una sesión autenticada que presenta esta instalación reemplaza al dueño anterior.
// Un pedido sin sesión no se apropia de la fila ni se la quita a quien ya la tiene.
export function usuarioParaSuscripcion(usuarioId, previoUsuarioId) {
  if (typeof usuarioId === "string" && usuarioId) return usuarioId;
  if (typeof previoUsuarioId === "string" && previoUsuarioId) return previoUsuarioId;
  return null;
}

export function puedeDesvincular(duenoId, usuarioId) {
  return typeof usuarioId === "string" && usuarioId.length > 0 && duenoId === usuarioId;
}
