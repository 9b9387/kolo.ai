'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isOAuthFlow = searchParams.has('client_id') && searchParams.has('response_type');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    // MCP OAuth flow: the mcp plugin's after-hook rewrites this response into
    // a 302 straight to the client's callback. Following it from a fetch
    // context is unreliable (CORS/PNA) and strands this page on the pending
    // state — `redirect: manual` keeps the code undelivered here (the session
    // cookie still lands) and the top-level navigation below resumes
    // authorize deterministically.
    let error: { status?: number; message?: string | null } | null = null;
    try {
      const result = await authClient.signIn.email({
        email: String(form.get('email')),
        password: String(form.get('password')),
        fetchOptions: isOAuthFlow ? { redirect: 'manual' } : undefined,
      });
      error = result.error;
    } catch {
      // A blocked redirect can still surface as a thrown network error in
      // some browsers; the sign-in itself succeeded before the hook fired.
    }
    setPending(false);
    // status 0 is the opaque-redirect result, not a credential failure.
    if (error && error.status !== 0) {
      setError(error.message ?? 'Sign-in failed.');
      return;
    }
    if (isOAuthFlow) {
      window.location.assign(`/api/auth/mcp/authorize?${searchParams.toString()}`);
      return;
    }
    // Only same-site paths: a raw value here would be an open redirect
    // (absolute, protocol-relative // and /\ forms all escape the origin).
    const redirect = searchParams.get('redirect');
    const target =
      redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\')
        ? redirect
        : '/tokens';
    router.push(target);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your Kolo tokens.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex-col gap-3 pt-6">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-sm text-muted-foreground">
            No account?{' '}
            {/* Carry the query across so an in-flight OAuth authorize
                survives switching to sign-up. */}
            <Link
              className="underline underline-offset-4"
              href={`/sign-up${searchParams.size ? `?${searchParams.toString()}` : ''}`}
            >
              Create one
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
