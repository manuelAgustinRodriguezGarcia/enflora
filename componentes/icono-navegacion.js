const TRAZOS = {
  espacios: (
    <>
      <path d="M8.5 10.5h7l-.8 7.5H9.3z" />
      <path d="M9.2 10.5c.2-2.6 1.3-4.5 2.8-4.5s2.6 1.9 2.8 4.5" />
      <path d="M12 6V4" />
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
