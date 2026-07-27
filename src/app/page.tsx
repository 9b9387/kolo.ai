import Link from 'next/link';
import { Archivo_Black } from 'next/font/google';

// Minimal landing: one oversized statement, one line of context, one action.
// Printed-paper palette on purpose: paper #FCFCF9 · ink #101410 ·
// leaf #2D6A3F · amber #D97A00.

const display = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-display' });

const FEATURES: { title: string; body: string }[] = [
  { title: 'Profile & goals', body: 'The facts your agent needs for its own math.' },
  { title: 'Meals & workouts', body: 'Structured daily records, written by your agent.' },
  { title: 'Food nutrition', body: 'Per-100g data your agent can look up any time.' },
];

export default function Home() {
  return (
    <main
      className={`${display.variable} flex flex-1 flex-col bg-[#FCFCF9] text-[#101410] [--leaf:#2D6A3F] [--amber:#D97A00]`}
    >
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-5">
        <span className="font-[family-name:var(--font-display)] text-lg tracking-tight">KOLO</span>
        <Link
          href="/sign-in"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-[#101410]/5 focus-visible:outline-2 focus-visible:outline-[var(--leaf)]"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="grid gap-6">
          <h1 className="kolo-reveal font-[family-name:var(--font-display)] text-5xl leading-[1.04] tracking-tight text-balance md:text-7xl">
            Nutrition <span className="text-[var(--amber)]">memory</span>
            <br />
            for your AI agent.
          </h1>
          <p
            className="kolo-reveal max-w-lg text-[15px] leading-relaxed text-[#101410]/70"
            style={{ '--kolo-reveal-index': 1 } as React.CSSProperties}
          >
            Connect your agent over MCP. It records what you eat and how you train, keeps your
            profile and goals, and looks up food nutrition — Kolo just remembers, perfectly.
          </p>
          <div
            className="kolo-reveal flex flex-wrap items-center gap-3"
            style={{ '--kolo-reveal-index': 2 } as React.CSSProperties}
          >
            <Link
              href="/sign-up"
              className="rounded-md bg-[var(--leaf)] px-6 py-3 text-sm font-medium text-white hover:bg-[#245633] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--leaf)]"
            >
              Create account
            </Link>
            <Link
              href="/sign-in"
              className="px-2 py-3 text-sm text-[#101410]/70 underline-offset-4 hover:underline"
            >
              I have one
            </Link>
          </div>
        </div>

        <dl
          className="kolo-reveal grid gap-6 border-t border-[#101410]/15 pt-8 sm:grid-cols-3"
          style={{ '--kolo-reveal-index': 3 } as React.CSSProperties}
        >
          {FEATURES.map((feature) => (
            <div key={feature.title} className="grid content-start gap-1">
              <dt className="text-sm font-semibold">{feature.title}</dt>
              <dd className="text-sm leading-relaxed text-[#101410]/60">{feature.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="mx-auto w-full max-w-4xl px-6 py-6">
        <p className="font-mono text-xs text-[#101410]/45">/mcp · Streamable HTTP · Bearer token</p>
      </footer>
    </main>
  );
}
