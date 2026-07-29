import { oAuthDiscoveryMetadata } from 'better-auth/plugins';
import { auth } from '@/lib/auth/better-auth';

// RFC 8414 Authorization Server Metadata. better-auth serves its endpoints
// under /api/auth/*, but discovery must live at the origin root — this route
// re-exports the mcp plugin's metadata (issuer, authorize/token endpoints,
// registration_endpoint for DCR) where clients expect it.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const metadataHandler = oAuthDiscoveryMetadata(auth);

export async function GET(request: Request) {
  const response = await metadataHandler(request);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
