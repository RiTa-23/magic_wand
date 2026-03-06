"use client";

import type { LucideIcon } from "lucide-react";

interface MagicMenuButtonProps {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  delay?: number;
}

export function MagicMenuButton({
  label,
  icon: Icon,
  onClick,
  delay = 0,
}: MagicMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full animate-[fadeSlideUp_0.5s_ease-out_both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Hover glow */}
      <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-b from-gold/20 via-transparent to-gold/20 opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

      {/* Card body */}
      <div className="relative flex flex-col items-center gap-3 px-4 py-5 rounded-xl border border-gold-dim/25 bg-gradient-to-b from-stone-light/30 via-stone/60 to-stone/80 backdrop-blur-sm overflow-hidden transition-all duration-300 group-hover:border-gold/40 group-hover:shadow-[0_0_20px_rgba(212,175,55,0.1)] group-active:scale-[0.98]">
        {/* Texture */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC44IiBudW1PY3RhdmVzPSI0IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI24pIiBvcGFjaXR5PSIxIi8+PC9zdmc+')]" />

        {/* Left edge ornament */}
        <div className="absolute left-0 top-3 bottom-3 w-[1.5px] bg-gradient-to-b from-transparent via-gold/25 to-transparent" />
        {/* Right edge ornament */}
        <div className="absolute right-0 top-3 bottom-3 w-[1.5px] bg-gradient-to-b from-transparent via-gold/25 to-transparent" />

        {/* Icon */}
        <div className="relative flex items-center justify-center w-10 h-10 rounded-lg border border-gold-dim/20 bg-gold/5 text-gold transition-all duration-300 group-hover:bg-gold/10 group-hover:text-gold-bright group-hover:scale-110 shrink-0">
          <Icon className="w-5 h-5" />
        </div>

        {/* Label */}
        <span className="relative text-sm font-semibold tracking-[0.12em] text-foreground/90 transition-colors duration-300 group-hover:text-gold-bright">
          {label}
        </span>

        {/* Bottom ornament */}
        <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>
    </button>
  );
}
