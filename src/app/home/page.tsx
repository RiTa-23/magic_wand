"use client";

import {
  Wifi,
  BookOpen,
  Settings,
  ChevronLeft,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MagicCircle } from "@/components/magic-circle";
import { FloatingParticles } from "@/components/floating-particles";
import { HeroMagicCircle } from "@/components/hero-magic-circle";
import { MagicMenuButton } from "@/components/magic-menu-button";
import { PrimaryMagicButton } from "@/components/primary-magic-button";
import { WandIcon } from "@/components/wand-icon";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background">
      {/* Background image layer */}
      <div
        className="fixed inset-0 bg-background opacity-30"
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80"
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 shadow-[inset_0_0_200px_80px_rgba(0,0,0,0.6)]"
        aria-hidden="true"
      />

      {/* Ambient magic circle decoration */}
      <div className="fixed right-[-10%] bottom-[-15%] w-[600px] h-[600px] opacity-50">
        <MagicCircle />
      </div>

      <FloatingParticles />

      {/* Content */}
      <div className="relative z-20 flex flex-col min-h-svh">
        {/* Header bar */}
        <header className="flex items-center justify-between px-10 py-5 border-b border-gold-dim/15 shrink-0">
          <div className="flex items-center gap-6">
            {/* Back button */}
            <Link
              href="/"
              className="group relative flex items-center justify-center w-10 h-10 rounded-full border border-gold-dim/20 bg-stone/40 backdrop-blur-md transition-all duration-300 hover:border-gold/60 hover:bg-gold/5 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] active:scale-90"
            >
              <ChevronLeft className="w-6 h-6 text-gold/80 transition-colors duration-300 group-hover:text-gold-bright" />
              <span className="sr-only">{"スタート画面に戻る"}</span>
            </Link>

            <div className="flex items-center gap-3">
              <WandIcon className="w-8 h-8 text-gold" />
              <div>
                <h1 className="text-xl font-bold tracking-[0.15em] text-gold-bright leading-none">
                  Magic Wand
                </h1>
                <p className="text-[11px] font-serif tracking-[0.15em] text-gold-dim/60 mt-0.5">
                  {"杖で風を操る魔法アプリ"}
                </p>
              </div>
            </div>
          </div>

          {/* Settings button - top right */}
          <Link
            href="/settings"
            className="group relative flex items-center justify-center w-10 h-10 rounded-lg border border-gold-dim/25 bg-stone/60 backdrop-blur-sm transition-all duration-300 hover:border-gold/40 hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] active:scale-95"
          >
            <Settings className="w-5 h-5 text-gold/70 transition-colors duration-300 group-hover:text-gold-bright" />
            <span className="sr-only">{"設定"}</span>
          </Link>
        </header>

        {/* Main area */}
        <div className="flex-1 flex items-center px-10 py-10">
          {/* Left side - nav buttons stacked vertically */}
          <nav
            className="flex flex-col gap-5 w-64 shrink-0"
            aria-label="メインメニュー"
          >
            <MagicMenuButton
              label="チュートリアル"
              icon={BookOpen}
              delay={100}
              onClick={() => router.push("/tutorial")}
            />
            <MagicMenuButton
              label="呪文一覧"
              icon={ScrollText}
              delay={200}
              onClick={() => router.push("/spells")}
            />
            <MagicMenuButton
              label="接続確認"
              icon={Wifi}
              delay={300}
              onClick={() => router.push("/connection-check")}
            />
            <PrimaryMagicButton
              label="魔法を発動"
              icon={WandIcon}
              delay={400}
              onClick={() => router.push("/play")}
            />
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
            {"~ Enchanted IoT ~"}
          </p>
        </footer>
      </div>
    </main>
  );
}
