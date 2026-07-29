'use client';

import { useSyncExternalStore } from 'react';

// Generic MCP connection parameters, shown after sign-in on the tokens page.

const TOKEN_PLACEHOLDER = '<your kolo_pat_… token>';

const subscribeNoop = () => () => {};

export function ConnectGuide() {
  // Origin is only known in the browser; the server snapshot renders nothing
  // and React swaps in the client value without a hydration mismatch.
  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => null,
  );
  if (!origin) return null;

  const parameters: [string, string][] = [
    ['Endpoint', `${origin}/mcp`],
    ['Transport', 'HTTP (MCP Streamable HTTP, stateless)'],
    ['OAuth', 'Supported clients (Claude, Hermes, OpenClaw) just need the endpoint — a browser sign-in completes authorization, no token to paste'],
    ['Auth header', `Authorization: Bearer ${TOKEN_PLACEHOLDER} (headless clients without OAuth support)`],
    ['Scopes', 'profile · food · diary (tokens carry all three)'],
    ['Tools', '21 — profile, goals, preferences, body metrics, foods, diet & exercise logs, references'],
  ];

  return (
    <div className="grid gap-4">
      <dl className="grid gap-0 overflow-hidden rounded-md border">
        {parameters.map(([term, value]) => (
          <div
            key={term}
            className="grid grid-cols-[7.5rem_1fr] items-baseline gap-3 border-b px-3 py-2 text-sm last:border-b-0"
          >
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {term}
            </dt>
            <dd className="font-mono text-xs break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Prefer OAuth when your client supports it. Otherwise replace {TOKEN_PLACEHOLDER} with a
        token from this page and keep it secret — it grants full access to your Kolo data.
      </p>
    </div>
  );
}
