import { ChevronLeft, Gamepad2, Wifi } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";
import { WandIcon } from "@/components/wand-icon";

const HOME_ROUTE: Route = "/home";
const WAND_TEST_ROUTE: Route = "/test/wand";

export default function ConnectionPage() {
  const cardBase =
    "group flex h-72 w-64 flex-col items-center rounded-xl border border-gold-dim/20 bg-stone/25 p-7 shadow-lg backdrop-blur-sm transition-transform duration-300 hover:scale-[1.03] active:scale-95 sm:h-80 sm:w-72";

  const cardFocus =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40";

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background">
      <FloatingParticles />

      <div className="relative z-20 h-screen overflow-hidden px-6 sm:px-10 flex flex-col">
        {/* Top area */}
        <div className="relative pt-8 sm:pt-10 flex-none">
          {/* Back link (match Tutorial style) */}
          <Link
            href={HOME_ROUTE}
            className="absolute left-0 top-8 sm:top-10 group flex items-center gap-2 text-gold-dim transition-colors hover:text-gold-bright"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-xs uppercase tracking-widest text-shadow-glow">
              Back
            </span>
          </Link>

          {/* Title (top center) */}
          <header className="text-center">
            <Wifi className="w-9 h-9 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-gold opacity-80" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-[0.4em] text-gold-bright uppercase">
              CONNECTION
            </h1>
          </header>
        </div>

        {/* Center buttons */}
        <div className="flex-1 min-h-0 flex items-center justify-center py-6 sm:py-10">
          <div className="mx-auto w-full max-w-3xl lg:max-w-4xl">
            <div className="flex flex-col items-center justify-center gap-y-8 sm:flex-row sm:gap-y-0 sm:gap-x-16 lg:gap-x-20 xl:gap-x-24">
              <button
                type="button"
                className={`${cardBase} ${cardFocus}`}
                aria-label="杖の確認"
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <WandIcon className="h-28 w-28 text-gold sm:h-32 sm:w-32" />
                  <span className="text-base font-bold tracking-[0.25em] text-gold-bright">
                    {"杖の確認"}
                  </span>
                </div>
              </button>

              <Link
                href={WAND_TEST_ROUTE}
                className={`${cardBase} ${cardFocus}`}
                aria-label="joy-conの確認"
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Gamepad2 className="h-28 w-28 text-gold sm:h-32 sm:w-32" />
                  <span className="text-base font-bold tracking-[0.25em] text-gold-bright">
                    {"joy-conの確認"}
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
