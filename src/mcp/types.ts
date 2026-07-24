import type { ZodRawShape, z } from 'zod';
import type { Scope } from '@/lib/auth/scopes';

export interface AuthContext {
  userId: string;
  scopes: Scope[];
  clientId: string; // phase 1: userId; phase 2 OAuth: client_id
  authMethod: 'pat' | 'oauth';
  tokenId?: string;
}

export type ToolErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'FORBIDDEN_SCOPE'
  | 'LIMIT_EXCEEDED'
  | 'INTERNAL';

export class ToolError extends Error {
  constructor(
    public code: ToolErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

// Kolo's tool shape, deliberately decoupled from the mcp-handler/SDK API —
// register.ts is the only file that touches the SDK, so a future SDK v2
// migration stays contained there.
export interface ToolDef<I extends ZodRawShape = ZodRawShape> {
  name: string;
  title: string;
  /** Should say WHEN to call the tool, not just what it does. */
  description: string;
  inputSchema: I;
  outputSchema?: ZodRawShape;
  annotations: ToolAnnotations;
  requiredScopes: Scope[];
  handler: (
    input: z.objectOutputType<I, z.ZodTypeAny>,
    ctx: AuthContext,
  ) => Promise<Record<string, unknown>>;
}

// Type-erased form used by the registry; ToolDef<I> is invariant in I, so a
// heterogeneous list needs the erased shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDef = ToolDef<any>;
