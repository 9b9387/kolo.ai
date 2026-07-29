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

function SignUpForm() {
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
    // OAuth flow: block the after-hook's fetch-internal 302 and resume with
    // a top-level navigation instead (see sign-in for the full rationale).
    let error: { status?: number; message?: string | null } | null = null;
    try {
      const result = await authClient.signUp.email({
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
        fetchOptions: isOAuthFlow ? { redirect: 'manual' } : undefined,
      });
      error = result.error;
    } catch {
      // A blocked redirect can surface as a thrown network error; the
      // account and session were created before the hook fired.
    }
    setPending(false);
    // status 0 is the opaque-redirect result, not a validation failure.
    if (error && error.status !== 0) {
      setError(error.message ?? 'Sign-up failed.');
      return;
    }
    if (isOAuthFlow) {
      window.location.assign(`/api/auth/mcp/authorize?${searchParams.toString()}`);
      return;
    }
    router.push('/tokens');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>
          One account, then issue tokens for your agents.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
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
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex-col gap-3 pt-6">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Creating…' : 'Create account'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already registered?{' '}
            <Link
              className="underline underline-offset-4"
              href={`/sign-in${searchParams.size ? `?${searchParams.toString()}` : ''}`}
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Suspense>
        <SignUpForm />
      </Suspense>
    </main>
  );
}
