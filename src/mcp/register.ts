import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { serialize } from '@/lib/serialize';
import { AuthContext, AnyToolDef, ToolError } from './types';
import type { Scope } from '@/lib/auth/scopes';

// The only file that touches the mcp-handler / SDK registration API.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAuthContext(extra: any): AuthContext {
  const info = extra?.authInfo;
  const userId = info?.extra?.userId as string | undefined;
  if (!userId) {
    // withMcpAuth({ required: true }) makes this unreachable; fail closed anyway.
    throw new ToolError('INTERNAL', 'missing auth context');
  }
  return {
    userId,
    scopes: (info.scopes ?? []) as Scope[],
    clientId: info.clientId as string,
    authMethod: (info.extra?.authMethod as 'pat' | 'oauth') ?? 'pat',
    tokenId: info.extra?.tokenId as string | undefined,
  };
}

function errResult(code: string, message: string, details?: unknown) {
  const body = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify(body) }],
  };
}

export function registerTool(server: McpServer, tool: AnyToolDef) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
      annotations: tool.annotations,
    },
    async (input: unknown, extra: unknown) => {
      try {
        const ctx = toAuthContext(extra);
        const missing = tool.requiredScopes.filter((s) => !ctx.scopes.includes(s));
        if (missing.length > 0) {
          return errResult('FORBIDDEN_SCOPE', `token missing scopes: ${missing.join(', ')}`);
        }
        const data = serialize(
          await tool.handler(input as Record<string, unknown>, ctx),
        ) as Record<string, unknown>;
        return {
          // text mirror first: older clients only read content.
          content: [{ type: 'text' as const, text: JSON.stringify(data) }],
          structuredContent: data,
        };
      } catch (err) {
        if (err instanceof ToolError) return errResult(err.code, err.message, err.details);
        console.error(`[mcp] ${tool.name} failed`, err);
        return errResult('INTERNAL', 'unexpected server error');
      }
    },
  );
}
