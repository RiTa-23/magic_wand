"use client";

export function MagicCircle() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
      {/* Outer ring - slow rotation */}
      <div className="absolute w-[500px] h-[500px] animate-[spin_30s_linear_infinite] opacity-15">
        <svg viewBox="0 0 340 340" className="w-full h-full">
          <circle
            cx="170"
            cy="170"
            r="165"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-gold"
            strokeDasharray="8 4"
          />
          <circle
            cx="170"
            cy="170"
            r="155"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-magic-glow"
          />
          {/* Rune marks around outer ring */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x = Number((170 + 160 * Math.cos(angle)).toFixed(4));
            const y = Number((170 + 160 * Math.sin(angle)).toFixed(4));
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill="currentColor"
                className="text-gold/60"
              />
            );
          })}
        </svg>
      </div>

      {/* Inner ring - reverse rotation */}
      <div className="absolute w-[360px] h-[360px] animate-[spin_20s_linear_infinite_reverse] opacity-12">
        <svg viewBox="0 0 240 240" className="w-full h-full">
          <circle
            cx="120"
            cy="120"
            r="115"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-magic-glow"
            strokeDasharray="12 6"
          />
          {/* Hexagram */}
          <polygon
            points="120,15 210,172 30,172"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-gold/40"
          />
          <polygon
            points="120,225 30,68 210,68"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-gold/40"
          />
        </svg>
      </div>

      {/* Center glow */}
      <div className="absolute w-[200px] h-[200px] rounded-full bg-magic-glow/5 blur-2xl animate-pulse" />
      <div
        className="absolute w-[100px] h-[100px] rounded-full bg-gold/8 blur-xl animate-pulse"
        style={{ animationDelay: "1s" }}
      />
    </div>
  );
}
