import { FormularioComercio } from "@/componentes/admin/partners-formularios";
import { MarcoPartners } from "@/componentes/admin/partners-marco";
import { credencialPartners } from "../../acceso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo comercio", robots: { index: false, follow: false } };

export default async function PaginaNuevoComercio() {
  await credencialPartners();
  return (
    <MarcoPartners titulo="Nuevo comercio" intro="Queda pendiente de aprobación. No se elimina información comercial desde esta pantalla.">
      <FormularioComercio />
    </MarcoPartners>
  );
}
