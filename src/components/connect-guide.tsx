'use client';

import { useSyncExternalStore } from 'react';
import { CopyButton } from '@/components/copy-button';

// Generic MCP connection parameters + ready-to-paste client configs.
// Rendered on the landing page (token placeholder) and the tokens page.

const TOKEN_PLACEHOLDER = '<your kolo_pat_… token>';

function claudeCodeCommand(origin: string) {
  return `claude mcp add --transport http kolo ${origin}/mcp \\
  --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"`;
}

function jsonConfig(origin: string) {
  return JSON.stringify(
    {
      mcpServers: {
        kolo: {
          type: 'http',
          url: `${origin}/mcp`,
          headers: { Authorization: `Bearer ${TOKEN_PLACEHOLDER}` },
        },
      },
    },
    null,
    2,
  );
}

function Snippet({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

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
    ['Auth header', `Authorization: Bearer ${TOKEN_PLACEHOLDER}`],
    ['Scopes', 'profile · food · diary (tokens carry all three)'],
    ['Tools', '21 — profile, goals, preferences, body metrics, foods, diet & exercise logs, references'],
  ];

  return (
    <div className="grid gap-5">
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
      <Snippet title="Claude Code" text={claudeCodeCommand(origin)} />
      <Snippet title="JSON config (Claude Desktop, Cursor, …)" text={jsonConfig(origin)} />
      <p className="text-xs text-muted-foreground">
        Replace {TOKEN_PLACEHOLDER} with a token from the Tokens page. Keep it secret — it grants
        full access to your Kolo data.
      </p>
    </div>
  );
}
