import { FormularioRegistro } from "@/componentes/formulario-registro";
import { MarcoAuth } from "@/componentes/marco-auth";

export const metadata = {
  title: "Crear cuenta",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PaginaRegistro() {
  return (
    <MarcoAuth fondo="registro">
      <FormularioRegistro />
    </MarcoAuth>
  );
}
