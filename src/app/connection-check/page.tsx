import { ChevronLeft, Gamepad2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";
import { WandIcon } from "@/components/wand-icon";

const HOME_ROUTE: Route = "/home";
const WAND_TEST_ROUTE: Route = "/test/wand";

export default function ConnectionPage() {
  const cardBase =
    "group flex h-64 w-56 flex-col items-center rounded-xl border border-gold-dim/20 bg-stone/25 p-6 shadow-lg backdrop-blur-sm transition-transform duration-300 hover:scale-[1.03] active:scale-95 sm:w-64";

  const cardFocus =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40";

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background">
      <FloatingParticles />

      <div className="relative z-20 flex h-screen items-center justify-center px-6">
        {/* Back */}
        <Link
          href={HOME_ROUTE}
          className="absolute top-10 left-10 group flex items-center justify-center w-10 h-10 rounded-full border border-gold-dim/20 bg-stone/40 backdrop-blur-md transition-all duration-300 hover:border-gold/60 hover:bg-gold/5 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] active:scale-90"
        >
          <ChevronLeft className="w-6 h-6 text-gold/80 transition-colors duration-300 group-hover:text-gold-bright" />
          <span className="sr-only">{"ホームに戻る"}</span>
        </Link>

        {/* Center buttons */}
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex flex-col items-center justify-center gap-y-8 sm:flex-row sm:gap-y-0 sm:gap-x-12">
            <button
              type="button"
              className={`${cardBase} ${cardFocus}`}
              aria-label="杖の確認"
            >
              <div className="flex w-full flex-1 flex-col items-center">
                <div className="mt-auto flex flex-col items-center justify-center space-y-4 pb-1">
                  <WandIcon className="h-20 w-20 text-gold" />
                  <span className="text-sm font-bold tracking-[0.25em] text-gold-bright">
                    {"杖の確認"}
                  </span>
                </div>
              </div>
            </button>

            <Link
              href={WAND_TEST_ROUTE}
              className={`${cardBase} ${cardFocus}`}
              aria-label="joy-conの確認"
            >
              <div className="flex w-full flex-1 flex-col items-center">
                <div className="mt-auto flex flex-col items-center justify-center space-y-4 pb-1">
                  <Gamepad2 className="h-20 w-20 text-gold" />
                  <span className="text-sm font-bold tracking-[0.25em] text-gold-bright">
                    {"joy-conの確認"}
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
