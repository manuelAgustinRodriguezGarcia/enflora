import { FormularioRegistro } from "@/componentes/formulario-registro";
import { MarcoAuth } from "@/componentes/marco-auth";

export default function PaginaRegistro() {
  return (
    <MarcoAuth fondo="registro">
      <FormularioRegistro />
    </MarcoAuth>
  );
}
