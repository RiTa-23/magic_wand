"use client";

import type { ElementType } from "react";

interface PrimaryMagicButtonProps {
  label: string;
  icon: ElementType;
  onClick?: () => void;
  delay?: number;
}

export function PrimaryMagicButton({
  label,
  icon: Icon,
  onClick,
  delay = 0,
}: PrimaryMagicButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full animate-[fade-slide-up_0.5s_ease-out_both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Outer glow pulse */}
      <div className="absolute -inset-[2px] rounded-xl bg-gold/40 blur-md group-hover:bg-gold/60 transition-colors duration-500 animate-pulse" />

      {/* Button Body */}
      <div className="relative flex flex-col items-center gap-4 px-4 py-6 rounded-xl border border-gold bg-gradient-to-b from-stone-light/40 via-gold/10 to-stone/80 backdrop-blur-md overflow-hidden transition-all duration-300 group-hover:border-gold-bright group-hover:shadow-[inset_0_0_20px_rgba(212,175,55,0.3)] group-active:scale-[0.98]">
        {/* Magic Particles effect layer inside button */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold/30 via-transparent to-transparent opacity-60" />

        {/* Left edge ornament */}
        <div className="absolute left-0 top-4 bottom-4 w-[2px] bg-gradient-to-b from-transparent via-gold-bright to-transparent opacity-80" />
        {/* Right edge ornament */}
        <div className="absolute right-0 top-4 bottom-4 w-[2px] bg-gradient-to-b from-transparent via-gold-bright to-transparent opacity-80" />

        {/* Icon container */}
        <div className="relative flex items-center justify-center w-14 h-14 rounded-full border border-gold-bright bg-gold/10 text-gold-bright shadow-[0_0_15px_rgba(212,175,55,0.5)] transition-all duration-300 group-hover:scale-110 group-hover:bg-gold/20 group-hover:shadow-[0_0_25px_rgba(212,175,55,0.8)]">
          <Icon className="w-7 h-7" />
        </div>

        {/* Label */}
        <span className="relative text-base font-bold tracking-[0.2em] text-white drop-shadow-[0_0_8px_rgba(212,175,55,0.8)] transition-all duration-300 group-hover:text-gold-bright">
          {label}
        </span>

        {/* Bottom glowing line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold-bright to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
    </button>
  );
}
