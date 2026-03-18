"use client";

import {
  Wifi,
  BookOpen,
  Settings,
  ChevronLeft,
  ScrollText,
  Camera,
  Gamepad2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MagicCircle } from "@/components/magic-circle";
import { FloatingParticles } from "@/components/floating-particles";
import { HeroMagicCircle } from "@/components/hero-magic-circle";
import { MagicMenuButton } from "@/components/magic-menu-button";
import { PrimaryMagicButton } from "@/components/primary-magic-button";
import { WandIcon } from "@/components/wand-icon";

type PlayInputMode = "joycon" | "camera";

export default function HomePage() {
  const router = useRouter();
  const [isPlayModeModalOpen, setIsPlayModeModalOpen] =
    useState<boolean>(false);

  const handleOpenPlayModeModal = () => {
    setIsPlayModeModalOpen(true);
  };

  const handleClosePlayModeModal = () => {
    setIsPlayModeModalOpen(false);
  };

  const handleSelectPlayMode = (mode: PlayInputMode) => {
    setIsPlayModeModalOpen(false);
    router.push(`/play/${mode}`);
  };

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
              onClick={handleOpenPlayModeModal}
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

      {isPlayModeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="プレイ方式の選択"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-gold-dim/30 bg-stone/90 p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
            <button
              type="button"
              onClick={handleClosePlayModeModal}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-gold-dim/25 text-gold-dim/80 transition-colors hover:border-gold/60 hover:text-gold-bright"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-center text-lg font-bold tracking-[0.16em] text-gold-bright">
              プレイ方式を選択
            </h2>
            <p className="mt-2 text-center text-xs tracking-[0.12em] text-gold-dim/70">
              Joy-Conの慣性検知か、杖の物体検出のどちらで遊びますか？
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleSelectPlayMode("joycon")}
                className="group rounded-xl border border-gold-dim/30 bg-stone-light/20 px-4 py-5 text-left transition-all hover:border-gold/65 hover:bg-gold/10"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-dim/35 bg-gold/5 text-gold">
                    <Gamepad2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold tracking-[0.12em] text-gold-bright">
                    Joy-Con
                  </p>
                </div>
                <p className="mt-3 text-xs leading-relaxed tracking-[0.08em] text-gold-dim/75">
                  R長押しで軌跡を描いて、離したタイミングでジェスチャー判定します。
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPlayMode("camera")}
                className="group rounded-xl border border-gold-dim/30 bg-stone-light/20 px-4 py-5 text-left transition-all hover:border-gold/65 hover:bg-gold/10"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-dim/35 bg-gold/5 text-gold">
                    <Camera className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold tracking-[0.12em] text-gold-bright">
                    杖の物体検出
                  </p>
                </div>
                <p className="mt-3 text-xs leading-relaxed tracking-[0.08em] text-gold-dim/75">
                  カメラで杖先を追跡し、動きと停止を自動判定してジェスチャー認識します。
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
