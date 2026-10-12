const TRAZOS = {
  riego: (
    <>
      <path d="M12 4.5c2.8 3.4 4.5 5.8 4.5 8.2a4.5 4.5 0 0 1-9 0c0-2.4 1.7-4.8 4.5-8.2z" />
    </>
  ),
  foto: (
    <>
      <rect x="4.5" y="7" width="15" height="11" rx="2" />
      <circle cx="12" cy="12.5" r="2.4" />
      <path d="M9 7l1.2-2h3.6L15 7" />
    </>
  ),
  nota: (
    <>
      <path d="M7 4.5h7l3.5 3.5V19.5H7z" />
      <path d="M14 4.5V8h3.5M9.5 12h5M9.5 15.5h5" />
    </>
  ),
  tarea: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M8.2 12.2 10.6 14.6 15.8 9.4" />
    </>
  ),
  poda: (
    <>
      <circle cx="7.5" cy="16.5" r="2.2" />
      <circle cx="16.5" cy="16.5" r="2.2" />
      <path d="M9.2 15.2 15 6M14.8 15.2 9 6" />
    </>
  ),
  fertilizacion: (
    <>
      <path d="M10 10.5h4V19a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2z" />
      <path d="M10.5 10.5V7h3v3.5M12 4.5V7" />
    </>
  ),
  ph: (
    <>
      <path d="M8 16.5c1.8-4 2.4-6.2 2.4-8.1a2.4 2.4 0 0 0-4.8 0c0 1.9.6 4.1 2.4 8.1z" />
      <path d="M14 8h4M16 6v8" />
    </>
  ),
  ec: (
    <>
      <path d="M4 13h2.5l1.5-4 2 8 2-6 1.5 2H20" />
    </>
  ),
  ppm: (
    <>
      <circle cx="7" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="17" cy="12" r="1.6" />
    </>
  ),
  temperatura: (
    <>
      <path d="M10 13.5V6.5a2 2 0 1 1 4 0v7a3.2 3.2 0 1 1-4 0z" />
      <path d="M12 8.5v4" />
    </>
  ),
  humedad: (
    <>
      <path d="M12 4.5c3 3.6 5 6.2 5 9a5 5 0 0 1-10 0c0-2.8 2-5.4 5-9z" />
      <path d="M9.5 14.5c.6 1.2 1.5 1.8 2.5 1.8" />
    </>
  ),
  vpd: (
    <>
      <path d="M5 17.5h14" />
      <path d="M7 17.5a7 7 0 0 1 14 0" />
      <path d="M12 17.5 15.5 11" />
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
  agregar: (
    <>
      <path d="M12 6v12M6 12h12" />
    </>
  ),
  editar: (
    <>
      <path d="M14.2 5.8 18.2 9.8 9 19H5v-4z" />
    </>
  ),
};

export function IconoPreferencia({ clave }) {
  const trazo = TRAZOS[clave];
  if (!trazo) return null;

  return (
    <svg
      className="icono-preferencia"
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
