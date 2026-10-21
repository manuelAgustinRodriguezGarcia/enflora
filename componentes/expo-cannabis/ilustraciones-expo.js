const VERDE = "#0B3D2A";
const LIMA = "#A4C85B";
const CREMA = "#FDF1D7";
const ROSA = "#F0B4B4";
const BLANCO = "#FFFFFF";

function Stickers() {
  return (
    <svg viewBox="0 0 160 120">
      <g transform="rotate(-9 62 62)">
        <rect x="22" y="22" width="80" height="80" rx="24" fill={BLANCO} />
        <rect x="29" y="29" width="66" height="66" rx="19" fill={LIMA} />
        <image href="/logos/enflora-isotipo-dark-green.svg" x="38" y="38" width="48" height="48" />
      </g>
      <g transform="rotate(12 118 46)">
        <path
          d="M118 14 l8.6 17.4 19.2 2.8 -13.9 13.5 3.3 19.1 -17.2 -9 -17.2 9 3.3 -19.1 -13.9 -13.5 19.2 -2.8 z"
          fill={BLANCO}
          stroke={BLANCO}
          strokeWidth="9"
          strokeLinejoin="round"
        />
        <path
          d="M118 14 l8.6 17.4 19.2 2.8 -13.9 13.5 3.3 19.1 -17.2 -9 -17.2 9 3.3 -19.1 -13.9 -13.5 19.2 -2.8 z"
          fill={ROSA}
        />
      </g>
      <g transform="rotate(-4 122 94)">
        <rect x="96" y="80" width="54" height="26" rx="13" fill={BLANCO} />
        <rect x="100" y="84" width="46" height="18" rx="9" fill={VERDE} />
        <text
          x="123"
          y="97"
          textAnchor="middle"
          fill={CREMA}
          fontFamily="var(--font-fredoka), sans-serif"
          fontSize="11"
          fontWeight="600"
        >
          420
        </text>
      </g>
    </svg>
  );
}

function Filtros() {
  return (
    <svg viewBox="0 0 160 120">
      <g transform="rotate(-8 42 64)">
        <rect x="12" y="22" width="60" height="82" rx="10" fill={VERDE} />
        <rect x="12" y="22" width="60" height="22" rx="10" fill={LIMA} />
        <rect x="12" y="36" width="60" height="8" fill={LIMA} />
        <image href="/logos/enflora-isotipo-light.svg" x="24" y="54" width="36" height="36" />
      </g>
      {[
        [102, 90],
        [134, 90],
        [118, 66],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <rect x={cx - 26} y={cy - 11} width="34" height="22" rx="4" fill={CREMA} stroke={VERDE} strokeWidth="2.5" />
          <circle cx={cx + 8} cy={cy} r="11" fill={BLANCO} stroke={VERDE} strokeWidth="2.5" />
          <path
            d={`M${cx + 8} ${cy} m-1.5 0 a1.5 1.5 0 1 1 3 0 a3.5 3.5 0 1 1 -6.5 -1 a6 6 0 1 1 10.5 4`}
            fill="none"
            stroke={ROSA}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}

function Tuqueros() {
  return (
    <svg viewBox="0 0 160 120">
      <circle cx="80" cy="60" r="44" fill={BLANCO} opacity="0.55" />
      <g transform="rotate(-28 80 60)">
        <circle cx="80" cy="18" r="11" fill="none" stroke={VERDE} strokeWidth="5" />
        <path d="M74 28 L64 92 Q63 100 70 100 L76 100" fill="none" stroke={VERDE} strokeWidth="6" strokeLinecap="round" />
        <path d="M86 28 L96 92 Q97 100 90 100 L84 100" fill="none" stroke={VERDE} strokeWidth="6" strokeLinecap="round" />
        <rect x="68" y="52" width="24" height="12" rx="6" fill={LIMA} stroke={VERDE} strokeWidth="3" />
      </g>
      <g transform="translate(112 22) rotate(18)">
        <path d="M0 22 C-14 10 -10 -6 0 -14 C10 -6 14 10 0 22 Z" fill={LIMA} stroke={VERDE} strokeWidth="3" />
        <path d="M0 20 V-6" stroke={VERDE} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <circle cx="36" cy="88" r="6" fill={ROSA} />
      <circle cx="128" cy="92" r="4" fill={VERDE} />
    </svg>
  );
}

function Folletos() {
  return (
    <svg viewBox="0 0 160 120">
      <g transform="rotate(7 112 64)">
        <rect x="78" y="24" width="62" height="82" rx="8" fill={BLANCO} />
      </g>
      <g transform="rotate(-6 58 62)">
        <rect x="28" y="22" width="64" height="84" rx="8" fill={CREMA} stroke={VERDE} strokeWidth="3" />
        <rect x="38" y="34" width="34" height="8" rx="4" fill={LIMA} />
        <path d="M38 52 h40 M38 62 h34 M38 72 h38" stroke={VERDE} strokeWidth="3" strokeLinecap="round" opacity="0.35" />
        <image href="/logos/enflora-isotipo-dark-green.svg" x="58" y="78" width="22" height="22" />
      </g>
      <circle cx="126" cy="28" r="6" fill={ROSA} />
    </svg>
  );
}

function Picadores() {
  return (
    <svg viewBox="0 0 160 120">
      <ellipse cx="80" cy="104" rx="46" ry="7" fill={VERDE} opacity="0.16" />
      <rect x="40" y="70" width="80" height="30" rx="12" fill={VERDE} />
      <path d="M50 76 v18 M62 76 v18 M74 76 v18 M86 76 v18 M98 76 v18 M110 76 v18" stroke={LIMA} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <rect x="40" y="48" width="80" height="26" rx="12" fill={LIMA} stroke={VERDE} strokeWidth="3" />
      <ellipse cx="80" cy="44" rx="40" ry="14" fill={CREMA} stroke={VERDE} strokeWidth="3" />
      <image href="/logos/enflora-isotipo-dark-green.svg" x="66" y="32" width="28" height="24" />
      <g fill={ROSA}>
        <circle cx="28" cy="32" r="5" />
        <circle cx="134" cy="26" r="7" />
      </g>
      <path d="M128 52 l4 8 8 1.2 -5.8 5.6 1.4 8 -7.6 -4 -7.6 4 1.4 -8 -5.8 -5.6 8 -1.2 z" fill={BLANCO} />
    </svg>
  );
}

const ILUSTRACIONES = {
  stickers: Stickers,
  filtros: Filtros,
  folletos: Folletos,
  tuqueros: Tuqueros,
  picadores: Picadores,
};

export function IlustracionRegalo({ nombre }) {
  const Ilustracion = ILUSTRACIONES[nombre];
  return Ilustracion ? <Ilustracion /> : null;
}
