import { FormularioEntrar } from "@/componentes/formulario-entrar";
import { MarcoAuth } from "@/componentes/marco-auth";

export default async function PaginaEntrar({ searchParams }) {
  const parametros = await searchParams;
  const aviso =
    parametros.correo === "pendiente"
      ? "Revisá tu bandeja de entrada o spam de tu correo para validar el mail."
      : null;

  return (
    <MarcoAuth fondo="entrar">
      <FormularioEntrar aviso={aviso} />
    </MarcoAuth>
  );
}
