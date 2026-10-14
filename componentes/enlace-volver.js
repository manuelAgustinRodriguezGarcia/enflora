import Link from "next/link";
import { IconoFlecha } from "@/componentes/iconos-ui";

export function EnlaceVolver({ href, etiqueta = "Volver" }) {
  return (
    <Link href={href} className="enlace-volver" aria-label={etiqueta}>
      <IconoFlecha />
    </Link>
  );
}
