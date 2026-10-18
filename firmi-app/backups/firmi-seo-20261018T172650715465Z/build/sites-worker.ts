import { accountGate } from "../lib/account-auth";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const pathname = new URL(request.url).pathname;
    const assets = (env as Cloudflare.Env & {
      ASSETS?: { fetch(request: Request): Promise<Response> };
    }).ASSETS;
    if (assets && (
      pathname.startsWith("/_next/static/") ||
      pathname === "/favicon.svg" ||
      pathname === "/favicon.ico"
    )) {
      return assets.fetch(request);
    }
    const denied = await accountGate(request, env, ctx);
    if (denied) return denied;
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const headers = new Headers(response.headers);
    if (!new URL(request.url).pathname.startsWith('/_next/static/')) {
      headers.set('Cache-Control', 'private, no-store');
      headers.set('CDN-Cache-Control', 'no-store');
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
