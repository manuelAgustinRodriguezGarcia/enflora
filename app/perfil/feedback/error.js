"use client";

export default function ErrorFeedback({ reset }) {
  return (
    <section className="feedback">
      <h1>Ayudanos a mejorar Enflora.</h1>
      <p className="formulario__error" role="alert">
        No pudimos abrir el formulario.
      </p>
      <button className="formulario__enviar" type="button" onClick={() => reset()}>
        Reintentar
      </button>
    </section>
  );
}
