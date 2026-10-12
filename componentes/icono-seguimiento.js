const TRAZOS = {
  relajado: (
    <>
      <rect x="6" y="4.5" width="12" height="15" rx="2" />
      <path d="M9 9h6M9 12.5h6M9 16h4" />
    </>
  ),
  profesional: (
    <>
      <path d="M4.5 8h15M4.5 16h15" />
      <circle cx="9" cy="8" r="2.1" />
      <circle cx="15" cy="16" r="2.1" />
    </>
  ),
  personalizado: (
    <>
      <rect x="4.5" y="4.5" width="6" height="6" rx="1" />
      <rect x="13.5" y="4.5" width="6" height="6" rx="1" />
      <rect x="4.5" y="13.5" width="6" height="6" rx="1" />
      <path d="M13.5 16.5h6" />
    </>
  ),
};

export function IconoSeguimiento({ tipo }) {
  const trazo = TRAZOS[tipo];
  if (!trazo) return null;

  return (
    <svg
      className="icono-seguimiento"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {trazo}
    </svg>
  );
}
