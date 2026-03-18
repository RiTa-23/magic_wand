import { ChevronLeft, Gamepad2, Wifi } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";
import { WandIcon } from "@/components/wand-icon";

const HOME_ROUTE: Route = "/home";
const JOYCON_TEST_ROUTE: Route = "/test/wand";

export default function ConnectionPage() {
  const cardFocus =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40";

  const cardShell =
    "group relative h-72 w-64 transition-transform duration-300 hover:scale-[1.03] active:scale-95 sm:h-80 sm:w-72";

  const cardBody =
    "relative flex h-full w-full flex-col items-center justify-center gap-6 rounded-xl border border-gold-dim/25 bg-gradient-to-b from-stone-light/30 via-stone/60 to-stone/80 p-7 backdrop-blur-sm overflow-hidden transition-all duration-300 group-hover:border-gold/40 group-hover:shadow-[0_0_20px_rgba(212,175,55,0.1)]";

  const cardGlow =
    "absolute -inset-[1px] rounded-xl bg-gradient-to-b from-gold/20 via-transparent to-gold/20 opacity-0 transition-opacity duration-400 group-hover:opacity-100";

  const cardTexture =
    "absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC44IiBudW1PY3RhdmVzPSI0IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI24pIiBvcGFjaXR5PSIxIi8+PC9zdmc+')]'";

  const cardOrnamentLeft =
    "absolute left-0 top-5 bottom-5 w-[1.5px] bg-gradient-to-b from-transparent via-gold/25 to-transparent";

  const cardOrnamentRight =
    "absolute right-0 top-5 bottom-5 w-[1.5px] bg-gradient-to-b from-transparent via-gold/25 to-transparent";

  const iconContainer =
    "relative flex items-center justify-center h-24 w-24 rounded-2xl border border-gold-dim/20 bg-gold/5 text-gold transition-all duration-300 group-hover:bg-gold/10 group-hover:text-gold-bright group-hover:scale-110 shrink-0";

  const labelClass =
    "relative text-base font-bold tracking-[0.22em] text-foreground/90 transition-colors duration-300 group-hover:text-gold-bright";

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
                className={`${cardShell} ${cardFocus}`}
                aria-label="杖の確認"
              >
                <div className={cardGlow} aria-hidden="true" />
                <div className={cardBody}>
                  <div className={cardTexture} aria-hidden="true" />
                  <div className={cardOrnamentLeft} aria-hidden="true" />
                  <div className={cardOrnamentRight} aria-hidden="true" />

                  <div className={iconContainer}>
                    <WandIcon className="h-12 w-12" />
                  </div>
                  <span className={labelClass}>{"杖の確認"}</span>

                  <div
                    className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent"
                    aria-hidden="true"
                  />
                </div>
              </button>

              <Link
                href={JOYCON_TEST_ROUTE}
                className={`${cardShell} ${cardFocus}`}
                aria-label="joy-conの確認"
              >
                <div className={cardGlow} aria-hidden="true" />
                <div className={cardBody}>
                  <div className={cardTexture} aria-hidden="true" />
                  <div className={cardOrnamentLeft} aria-hidden="true" />
                  <div className={cardOrnamentRight} aria-hidden="true" />

                  <div className={iconContainer}>
                    <Gamepad2 className="h-12 w-12" />
                  </div>
                  <span className={labelClass}>{"joy-conの確認"}</span>

                  <div
                    className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
