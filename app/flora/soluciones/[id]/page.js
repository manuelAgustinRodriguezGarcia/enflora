import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatDetalleVista, SolucionDetalleVista } from "@/componentes/flora/soluciones-vista";
import { enriquecerMensajesChatGuardado } from "@/lib/flora-chats-enriquecer";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export async function generateMetadata({ params }) {
  return { title: "Chat guardado · Flora" };
}

export default async function PaginaDetalleSolucion({ params }) {
  if (!configuracionLista()) {
    return <p className="flora-soluciones__aviso">Falta la configuración de Supabase.</p>;
  }

  const usuario = await obtenerSesionRapida();
  if (!usuario) redirect("/ingreso");

  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: chat, error: chatError } = await supabase
    .from("flora_chats_guardados")
    .select(
      "id, titulo, primera_pregunta, mensajes, referencias, cantidad_mensajes, clave_sesion, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!chatError && chat) {
    const mensajes = await enriquecerMensajesChatGuardado(supabase, chat.mensajes || []);
    return <ChatDetalleVista chat={{ ...chat, mensajes }} />;
  }

  const { data, error } = await supabase
    .from("flora_soluciones")
    .select(
      "id, titulo, pregunta, respuesta, referencias, unidad_cultivo_id, planta_id, fecha_respuesta, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return (
      <p className="flora-soluciones__aviso">
        Chat no encontrado.{" "}
        <Link href="/flora/soluciones">Volver al listado</Link>
      </p>
    );
  }

  return <SolucionDetalleVista solucion={data} />;
}
