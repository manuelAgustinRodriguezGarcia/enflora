const TRAZOS = {
  germinacion: (
    <>
      <ellipse cx="12" cy="15" rx="4.2" ry="5.5" />
      <path d="M12 9.2v2.2" />
    </>
  ),
  plantula: (
    <>
      <path d="M12 20V10.5" />
      <path d="M12 14.5c-2.8-.6-4.2-2.8-4.2-4.6 2.4.3 4 2 4.2 4.6z" />
      <path d="M12 12.2c2.6-.4 4.2-2.2 4.4-4.2-2.4.2-4 1.8-4.4 4.2z" />
    </>
  ),
  vegetativo: (
    <>
      <path d="M6 15c3.2-8 8.5-9.5 13-9.5-.8 7.2-5.2 12-13 13 0 0 .2-2 .2-3.5z" />
      <path d="M9.5 15.5c1.8-2.2 3.6-5 5.5-7.8" />
    </>
  ),
  enflora: (
    <>
      <circle cx="12" cy="12" r="2.1" />
      <circle cx="12" cy="6.4" r="1.85" />
      <circle cx="16.9" cy="9.6" r="1.85" />
      <circle cx="15" cy="15.5" r="1.85" />
      <circle cx="9" cy="15.5" r="1.85" />
      <circle cx="7.1" cy="9.6" r="1.85" />
    </>
  ),
  secado: (
    <>
      <path d="M8 4.5h8" />
      <path d="M12 4.5v3.2" />
      <path d="M12 8c-2.8 1.4-4 3.8-4 6.6 2-.8 3.1-.8 4 0 .9-.8 2-.8 4 0 0-2.8-1.2-5.2-4-6.6z" />
    </>
  ),
  finalizado: (
    <>
      <circle cx="12" cy="12" r="7.25" />
      <path d="M8.4 12.2 10.8 14.6 15.7 9.6" />
    </>
  ),
};

export function IconoEtapa({ etapa }) {
  const trazo = TRAZOS[etapa];
  if (!trazo) return null;

  return (
    <svg
      className="icono-etapa"
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
