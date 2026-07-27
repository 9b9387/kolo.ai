import Link from 'next/link';

// Minimal landing: one oversized statement, one line of context, one action.
// Colors and the display face come from the global theme (globals.css).

const FEATURES: { title: string; body: string }[] = [
  { title: 'Profile & goals', body: 'The facts your agent needs for its own math.' },
  { title: 'Meals & workouts', body: 'Structured daily records, written by your agent.' },
  { title: 'Food nutrition', body: 'Per-100g data your agent can look up any time.' },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-5">
        <span className="font-heading text-lg tracking-tight">KOLO</span>
        <Link
          href="/sign-in"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="grid gap-6">
          <h1 className="kolo-reveal font-heading text-5xl leading-[1.04] tracking-tight text-balance md:text-7xl">
            Nutrition <span className="text-amber">memory</span>
            <br />
            for your AI agent.
          </h1>
          <p
            className="kolo-reveal max-w-lg text-[15px] leading-relaxed text-foreground/70"
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
              className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Create account
            </Link>
            <Link
              href="/sign-in"
              className="px-2 py-3 text-sm text-foreground/70 underline-offset-4 hover:underline"
            >
              I have one
            </Link>
          </div>
        </div>

        <dl
          className="kolo-reveal grid gap-6 border-t border-foreground/15 pt-8 sm:grid-cols-3"
          style={{ '--kolo-reveal-index': 3 } as React.CSSProperties}
        >
          {FEATURES.map((feature) => (
            <div key={feature.title} className="grid content-start gap-1">
              <dt className="text-sm font-semibold">{feature.title}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{feature.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="mx-auto w-full max-w-4xl px-6 py-6">
        <p className="font-mono text-xs text-muted-foreground/80">
          /mcp · Streamable HTTP · Bearer token
        </p>
      </footer>
    </main>
  );
}
