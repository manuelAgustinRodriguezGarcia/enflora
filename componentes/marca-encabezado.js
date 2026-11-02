import Link from "next/link";

export function MarcaEncabezado({ alt, href = "/" }) {
  return (
    <Link className="encabezado__marca" href={href} aria-label={alt}>
      <img
        className="encabezado__logo encabezado__logo--oscuro"
        src="/logos/enflora-logo-apaisado.svg"
        alt=""
        width={1000}
        height={300}
      />
      <img
        className="encabezado__logo encabezado__logo--claro"
        src="/logos/enflora-logo-apaisado-light.svg"
        alt=""
        width={1000}
        height={300}
      />
    </Link>
  );
}
