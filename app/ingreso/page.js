import { FormularioEntrar } from "@/componentes/formulario-entrar";
import { MarcoAuth } from "@/componentes/marco-auth";
import { siguientePermitido } from "@/lib/pagos/rutas";

export const metadata = {
  title: "Iniciar sesión",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PaginaIngreso({ searchParams }) {
  const parametros = await searchParams;
  const siguiente = siguientePermitido(
    typeof parametros.siguiente === "string" ? parametros.siguiente : "",
  );
  const aviso =
    parametros.correo === "pendiente"
      ? "Revisá tu bandeja de entrada o spam de tu correo para validar el mail."
      : null;

  return (
    <MarcoAuth fondo="entrar">
      <FormularioEntrar aviso={aviso} siguiente={siguiente} />
    </MarcoAuth>
  );
}
