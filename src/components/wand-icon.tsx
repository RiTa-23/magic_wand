export function WandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Wand body */}
      <line
        x1="16"
        y1="48"
        x2="44"
        y2="20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Wand tip glow */}
      <circle cx="44" cy="20" r="3" fill="currentColor" opacity="0.8" />
      <circle cx="44" cy="20" r="6" fill="currentColor" opacity="0.2" />
      <circle cx="44" cy="20" r="10" fill="currentColor" opacity="0.05" />
      {/* Sparkles from tip */}
      <circle cx="50" cy="14" r="1.2" fill="currentColor" opacity="0.7" />
      <circle cx="52" cy="22" r="0.8" fill="currentColor" opacity="0.5" />
      <circle cx="46" cy="10" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="38" cy="14" r="0.7" fill="currentColor" opacity="0.4" />
      {/* Wind curves from wand tip */}
      <path
        d="M46 18C50 16 54 17 56 14"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M45 22C49 21 53 23 58 20"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Handle ornament */}
      <circle
        cx="18"
        cy="46"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.6"
      />
    </svg>
  );
}
