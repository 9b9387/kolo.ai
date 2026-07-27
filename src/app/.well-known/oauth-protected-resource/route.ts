import { ALL_SCOPES } from '@/lib/auth/scopes';

// RFC 9728 Protected Resource Metadata. Live from phase 1: hosted MCP
// clients discover the authorization server through the 401 →
// WWW-Authenticate → this document chain. Phase 2 only has to stand up
// the authorization server itself.
//
// `resource` must match the MCP URL the user types character-for-character.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function baseUrl(request: Request): string {
  const configured = process.env.KOLO_BASE_URL ?? process.env.BETTER_AUTH_URL;
  if (configured) return configured.replace(/\/$/, '');
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const base = baseUrl(request);
  return Response.json(
    {
      resource: `${base}/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ['header'],
      scopes_supported: ALL_SCOPES,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
