"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { enviarFeedback } from "@/app/perfil/feedback/acciones";
import { aceptarEnvio, CATEGORIAS_FEEDBACK, LIMITE_MENSAJE_FEEDBACK } from "@/lib/feedback/reglas";

export function FormularioFeedback() {
  const envio = useRef(false);
  const [estado, accion, pendiente] = useActionState(enviarFeedback, null);
  const [reabierto, setReabierto] = useState(null);
  const [categoria, setCategoria] = useState("sugerencia");
  const [mensaje, setMensaje] = useState("");
  const [errorVisto, setErrorVisto] = useState("");
  const errorActual = estado && !estado.ok ? `${estado.codigo}\n${estado.categoria}\n${estado.mensaje}` : "";

  if (errorActual && errorActual !== errorVisto) {
    setErrorVisto(errorActual);
    setCategoria(estado.categoria || "");
    setMensaje(estado.mensaje || "");
  }

  useEffect(() => {
    envio.current = false;
  }, [estado]);

  const exito = estado?.ok === true && reabierto !== estado;
  const largo = mensaje.trim().length;

  function alEnviar(evento) {
    if (!aceptarEnvio({ pendiente, enCurso: envio.current })) {
      evento.preventDefault();
      return;
    }
    envio.current = true;
  }

  return (
    <section className="feedback">
      <h1>Ayudanos a mejorar Enflora.</h1>
      <p className="feedback__intro">
        Es para la aplicación: una mejora, un error de Enflora o una opinión. Un problema de una planta se registra en
        el cultivo, no acá.
      </p>
      {exito ? (
        <div className="feedback__exito">
          <p role="status">¡Gracias por ayudarnos a mejorar Enflora! Leemos cada sugerencia.</p>
          <p>
            <button
              type="button"
              className="formulario__olvido"
              onClick={() => {
                setReabierto(estado);
                setMensaje("");
              }}
            >
              Enviar otro comentario
            </button>
          </p>
          <p>
            <Link href="/perfil">Volver al perfil</Link>
          </p>
        </div>
      ) : (
        <form className="formulario" action={accion} onSubmit={alEnviar}>
          {estado?.error ? (
            <p className="formulario__error" role="alert">
              {estado.error}
            </p>
          ) : null}
          <fieldset className="feedback__opciones">
            <legend>Categoría</legend>
            {CATEGORIAS_FEEDBACK.map((item) => (
              <label key={item.id} className="feedback__opcion">
                <input
                  type="radio"
                  name="categoria"
                  value={item.id}
                  checked={categoria === item.id}
                  onChange={() => setCategoria(item.id)}
                  required
                />
                <span>{item.etiqueta}</span>
              </label>
            ))}
          </fieldset>
          <label className="formulario__campo" htmlFor="feedback-mensaje">
            Mensaje
            <textarea
              id="feedback-mensaje"
              name="mensaje"
              value={mensaje}
              onChange={(evento) => setMensaje(evento.target.value)}
              required
              minLength={10}
              maxLength={LIMITE_MENSAJE_FEEDBACK}
              rows={6}
              autoComplete="off"
              aria-invalid={estado?.error ? true : undefined}
              aria-describedby="feedback-ayuda feedback-contador"
            />
          </label>
          <p id="feedback-ayuda" className="feedback__ayuda">
            Entre 10 y 2000 caracteres. No hace falta contar datos del cultivo.
          </p>
          <p id="feedback-contador" className="feedback__contador" aria-live="polite">
            {largo} / {LIMITE_MENSAJE_FEEDBACK}
          </p>
          <button className="formulario__enviar" type="submit" disabled={pendiente} aria-busy={pendiente || undefined}>
            {pendiente ? "Enviando…" : "Enviar feedback"}
          </button>
        </form>
      )}
    </section>
  );
}
