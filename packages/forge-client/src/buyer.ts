import type { Keypair } from '@solana/web3.js';
import type {
  ForgeBuyResult,
  ForgeClientOptions,
  ForgeFeedbackOutcome,
  ForgeListResponse,
  ForgeListing,
} from './types.js';
import { sha256Hex, signForgeChallenge } from './auth.js';
import { parseListing, apiBase, defaultFetch } from './util.js';

export function verifyListingContent(
  listing: Pick<ForgeListing, 'contentHash'>,
  bytes: Buffer,
): 'ok' | 'hash_mismatch' | 'no_hash' {
  if (!listing.contentHash) return 'no_hash';
  return sha256Hex(bytes) === listing.contentHash.toLowerCase()
    ? 'ok'
    : 'hash_mismatch';
}

export async function forgeGetListing(
  options: ForgeClientOptions & { listingId: string },
): Promise<ForgeListing> {
  const base = apiBase(options.forgeApiBase);
  const res = await defaultFetch(options.fetchFn)(
    `${base}/api/v1/listings/${options.listingId}`,
  );
  if (!res.ok) throw new Error(`forge get listing HTTP ${res.status}`);
  return parseListing((await res.json()) as Record<string, unknown>);
}

export async function forgeSearch(
  options: ForgeClientOptions & {
    q?: string;
    category?: string;
    sellerWallet?: string;
    agentFriendly?: boolean;
    sort?: string;
    limit?: number;
    offset?: number;
  },
): Promise<ForgeListResponse> {
  const base = apiBase(options.forgeApiBase);
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.category) params.set('category', options.category);
  if (options.sellerWallet) params.set('seller_wallet', options.sellerWallet);
  if (options.agentFriendly != null) {
    params.set('agent_friendly', options.agentFriendly ? 'true' : 'false');
  }
  if (options.sort) params.set('sort', options.sort);
  if (options.limit != null) params.set('limit', String(options.limit));
  if (options.offset != null) params.set('offset', String(options.offset));

  const res = await defaultFetch(options.fetchFn)(`${base}/api/v1/listings?${params}`);
  if (!res.ok) throw new Error(`forge list HTTP ${res.status}`);
  const data = (await res.json()) as {
    items: Record<string, unknown>[];
    total: number;
  };
  return {
    total: data.total,
    items: data.items.map(parseListing),
  };
}

export async function forgeSaleFeedback(
  options: ForgeClientOptions & {
    saleId: string;
    buyerWallet: string;
    outcome: ForgeFeedbackOutcome;
    score?: number;
    note?: string;
    buyerKeypair?: Keypair;
    buyerChallenge?: string;
    buyerSignature?: string;
  },
): Promise<void> {
  const base = apiBase(options.forgeApiBase);
  const fetchFn = defaultFetch(options.fetchFn);

  let buyerChallenge = options.buyerChallenge;
  let buyerSignature = options.buyerSignature;

  if (options.buyerKeypair) {
    const q = new URLSearchParams({
      buyer_wallet: options.buyerWallet,
      sale_id: options.saleId,
    });
    const challengeRes = await fetchFn(
      `${base}/api/v1/buyer/feedback-challenge?${q}`,
      { cache: 'no-store' },
    );
    if (!challengeRes.ok) {
      throw new Error(`forge feedback challenge HTTP ${challengeRes.status}`);
    }
    const challengeJson = (await challengeRes.json()) as { message?: string };
    buyerChallenge = String(challengeJson.message ?? '');
    buyerSignature = signForgeChallenge(options.buyerKeypair, buyerChallenge);
  }

  if (!buyerChallenge || !buyerSignature) {
    throw new Error(
      'forgeSaleFeedback requires buyerKeypair or buyerChallenge + buyerSignature',
    );
  }

  const res = await fetchFn(`${base}/api/v1/sales/${options.saleId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyer_wallet: options.buyerWallet,
      buyer_challenge: buyerChallenge,
      buyer_signature: buyerSignature,
      outcome: options.outcome,
      score: options.score,
      note: options.note,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`forge sale feedback HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
}

export async function forgeBuy(
  options: ForgeClientOptions & {
    listingId: string;
    pay402Fetch: typeof fetch;
    outputPath?: string;
    listing?: Pick<ForgeListing, 'contentHash'>;
    autoFeedback?: boolean;
    buyerWallet?: string;
    buyerKeypair?: Keypair;
  },
): Promise<ForgeBuyResult> {
  const base = apiBase(options.forgeApiBase);
  const url = `${base}/api/v1/listings/${options.listingId}/download`;
  const res = await options.pay402Fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`forge buy HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type');
  const saleId = res.headers.get('x-forge-sale-id') ?? undefined;
  if (options.outputPath) {
    const fs = await import('fs/promises');
    await fs.writeFile(options.outputPath, buf);
  }

  const listing =
    options.listing ??
    (options.autoFeedback
      ? await forgeGetListing({
          forgeApiBase: options.forgeApiBase,
          fetchFn: options.fetchFn,
          listingId: options.listingId,
        })
      : undefined);

  const verify = listing ? verifyListingContent(listing, buf) : undefined;

  if (
    options.autoFeedback &&
    verify === 'hash_mismatch' &&
    saleId &&
    options.buyerKeypair &&
    options.buyerWallet
  ) {
    await forgeSaleFeedback({
      forgeApiBase: options.forgeApiBase,
      fetchFn: options.fetchFn,
      saleId,
      buyerWallet: options.buyerWallet,
      buyerKeypair: options.buyerKeypair,
      outcome: 'hash_mismatch',
    });
  }

  return { bytes: buf, contentType, saleId, verify };
}

export async function forgePreviewMeta(
  options: ForgeClientOptions & { listingId: string },
): Promise<{
  listingId: string;
  previewUrl: string;
  contentType: string | null;
  contentLength: string | null;
  acceptRanges: string | null;
}> {
  const base = apiBase(options.forgeApiBase);
  const url = `${base}/api/v1/listings/${options.listingId}/preview`;
  const fetchFn = defaultFetch(options.fetchFn);
  let res = await fetchFn(url, { method: 'HEAD' });
  if (!res.ok) res = await fetchFn(url);
  if (!res.ok) throw new Error(`forge preview HTTP ${res.status}`);
  return {
    listingId: options.listingId,
    previewUrl: url,
    contentType: res.headers.get('content-type'),
    contentLength: res.headers.get('content-length'),
    acceptRanges: res.headers.get('accept-ranges'),
  };
}
