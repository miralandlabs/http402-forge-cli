import { createHash } from 'crypto';
import type { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import type { ForgeChallenge } from './types.js';
import { apiBase, defaultFetch } from './util.js';

export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function signForgeChallenge(keypair: Keypair, message: string): string {
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  return Buffer.from(signature).toString('base64');
}

export async function forgeSellerChallenge(
  forgeApiBase: string,
  sellerWallet: string,
  fetchFn?: typeof fetch,
): Promise<ForgeChallenge> {
  const base = apiBase(forgeApiBase);
  const q = new URLSearchParams({ seller_wallet: sellerWallet });
  const res = await defaultFetch(fetchFn)(
    `${base}/api/v1/seller/challenge?${q}`,
    { cache: 'no-store' },
  );
  if (!res.ok) {
    throw new Error(`forge seller challenge HTTP ${res.status}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    message: String(raw.message ?? ''),
    expiresAt: String(raw.expiresAt ?? raw.expires_at ?? ''),
  };
}

export async function forgeDelistChallenge(
  forgeApiBase: string,
  sellerWallet: string,
  listingId: string,
  fetchFn?: typeof fetch,
): Promise<ForgeChallenge> {
  const base = apiBase(forgeApiBase);
  const q = new URLSearchParams({
    seller_wallet: sellerWallet,
    listing_id: listingId,
  });
  const res = await defaultFetch(fetchFn)(
    `${base}/api/v1/seller/delist-challenge?${q}`,
    { cache: 'no-store' },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`forge delist challenge HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    message: String(raw.message ?? ''),
    expiresAt: String(raw.expiresAt ?? raw.expires_at ?? ''),
  };
}

export function signedSellerFields(
  keypair: Keypair,
  challenge: ForgeChallenge,
): {
  sellerWallet: string;
  sellerChallenge: string;
  sellerSignature: string;
} {
  return {
    sellerWallet: keypair.publicKey.toBase58(),
    sellerChallenge: challenge.message,
    sellerSignature: signForgeChallenge(keypair, challenge.message),
  };
}
