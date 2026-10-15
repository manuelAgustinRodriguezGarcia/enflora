const ARCHIVOS = {
  germinacion: "/iconos/i-germinacion.svg",
  plantula: "/iconos/i-plantula.svg",
  vegetativo: "/iconos/i-vegetativo.svg",
  enflora: "/logos/enflora-isotipo-dark-green.svg",
  secado: "/iconos/i-secado.svg",
  finalizado: "/iconos/i-finalizado.svg",
};

export function IconoEtapa({ etapa, className }) {
  const src = ARCHIVOS[etapa];
  if (!src) return null;

  return (
    <span
      className={["icono-etapa", "icono-etapa--mascara", className].filter(Boolean).join(" ")}
      style={{ "--icono-etapa-url": `url("${src}")` }}
      aria-hidden="true"
    />
  );
}
