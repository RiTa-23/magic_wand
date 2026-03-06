"use client";

import { useState } from "react";
import { Wifi, WifiOff, Wind, Power } from "lucide-react";

export function DeviceStatusCard() {
  const [isConnected] = useState(true);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [windLevel] = useState(2);

  return (
    <div className="relative w-full rounded-xl border border-gold-dim/30 bg-gradient-to-b from-stone-light/30 via-stone/60 to-stone/80 backdrop-blur-sm overflow-hidden">
      {/* Parchment texture */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC44IiBudW1PY3RhdmVzPSI0IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI24pIiBvcGFjaXR5PSIxIi8+PC9zdmc+')]" />

      {/* Top gold line */}
      <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      {/* Content */}
      <div className="relative p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-[0.2em] uppercase text-gold-dim">
              {"Circulator Status"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-magic-glow" />
            ) : (
              <WifiOff className="w-4 h-4 text-destructive" />
            )}
            <span
              className={`text-xs tracking-wider ${isConnected ? "text-magic-glow" : "text-destructive"}`}
            >
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Central status area */}
        <div className="flex items-center gap-8">
          {/* Power orb */}
          <button
            type="button"
            onClick={() => setIsPowerOn(!isPowerOn)}
            aria-label={isPowerOn ? "電源をオフにする" : "電源をオンにする"}
            aria-pressed={isPowerOn}
            className="group relative flex items-center justify-center w-24 h-24 shrink-0"
          >
            {/* Outer ring */}
            <div
              className={`absolute inset-0 rounded-full border-2 transition-colors duration-500 ${isPowerOn ? "border-magic-glow/60" : "border-gold-dim/20"}`}
            />
            {/* Glow */}
            {isPowerOn && (
              <div className="absolute inset-0 rounded-full bg-magic-glow/10 blur-md animate-pulse" />
            )}
            {/* Inner circle */}
            <div
              className={`relative flex items-center justify-center w-16 h-16 rounded-full border transition-all duration-500 ${isPowerOn ? "border-magic-glow/50 bg-magic-glow/10" : "border-gold-dim/20 bg-stone/60"} group-hover:scale-105`}
            >
              <Power
                className={`w-7 h-7 transition-colors duration-500 ${isPowerOn ? "text-magic-glow" : "text-gold-dim/50"}`}
              />
            </div>
          </button>

          {/* Wind level indicator */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Wind
                className={`w-4 h-4 ${isPowerOn ? "text-magic-glow" : "text-gold-dim/40"}`}
              />
              <span className="text-xs tracking-[0.15em] uppercase text-gold-dim">
                {"Wind Level"}
              </span>
            </div>

            {/* Wind level bars */}
            <div className="flex items-end gap-2 h-10">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className="flex-1 rounded-sm transition-all duration-300"
                  style={{ height: `${level * 20}%` }}
                >
                  <div
                    className={`w-full h-full rounded-sm transition-all duration-500 ${
                      isPowerOn && level <= windLevel
                        ? "bg-gradient-to-t from-magic-glow/60 to-magic-glow/30 shadow-[0_0_8px_rgba(96,180,160,0.3)]"
                        : "bg-gold-dim/15"
                    }`}
                  />
                </div>
              ))}
            </div>

            <p className="text-xs text-gold-dim/50 mt-2 tracking-wider">
              {isPowerOn ? `${"Level"} ${windLevel} / 5` : "Standby"}
            </p>
          </div>

          {/* Device info */}
          <div className="flex flex-col gap-2 text-right shrink-0">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-gold-dim/50">
                {"Device"}
              </p>
              <p className="text-xs text-foreground tracking-wider">
                {"Smart Plug #1"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-gold-dim/50">
                {"Mode"}
              </p>
              <p
                className={`text-xs tracking-wider ${isPowerOn ? "text-magic-glow" : "text-gold-dim/40"}`}
              >
                {isPowerOn ? "Active" : "Sleep"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gold line */}
      <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
    </div>
  );
}
