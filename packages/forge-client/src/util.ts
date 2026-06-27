import type { ForgeListing } from './types.js';

export function parseListing(raw: Record<string, unknown>): ForgeListing {
  return {
    id: String(raw.id ?? ''),
    sellerWallet: String(raw.sellerWallet ?? raw.seller_wallet ?? ''),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    category: String(raw.category ?? ''),
    priceMicroUsdc: Number(raw.priceMicroUsdc ?? raw.price_micro_usdc ?? 0),
    contentType: String(raw.contentType ?? raw.content_type ?? ''),
    byteSize: Number(raw.byteSize ?? raw.byte_size ?? 0),
    agentFriendly: Boolean(raw.agentFriendly ?? raw.agent_friendly),
    deliveryScheme: String(raw.deliveryScheme ?? raw.delivery_scheme ?? ''),
    previewUrl: String(raw.previewUrl ?? raw.preview_url ?? ''),
    previewContentType: String(
      raw.previewContentType ?? raw.preview_content_type ?? '',
    ),
    tags: Array.isArray(raw.tags) ? (raw.tags as unknown[]).map(String) : [],
    license: raw.license ? String(raw.license) : undefined,
    contentHash: raw.contentHash
      ? String(raw.contentHash)
      : raw.content_hash
        ? String(raw.content_hash)
        : undefined,
    qualityScore:
      raw.qualityScore != null || raw.quality_score != null
        ? Number(raw.qualityScore ?? raw.quality_score)
        : undefined,
    verifiedFeedbackCount:
      raw.verifiedFeedbackCount != null || raw.verified_feedback_count != null
        ? Number(raw.verifiedFeedbackCount ?? raw.verified_feedback_count)
        : undefined,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

export function apiBase(forgeApiBase: string): string {
  return forgeApiBase.replace(/\/$/, '');
}

export function defaultFetch(fetchFn?: typeof fetch): typeof fetch {
  return fetchFn ?? fetch;
}
