"use client";

export function IndicadorFloraEscribiendo() {
  return (
    <div
      className="flora-chat-app__burbuja flora-chat-app__burbuja--escribiendo"
      aria-busy="true"
      aria-label="Flora está escribiendo"
    >
      <span className="flora-chat-app__puntos" aria-hidden="true">
        <span className="flora-chat-app__punto" />
        <span className="flora-chat-app__punto" />
        <span className="flora-chat-app__punto" />
      </span>
    </div>
  );
}
