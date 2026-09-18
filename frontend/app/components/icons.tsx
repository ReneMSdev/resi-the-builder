export function SaveIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2.5 2.5h8l2.5 2.5v8a1 1 0 0 1-1 1h-9.5a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1Z" />
      <path d="M4.5 2.5v3.5h5.5v-3.5" />
      <path d="M4.5 13.5v-4h7v4" />
    </svg>
  );
}

export function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 2v7" />
      <path d="M5 6l3 3 3-3" />
      <path d="M3 12.5h10" />
    </svg>
  );
}
