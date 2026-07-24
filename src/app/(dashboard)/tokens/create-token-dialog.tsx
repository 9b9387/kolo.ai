'use client';

import { useActionState, useState } from 'react';
import { createPatAction, type CreatePatState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const EXPIRY_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'Never expires' },
];

function mcpSnippet(token: string, origin: string) {
  return `claude mcp add --transport http kolo ${origin}/api/mcp \\
  --header "Authorization: Bearer ${token}"`;
}

export function CreateTokenDialog() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'token' | 'snippet' | null>(null);
  const [state, formAction, pending] = useActionState<CreatePatState, FormData>(
    createPatAction,
    { status: 'idle' },
  );

  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  async function copy(text: string, which: 'token' | 'snippet') {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Once a token was shown, closing drops it for good — reload clears state.
        setOpen(next);
        if (!next && state.status === 'created') window.location.reload();
      }}
    >
      <DialogTrigger render={<Button>New token</Button>} />
      <DialogContent className="sm:max-w-lg">
        {state.status === 'created' ? (
          <>
            <DialogHeader>
              <DialogTitle>Token created</DialogTitle>
              <DialogDescription>
                Copy it now — <strong>it will never be shown again</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Token for “{state.name}”</Label>
                <div className="flex gap-2">
                  <Input readOnly value={state.token} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copy(state.token, 'token')}
                  >
                    {copied === 'token' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Connect Claude Code</Label>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                  {mcpSnippet(state.token, origin)}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copy(mcpSnippet(state.token, origin), 'snippet')}
                >
                  {copied === 'snippet' ? 'Copied' : 'Copy command'}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>New personal access token</DialogTitle>
              <DialogDescription>
                Grants an agent full access to your Kolo data over MCP.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="pat-name">Name</Label>
                <Input
                  id="pat-name"
                  name="name"
                  placeholder="Claude Code @ MacBook"
                  required
                  maxLength={100}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pat-expiry">Expires</Label>
                <select
                  id="pat-expiry"
                  name="expiry"
                  defaultValue="90"
                  className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  {EXPIRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {state.status === 'error' ? (
                <p className="text-sm text-destructive">{state.message}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create token'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
