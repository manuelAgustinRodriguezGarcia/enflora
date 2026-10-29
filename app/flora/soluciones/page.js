import { redirect } from "next/navigation";
import { SolucionesVista } from "@/componentes/flora/soluciones-vista";
import {
  chatComoItemListado,
  solucionLegacyComoItemListado,
} from "@/lib/flora-chats-guardados";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Chats guardados · Flora",
  description: "Biblioteca privada de conversaciones guardadas con Flora.",
};

export default async function PaginaListaSoluciones() {
  if (!configuracionLista()) {
    return <p className="flora-soluciones__aviso">Falta la configuración de Supabase.</p>;
  }

  const usuario = await obtenerSesionRapida();
  if (!usuario) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const [chatsRes, solucionesRes] = await Promise.all([
    supabase
      .from("flora_chats_guardados")
      .select("id, titulo, primera_pregunta, cantidad_mensajes, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("flora_soluciones")
      .select("id, titulo, pregunta, respuesta, fecha_respuesta")
      .order("fecha_respuesta", { ascending: false })
      .limit(200),
  ]);

  if (chatsRes.error && solucionesRes.error) {
    return <p className="flora-soluciones__aviso">No se pudieron cargar los chats guardados.</p>;
  }

  const items = [
    ...(chatsRes.data || []).map(chatComoItemListado),
    ...(solucionesRes.data || []).map(solucionLegacyComoItemListado),
  ];

  return (
    <section className="flora-soluciones-pagina" aria-labelledby="soluciones-titulo">
      <SolucionesVista items={items} />
    </section>
  );
}
