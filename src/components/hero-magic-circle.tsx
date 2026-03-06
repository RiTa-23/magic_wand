"use client";

const RUNE_CHARS =
  "\u16A0\u16A2\u16A6\u16A8\u16B1\u16B7\u16B9\u16BA\u16BE\u16C1\u16C3\u16C7\u16C8\u16CB\u16CF\u16D2\u16D6\u16DA\u16DE\u16DF";

export function HeroMagicCircle() {
  const outerRunes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 15 * Math.PI) / 180;
    const r = 192;
    const x = 200 + r * Math.cos(angle);
    const y = 200 + r * Math.sin(angle);
    const char = RUNE_CHARS[i % RUNE_CHARS.length];
    return { x, y, angle: i * 15 + 90, char };
  });

  const innerRunes = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const r = 132;
    const x = 200 + r * Math.cos(angle);
    const y = 200 + r * Math.sin(angle);
    const char = RUNE_CHARS[(i + 5) % RUNE_CHARS.length];
    return { x, y, angle: i * 30 + 90, char };
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Outermost glow - brighter */}
      <div
        className="absolute w-[440px] h-[440px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.60 0.15 180 / 0.25), transparent 65%)",
        }}
        aria-hidden="true"
      />

      {/* Ring 1 - outermost, slow rotation */}
      <div className="absolute w-[400px] h-[400px] animate-[spin_40s_linear_infinite]">
        <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden="true">
          {/* Solid outer ring */}
          <circle
            cx="200"
            cy="200"
            r="195"
            fill="none"
            stroke="oklch(0.78 0.12 85 / 0.5)"
            strokeWidth="1.5"
            strokeDasharray="8 4"
          />
          <circle
            cx="200"
            cy="200"
            r="188"
            fill="none"
            stroke="oklch(0.60 0.15 180 / 0.35)"
            strokeWidth="0.8"
          />
          {/* Rune characters - brighter gold */}
          {outerRunes.map((rune, i) => (
            <text
              key={`outer-${i}`}
              x={rune.x}
              y={rune.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="oklch(0.82 0.12 85 / 0.85)"
              fontSize="11"
              fontWeight="bold"
              transform={`rotate(${rune.angle}, ${rune.x}, ${rune.y})`}
            >
              {rune.char}
            </text>
          ))}
          {/* Dots at ring junctions - brighter */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            return (
              <circle
                key={`dot-outer-${i}`}
                cx={200 + 195 * Math.cos(angle)}
                cy={200 + 195 * Math.sin(angle)}
                r="3"
                fill="oklch(0.85 0.13 85 / 0.9)"
              />
            );
          })}
        </svg>
      </div>

      {/* Ring 2 - middle, reverse rotation */}
      <div className="absolute w-[310px] h-[310px] animate-[spin_25s_linear_infinite_reverse]">
        <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden="true">
          <circle
            cx="200"
            cy="200"
            r="190"
            fill="none"
            stroke="oklch(0.60 0.15 180 / 0.45)"
            strokeWidth="1.5"
            strokeDasharray="12 6"
          />
          <circle
            cx="200"
            cy="200"
            r="178"
            fill="none"
            stroke="oklch(0.78 0.12 85 / 0.25)"
            strokeWidth="0.8"
          />
          {/* Inner rune characters - brighter teal */}
          {innerRunes.map((rune, i) => (
            <text
              key={`inner-${i}`}
              x={rune.x}
              y={rune.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="oklch(0.65 0.15 180 / 0.85)"
              fontSize="13"
              fontWeight="bold"
              transform={`rotate(${rune.angle}, ${rune.x}, ${rune.y})`}
            >
              {rune.char}
            </text>
          ))}
          {/* Small connector dots on middle ring */}
          {Array.from({ length: 6 }, (_, i) => {
            const angle = (i * 60 * Math.PI) / 180;
            return (
              <circle
                key={`dot-mid-${i}`}
                cx={200 + 190 * Math.cos(angle)}
                cy={200 + 190 * Math.sin(angle)}
                r="2.5"
                fill="oklch(0.60 0.15 180 / 0.8)"
              />
            );
          })}
        </svg>
      </div>

      {/* Ring 3 - inner hexagram, slow rotation */}
      <div className="absolute w-[230px] h-[230px] animate-[spin_35s_linear_infinite]">
        <svg viewBox="0 0 240 240" className="w-full h-full" aria-hidden="true">
          <circle
            cx="120"
            cy="120"
            r="115"
            fill="none"
            stroke="oklch(0.78 0.12 85 / 0.35)"
            strokeWidth="1"
          />
          {/* Hexagram - two overlapping triangles, bolder */}
          <polygon
            points="120,15 207,172 33,172"
            fill="none"
            stroke="oklch(0.82 0.12 85 / 0.45)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon
            points="120,225 33,68 207,68"
            fill="none"
            stroke="oklch(0.82 0.12 85 / 0.45)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Inner circle */}
          <circle
            cx="120"
            cy="120"
            r="70"
            fill="none"
            stroke="oklch(0.60 0.15 180 / 0.4)"
            strokeWidth="1"
            strokeDasharray="5 4"
          />
          {/* Center small hexagram */}
          <polygon
            points="120,60 172,150 68,150"
            fill="none"
            stroke="oklch(0.60 0.15 180 / 0.35)"
            strokeWidth="1"
          />
          <polygon
            points="120,180 68,90 172,90"
            fill="none"
            stroke="oklch(0.60 0.15 180 / 0.35)"
            strokeWidth="1"
          />
          {/* Hexagram vertex dots */}
          {[
            [120, 15],
            [207, 172],
            [33, 172],
            [120, 225],
            [33, 68],
            [207, 68],
          ].map(([cx, cy], i) => (
            <circle
              key={`hex-dot-${i}`}
              cx={cx}
              cy={cy}
              r="3"
              fill="oklch(0.85 0.13 85 / 0.7)"
            />
          ))}
        </svg>
      </div>

      {/* Center core glow - more visible */}
      <div
        className="absolute w-[100px] h-[100px] rounded-full animate-pulse"
        style={{
          background:
            "radial-gradient(circle, oklch(0.60 0.15 180 / 0.45), oklch(0.78 0.12 85 / 0.15) 50%, transparent 80%)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute w-[50px] h-[50px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.90 0.14 85 / 0.5), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Pulsing highlight ring */}
      <div
        className="absolute w-[180px] h-[180px] rounded-full border border-magic-glow/20 animate-ping"
        style={{ animationDuration: "4s" }}
        aria-hidden="true"
      />
    </div>
  );
}
