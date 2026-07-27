import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Kolo</h1>
      <p className="max-w-xl text-balance text-muted-foreground">
        Headless nutrition-data backend for AI agents. Clean food data, user
        profiles, goals and diet logs — served over MCP. Kolo stores and
        serves; your agent does the thinking.
      </p>
      <div className="flex gap-3">
        <Button render={<Link href="/sign-in" />}>Sign in</Button>
        <Button variant="outline" render={<Link href="/sign-up" />}>
          Create account
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        MCP endpoint: <code className="font-mono">/mcp</code> · authorize
        with a personal access token from the Tokens page
      </p>
    </main>
  );
}
