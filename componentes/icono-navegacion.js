const TRAZOS = {
  espacios: (
    <>
      <path d="M8.5 10.5h7l-.8 7.5H9.3z" />
      <path d="M9.2 10.5c.2-2.6 1.3-4.5 2.8-4.5s2.6 1.9 2.8 4.5" />
      <path d="M12 6V4" />
    </>
  ),
  cultivos: (
    <>
      <path d="M14 8.536V6a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V4a4 4 0 0 1-4 4 4 4 0 0 0-4 4 5 5 0 0 1-8-4 5 5 0 0 1 8 4c0 2 1 3 1 5" />
      <path d="m18 17-1.085 3.58A2 2 0 0 1 15 22H9.002a2 2 0 0 1-1.913-1.418L6 17" />
      <path d="M5 17h14" />
    </>
  ),
  historial: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 8h8" />
      <path d="M7 12h10" />
      <path d="M7 16h6" />
    </>
  ),
  registro: (
    <>
      <path d="M7 4.5h7.5L17 7v12.5H7z" />
      <path d="M14.5 4.5V7H17" />
      <path d="M9.5 11h5" />
      <path d="M9.5 14h5" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M6.5 18.5c1.1-2.5 3-3.7 5.5-3.7s4.4 1.2 5.5 3.7" />
    </>
  ),
  notificaciones: (
    <>
      <path d="M6.5 16h11l-1.1-2V10a4.4 4.4 0 0 0-8.8 0v4z" />
      <path d="M10 16.2a2 2 0 0 0 4 0" />
    </>
  ),
};

export function IconoNavegacion({ clave }) {
  const trazo = TRAZOS[clave];
  if (!trazo) return null;

  return (
    <svg
      className="icono-navegacion"
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
