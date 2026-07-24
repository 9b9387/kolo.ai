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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    setPending(false);
    if (error) {
      setError(error.message ?? 'Sign-in failed.');
      return;
    }
    router.push(searchParams.get('redirect') ?? '/tokens');
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
            <Link className="underline underline-offset-4" href="/sign-up">
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
