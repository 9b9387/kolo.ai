import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/better-auth';
import { prisma } from '@/lib/db';
import { DisconnectButton } from './disconnect-button';
import { LocalDate } from '../tokens/local-date';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Connection = {
  clientId: string;
  name: string;
  connectedAt: Date;
  lastActive: Date;
  active: boolean;
};

export default async function ConnectionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in?redirect=/connections');

  const tokens = await prisma.oauthAccessToken.findMany({
    where: { userId: session.user.id },
    include: { application: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // One row per client. Refresh rotations leave multiple token rows behind;
  // the grant is alive while any refresh token is unexpired.
  const now = new Date();
  const byClient = new Map<string, Connection>();
  for (const token of tokens) {
    const existing = byClient.get(token.clientId);
    const active = token.refreshTokenExpiresAt > now || token.accessTokenExpiresAt > now;
    if (!existing) {
      byClient.set(token.clientId, {
        clientId: token.clientId,
        name: token.application.name || 'Unnamed client',
        connectedAt: token.createdAt,
        lastActive: token.updatedAt,
        active,
      });
    } else {
      if (token.updatedAt > existing.lastActive) existing.lastActive = token.updatedAt;
      existing.active ||= active;
    }
  }
  const connections = [...byClient.values()].sort(
    (a, b) => b.lastActive.getTime() - a.lastActive.getTime(),
  );

  return (
    <main className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl tracking-tight">Connected apps</h1>
        <p className="text-sm text-muted-foreground">
          Clients you authorized over OAuth. Disconnecting stops their tokens
          immediately; personal access tokens are managed on the Tokens page.
        </p>
      </div>

      {connections.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No connected apps. Add the MCP endpoint in an OAuth-capable client
          and authorize it to see it here.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>Client ID</TableHead>
              <TableHead>Connected</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.map((connection) => (
              <TableRow key={connection.clientId}>
                <TableCell className="font-medium">{connection.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {connection.clientId.slice(0, 8)}…
                </TableCell>
                <TableCell>
                  <LocalDate value={connection.connectedAt} />
                </TableCell>
                <TableCell>
                  <LocalDate value={connection.lastActive} />
                </TableCell>
                <TableCell>
                  <Badge variant={connection.active ? 'default' : 'secondary'}>
                    {connection.active ? 'active' : 'expired'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DisconnectButton clientId={connection.clientId} name={connection.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
