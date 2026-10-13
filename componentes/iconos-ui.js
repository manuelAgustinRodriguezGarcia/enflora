export function IconoChevron({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconoCalendario({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

export function IconoPlanta({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20v-7" />
      <path d="M12 13c-2.2-1.8-5.2-2.2-7.5-1.2 1.2 3.2 4 5.2 7.5 5.2" />
      <path d="M12 13c2.2-1.8 5.2-2.2 7.5-1.2-1.2 3.2-4 5.2-7.5 5.2" />
      <path d="M12 10c-1.4-2.4-1.2-5.2.4-7.2 2.4 1 4 3.4 4 6.2" />
    </svg>
  );
}
