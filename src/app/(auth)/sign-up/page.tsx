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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.signUp.email({
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    setPending(false);
    if (error) {
      setError(error.message ?? 'Sign-up failed.');
      return;
    }
    // MCP OAuth flow: resume the authorize request that redirected here
    // (see sign-in for why this is a top-level navigation).
    if (searchParams.has('client_id') && searchParams.has('response_type')) {
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
