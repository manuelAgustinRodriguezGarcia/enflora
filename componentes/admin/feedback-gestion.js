"use client";

import { useActionState, useEffect, useRef } from "react";
import { guardarGestionFeedback } from "@/app/admin/feedback/acciones";
import { aceptarEnvio, ESTADOS_FEEDBACK, LIMITE_NOTA_FEEDBACK, PRIORIDADES_FEEDBACK } from "@/lib/feedback/reglas";

export function GestionFeedback({ feedback }) {
  const envio = useRef(false);
  const [estado, accion, pendiente] = useActionState(guardarGestionFeedback, null);

  useEffect(() => {
    envio.current = false;
  }, [estado]);

  function alEnviar(evento) {
    if (!aceptarEnvio({ pendiente, enCurso: envio.current })) {
      evento.preventDefault();
    } else {
      envio.current = true;
    }
  }

  return (
    <form
      key={`${feedback.actualizadoEn}:${feedback.estado}:${feedback.prioridad}:${feedback.nota || ""}`}
      className="admin-feedback__gestion"
      action={accion}
      onSubmit={alEnviar}
    >
      <h2>Gestión</h2>
      {estado?.error ? (
        <p className="admin-dash__aviso admin-dash__aviso--bloque" role="alert">
          {estado.error}
        </p>
      ) : null}
      {estado?.ok ? (
        <p role="status">{estado.cambio ? "Cambios guardados." : "No había cambios nuevos."}</p>
      ) : null}
      <input type="hidden" name="id" value={feedback.id} />
      <label className="admin-planes__campo">
        <span>Estado</span>
        <select name="estado" defaultValue={feedback.estado}>
          {ESTADOS_FEEDBACK.map((item) => (
            <option key={item.id} value={item.id}>
              {item.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-planes__campo">
        <span>Prioridad</span>
        <select name="prioridad" defaultValue={feedback.prioridad}>
          {PRIORIDADES_FEEDBACK.map((item) => (
            <option key={item.id} value={item.id}>
              {item.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-planes__campo" htmlFor="feedback-nota-admin">
        <span>Nota interna</span>
        <textarea
          id="feedback-nota-admin"
          name="nota_admin"
          defaultValue={feedback.nota || ""}
          maxLength={LIMITE_NOTA_FEEDBACK}
          rows={5}
          autoComplete="off"
        />
      </label>
      <p className="admin-planes__contexto">La nota solo la ve el personal con permiso de feedback.</p>
      <button className="admin-dash__actualizar" type="submit" disabled={pendiente} aria-busy={pendiente || undefined}>
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
