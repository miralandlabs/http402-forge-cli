import type { ForgeClientOptions } from './types.js';
import { apiBase, defaultFetch } from './util.js';

const PORTAL_URL = 'https://http402.trade/.well-known/x402-portal.json';

export async function forgePortalManifest(
  options: Pick<ForgeClientOptions, 'fetchFn'> & { portalUrl?: string },
): Promise<Record<string, unknown>> {
  const fetchFn = defaultFetch(options.fetchFn);
  const url = options.portalUrl ?? PORTAL_URL;
  const res = await fetchFn(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`forge portal HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function forgeX402Resources(
  options: ForgeClientOptions,
): Promise<Record<string, unknown>> {
  const base = apiBase(options.forgeApiBase);
  const fetchFn = defaultFetch(options.fetchFn);
  const res = await fetchFn(`${base}/.well-known/x402-resources.json`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`forge x402-resources HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}
