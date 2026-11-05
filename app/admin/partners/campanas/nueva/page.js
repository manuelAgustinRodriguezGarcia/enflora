import { FormularioCampana } from "@/componentes/admin/partners-formularios";
import { AvisoPartners, MarcoPartners } from "@/componentes/admin/partners-marco";
import { leerComerciosPartners } from "@/lib/admin/partners";
import { interpretarComercios } from "@/lib/admin/partners-reglas";
import { credencialPartners } from "../../acceso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nueva campaña", robots: { index: false, follow: false } };

export default async function PaginaNuevaCampana() {
  const credencial = await credencialPartners();
  const consulta = interpretarComercios({}).consulta;
  const comercios = await leerComerciosPartners(credencial, consulta);
  return (
    <MarcoPartners titulo="Nueva campaña" intro="El borrador no se publica. La activación es un paso aparte." aviso={AvisoPartners(comercios)}>
      {comercios.estado === "listo" ? <FormularioCampana comercios={comercios.lista.filas} /> : null}
    </MarcoPartners>
  );
}
