import Link from "next/link";
import { Boton } from "@/componentes/boton";

export function ErrorRecuperacionChatFlora({ mensaje, onReintentar, reintentando = false }) {
  return (
    <div className="flora-chat-app__recuperacion-error" role="alert">
      <p className="flora-chat-app__recuperacion-error-texto">{mensaje}</p>
      <div className="flora-chat-app__recuperacion-error-acciones">
        <Boton type="button" onClick={onReintentar} disabled={reintentando}>
          {reintentando ? "Reintentando…" : "Reintentar"}
        </Boton>
        <Link href="/flora/soluciones" className="flora-chat-app__recuperacion-volver">
          Volver a chats guardados
        </Link>
      </div>
    </div>
  );
}
