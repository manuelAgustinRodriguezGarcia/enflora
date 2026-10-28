import { redirect } from "next/navigation";
import { ChatFlora } from "@/componentes/flora/chat-flora";
import { geminiConfigurado } from "@/lib/flora-chat-config";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Flora",
  description: "Hablá con Flora, la asistente de ENFLORA, sobre tus cultivos y registros.",
};

export default async function PaginaFlora() {
  if (!configuracionLista()) {
    return <p className="flora-chat-app__aviso">Falta la configuración de Supabase.</p>;
  }

  const usuario = await obtenerSesionRapida();
  if (!usuario) {
    redirect("/ingreso");
  }

  const geminiListo = geminiConfigurado();

  return (
    <section className="flora-chat-app-pagina" aria-labelledby="flora-titulo-pagina">
      <h2 id="flora-titulo-pagina" className="flora-chat-app__sr">
        Chat con Flora
      </h2>
      {!geminiListo ? (
        <p className="flora-chat-app__aviso" role="status">
          Flora todavía no está activa en este entorno. Configurá{" "}
          <code>GEMINI_API_KEY</code> en las variables de entorno del servidor.
        </p>
      ) : null}
      <ChatFlora />
    </section>
  );
}
