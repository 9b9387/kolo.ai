import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/better-auth';
import { SignOutButton } from './sign-out-button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-heading tracking-tight">
            KOLO
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/tokens" className="hover:text-foreground">
              Tokens
            </Link>
            <Link href="/connections" className="hover:text-foreground">
              Connected apps
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl flex-1 p-6">{children}</div>
    </div>
  );
}
