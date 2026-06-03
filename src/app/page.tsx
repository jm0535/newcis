export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between text-xs uppercase tracking-wider">
        <span className="text-zinc-500">National Security Advisory · Papua New Guinea</span>
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Prototype
        </span>
      </div>

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-4">NEWCIS</p>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight max-w-4xl leading-tight">
          National ENSO Early Warning &<br />
          <span className="text-emerald-400">Climate Intelligence System</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-400">
          A three-tier data-to-decision pipeline for Papua New Guinea: ingest, intelligence, present.
          Proof-of-concept prototype.
        </p>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full text-left">
          {[
            { k: "INGEST", v: "NOAA · BoM · HDX HAPI" },
            { k: "INTELLIGENCE", v: "Traffic-light risk engine" },
            { k: "PRESENT", v: "Executive operating picture" },
          ].map((t) => (
            <div key={t.k} className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
              <div className="text-xs uppercase tracking-wider text-zinc-500">{t.k}</div>
              <div className="mt-1 text-zinc-200 font-medium">{t.v}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-6 py-4 text-xs text-zinc-500 flex flex-wrap gap-4 justify-between">
        <span>Build: Phase 0 · empty shell</span>
        <span>newcis.in4metrix.dev</span>
      </footer>
    </main>
  );
}
