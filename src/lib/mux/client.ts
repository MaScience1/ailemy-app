import "server-only";

import Mux from "@mux/mux-node";

/**
 * Server-only Mux REST API client.
 *
 * Use this when you need to interact with the Mux Video API from a server
 * component, server action, route handler, or webhook handler. Reads
 * MUX_TOKEN_ID and MUX_TOKEN_SECRET from the environment.
 *
 * Lazy + memoised
 * ---------------
 * We instantiate on first call, not at module load, so:
 *   * `next build` doesn't blow up on machines without Mux credentials (the
 *     module can be imported by a route handler whose env isn't populated
 *     until runtime — e.g. Vercel previews mid-setup).
 *   * Repeated callers within a single request share one client.
 *
 * The thrown error is intentionally specific so an engineer staring at a
 * 500 in the logs immediately knows which two env vars to set.
 */

let cached: Mux | null = null;

export function getMuxClient(): Mux {
  if (cached) return cached;

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error(
      "Mux client not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET in " +
        ".env.local (local) and in the Vercel project settings (production).",
    );
  }

  cached = new Mux({ tokenId, tokenSecret });
  return cached;
}
