"use client"

import { Wifi, BookOpen, Settings } from "lucide-react"
import { MagicCircle } from "@/components/magic-circle"
import { FloatingParticles } from "@/components/floating-particles"
import { HeroMagicCircle } from "@/components/hero-magic-circle"
import { MagicMenuButton } from "@/components/magic-menu-button"
import { WandIcon } from "@/components/wand-icon"

export default function HomePage() {
  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background">
      {/* Background image layer */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: "url('/images/magic-bg.jpg')" }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80" aria-hidden="true" />
      <div className="fixed inset-0 shadow-[inset_0_0_200px_80px_rgba(0,0,0,0.6)]" aria-hidden="true" />

      {/* Ambient magic circle decoration */}
      <div className="fixed right-[-10%] bottom-[-15%] w-[600px] h-[600px] opacity-50">
        <MagicCircle />
      </div>

      <FloatingParticles />

      {/* Content */}
      <div className="relative z-20 flex flex-col min-h-svh">

        {/* Header bar */}
        <header className="flex items-center justify-between px-10 py-5 border-b border-gold-dim/15 shrink-0">
          <div className="flex items-center gap-3">
            <WandIcon className="w-8 h-8 text-gold" />
            <div>
              <h1 className="text-xl font-bold tracking-[0.15em] text-gold-bright leading-none">
                Magic Wind
              </h1>
              <p className="text-[11px] font-serif tracking-[0.15em] text-gold-dim/60 mt-0.5">
                {'杖で風を操る魔法アプリ'}
              </p>
            </div>
          </div>

          {/* Settings button - top right */}
          <button className="group relative flex items-center justify-center w-10 h-10 rounded-lg border border-gold-dim/25 bg-stone/60 backdrop-blur-sm transition-all duration-300 hover:border-gold/40 hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] active:scale-95">
            <Settings className="w-5 h-5 text-gold/70 transition-colors duration-300 group-hover:text-gold-bright" />
            <span className="sr-only">{'設定'}</span>
          </button>
        </header>

        {/* Main area */}
        <div className="flex-1 flex items-center px-10 py-10">

          {/* Left side - nav buttons stacked vertically */}
          <nav className="flex flex-col gap-5 w-64 shrink-0" aria-label="メインメニュー">
            <MagicMenuButton label="チュートリアル" icon={BookOpen} delay={100} />
            <MagicMenuButton label="接続確認" icon={Wifi} delay={200} />
          </nav>

          {/* Center - hero magic circle */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-[460px] h-[460px]">
              <HeroMagicCircle />
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="shrink-0 flex items-center justify-center px-10 py-4 border-t border-gold-dim/10">
          <p className="text-[11px] text-gold-dim/30 tracking-[0.3em] font-serif">
            {'~ Enchanted IoT ~'}
          </p>
        </footer>
      </div>
    </main>
  )
}
