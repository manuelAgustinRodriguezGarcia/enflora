import { EnlaceBoton } from "@/componentes/boton";

export function InvitacionFeedback() {
  return (
    <section className="invitacion-feedback" aria-labelledby="invitacion-feedback-titulo">
      <h2 id="invitacion-feedback-titulo">Mejoremos juntos</h2>
      <p>Si querés sugerir una mejora, reportar un error o solo dar tu feedback envianos un mensaje.</p>
      <EnlaceBoton href="/perfil/feedback" variante="secundario" className="boton--ancho">
        Enviar feedback
      </EnlaceBoton>
    </section>
  );
}
