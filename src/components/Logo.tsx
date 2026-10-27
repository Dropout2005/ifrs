export function Logo({ className = 'size-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#2ec4b6" />
      <path d="M32 9c8.5 11.5 14.5 18.5 14.5 27a14.5 14.5 0 0 1-29 0C17.5 27.5 23.5 20.5 32 9z" fill="#0b2545" />
      <path d="M12 45c4.2 0 4.2-3.2 9.3-3.2s5.1 3.2 9.4 3.2 4.2-3.2 9.3-3.2 5.1 3.2 9.4 3.2 3-1.6 4.6-2.4" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <path d="M28 25c-2.7 3.8-4 6.8-4 9.5" stroke="#2ec4b6" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}
