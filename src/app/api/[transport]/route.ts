import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerAllTools } from '@/mcp/registry';
import { verifyMcpToken } from '@/lib/auth/verify-mcp-token';

// Stateless Streamable HTTP endpoint at /api/mcp. No session ids, no Redis,
// no SSE — every POST is independent, which also matches the 2026-07-28
// stateless-first revision of the MCP spec.
const handler = createMcpHandler(
  (server) => registerAllTools(server),
  {
    serverInfo: { name: 'kolo', version: '0.1.0' },
  },
  {
    basePath: '/api',
    disableSse: true,
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== 'production',
  },
);

const authed = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authed as GET, authed as POST };
