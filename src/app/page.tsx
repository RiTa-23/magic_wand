import Image from "next/image";

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      <Image
        src="/yuchimage/yuchisiro.jpg"
        alt="Start screen background"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/80" />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <section className="w-full max-w-5xl text-center">
          <div className="mx-auto mb-6 flex items-center justify-center gap-4">
            <span className="h-px w-24 bg-amber-300/60" />
            <span className="text-amber-300/80">★</span>
            <span className="h-px w-24 bg-amber-300/60" />
          </div>

          <h1 className="font-serif text-5xl tracking-[0.35em] text-amber-300 sm:text-6xl md:text-7xl">
            WIZARDING
          </h1>

          <p className="mt-4 font-serif text-xl tracking-[0.35em] text-zinc-200/90 sm:text-2xl">
            ACADEMY
          </p>

          <p className="mt-8 text-sm text-zinc-200/75 sm:text-base">
            Where Magic Becomes Reality
          </p>

          <div className="mt-10 flex items-center justify-center">
            <button
              type="button"
              className="min-w-[220px] border border-amber-300/60 bg-black/30 px-10 py-4 text-sm tracking-[0.35em] text-zinc-100 backdrop-blur-sm transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            >
              ENTER
            </button>
          </div>

          <p className="mt-12 text-xs tracking-[0.25em] text-zinc-200/55">
            EST. 990 A.D.
          </p>
        </section>
      </main>
    </div>
  );
}
