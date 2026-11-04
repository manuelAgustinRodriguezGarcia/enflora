import { redirect } from "next/navigation";
import { FormularioFeedback } from "@/componentes/feedback/formulario-feedback";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Enviar feedback",
  robots: { index: false, follow: false },
};

export default async function PaginaFeedback() {
  if (!configuracionLista()) {
    return <p>Falta la configuración de Supabase.</p>;
  }

  const user = await obtenerSesionRapida();
  if (!user || user.esAnonimo) redirect("/ingreso");

  return <FormularioFeedback />;
}
