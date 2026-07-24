import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/better-auth';
import { prisma } from '@/lib/db';
import { PAT_PREFIX } from '@/lib/auth/pat';
import { revokePatAction } from './actions';
import { CreateTokenDialog } from './create-token-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function tokenStatus(token: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): 'active' | 'expired' | 'revoked' {
  if (token.revokedAt) return 'revoked';
  if (token.expiresAt && token.expiresAt < new Date()) return 'expired';
  return 'active';
}

const STATUS_VARIANT = {
  active: 'default',
  expired: 'secondary',
  revoked: 'outline',
} as const;

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '—';
}

export default async function TokensPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const tokens = await prisma.personalAccessToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Personal access tokens</h1>
          <p className="text-sm text-muted-foreground">
            Tokens authorize agents against the MCP endpoint. The full value is
            shown only once, at creation.
          </p>
        </div>
        <CreateTokenDialog />
      </div>

      {tokens.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tokens yet. Create one to connect your agent.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => {
              const status = tokenStatus(token);
              return (
                <TableRow key={token.id}>
                  <TableCell className="font-medium">{token.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {PAT_PREFIX}…{token.lastFour}
                  </TableCell>
                  <TableCell>{formatDate(token.createdAt)}</TableCell>
                  <TableCell>{formatDate(token.expiresAt)}</TableCell>
                  <TableCell>{formatDate(token.lastUsedAt)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {status === 'active' ? (
                      <form action={revokePatAction}>
                        <input type="hidden" name="id" value={token.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          Revoke
                        </Button>
                      </form>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
