const BURBUJAS = [
  { rol: "usuario", ancho: "68%" },
  { rol: "flora", ancho: "82%" },
  { rol: "usuario", ancho: "54%" },
  { rol: "flora", ancho: "76%" },
  { rol: "usuario", ancho: "61%" },
];

export function EsqueletoRecuperacionChatFlora() {
  return (
    <div
      className="flora-chat-app__recuperacion"
      role="status"
      aria-busy="true"
      aria-label="Cargando conversación guardada"
    >
      <div className="flora-chat-app__recuperacion-burbujas">
        {BURBUJAS.map((b, i) => (
          <span
            key={i}
            className={`flora-chat-app__recuperacion-burbuja flora-chat-app__recuperacion-burbuja--${b.rol}`}
            style={{ width: b.ancho }}
          />
        ))}
      </div>
    </div>
  );
}

export function EsqueletoDockRecuperacionChatFlora() {
  return (
    <div className="flora-chat-app__recuperacion-dock" aria-hidden="true">
      <span className="flora-chat-app__recuperacion-input" />
    </div>
  );
}
