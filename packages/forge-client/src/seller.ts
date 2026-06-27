import { readFile, stat } from 'fs/promises';
import { extname } from 'path';
import type { Keypair } from '@solana/web3.js';
import type {
  ForgeCapabilities,
  ForgeClientOptions,
  ForgeListing,
  ForgePublishInput,
  ForgeSellerStatus,
  PresignedUploadTarget,
  UploadSessionResponse,
} from './types.js';
import {
  forgeDelistChallenge,
  forgeSellerChallenge,
  signedSellerFields,
} from './auth.js';
import { parseListing, apiBase, defaultFetch } from './util.js';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
};

export function guessContentType(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export async function forgeCapabilities(
  options: ForgeClientOptions,
): Promise<ForgeCapabilities> {
  const base = apiBase(options.forgeApiBase);
  const res = await defaultFetch(options.fetchFn)(`${base}/api/v1/capabilities`);
  if (!res.ok) throw new Error(`forge capabilities HTTP ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    presignedUpload: Boolean(raw.presignedUpload ?? raw.presigned_upload),
    presignedDownload: Boolean(raw.presignedDownload ?? raw.presigned_download),
    objectDelivery: String(raw.objectDelivery ?? raw.object_delivery ?? 'proxy'),
  };
}

export async function forgeVaultStatus(
  options: ForgeClientOptions & { sellerWallet: string },
): Promise<ForgeSellerStatus> {
  const base = apiBase(options.forgeApiBase);
  const q = new URLSearchParams({ seller_wallet: options.sellerWallet });
  const res = await defaultFetch(options.fetchFn)(
    `${base}/api/v1/seller/status?${q}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`forge vault status HTTP ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    vaultActivated: Boolean(raw.vaultActivated ?? raw.vault_activated),
    canSell: Boolean(raw.canSell ?? raw.can_sell),
    vaultPda: raw.vaultPda != null ? String(raw.vaultPda) : raw.vault_pda != null ? String(raw.vault_pda) : null,
    feeBps: raw.feeBps != null ? Number(raw.feeBps) : raw.fee_bps != null ? Number(raw.fee_bps) : null,
    protocolFeePercent:
      raw.protocolFeePercent != null
        ? String(raw.protocolFeePercent)
        : raw.protocol_fee_percent != null
          ? String(raw.protocol_fee_percent)
          : null,
    sellerDashboardUrl: String(raw.sellerDashboardUrl ?? raw.seller_dashboard_url ?? ''),
    vaultCheckEnforced: Boolean(raw.vaultCheckEnforced ?? raw.vault_check_enforced),
  };
}

export async function forgeProvisionVaultTx(
  options: ForgeClientOptions & { sellerWallet: string; asset?: string },
): Promise<Record<string, unknown>> {
  const base = apiBase(options.forgeApiBase);
  const res = await defaultFetch(options.fetchFn)(`${base}/api/v1/seller/provision-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sellerWallet: options.sellerWallet,
      asset: options.asset ?? 'USDC',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`forge provision-tx HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function putPresigned(
  target: PresignedUploadTarget,
  bytes: Buffer,
  fetchFn?: typeof fetch,
): Promise<void> {
  const headers = new Headers(target.headers);
  const res = await defaultFetch(fetchFn)(target.url, {
    method: target.method as 'PUT',
    headers,
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`presigned upload HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
}

function parseUploadSession(raw: Record<string, unknown>): UploadSessionResponse {
  const parseTarget = (t: Record<string, unknown>): PresignedUploadTarget => ({
    objectKey: String(t.objectKey ?? t.object_key ?? ''),
    method: String(t.method ?? 'PUT'),
    url: String(t.url ?? ''),
    headers: Array.isArray(t.headers)
      ? (t.headers as unknown[]).map((h) => {
          const pair = h as [string, string];
          return [String(pair[0]), String(pair[1])] as [string, string];
        })
      : [],
  });
  return {
    listingId: String(raw.listingId ?? raw.listing_id ?? ''),
    expiresAt: String(raw.expiresAt ?? raw.expires_at ?? ''),
    asset: parseTarget((raw.asset ?? {}) as Record<string, unknown>),
    preview: raw.preview
      ? parseTarget(raw.preview as Record<string, unknown>)
      : undefined,
  };
}

export async function forgePublishPresigned(
  options: ForgeClientOptions & ForgePublishInput,
): Promise<ForgeListing> {
  const base = apiBase(options.forgeApiBase);
  const fetchFn = defaultFetch(options.fetchFn);
  const assetBytes = await readFile(options.assetPath);
  const assetStat = await stat(options.assetPath);
  const assetContentType = options.assetContentType ?? guessContentType(options.assetPath);

  const challenge = await forgeSellerChallenge(base, options.sellerKeypair.publicKey.toBase58(), fetchFn);
  const signed = signedSellerFields(options.sellerKeypair, challenge);

  let previewBytes: Buffer | undefined;
  let previewContentType: string | undefined;
  if (options.previewPath) {
    previewBytes = await readFile(options.previewPath);
    previewContentType = options.previewContentType ?? guessContentType(options.previewPath);
  }

  const sessionBody: Record<string, unknown> = {
    sellerWallet: signed.sellerWallet,
    sellerChallenge: signed.sellerChallenge,
    sellerSignature: signed.sellerSignature,
    assetContentType,
    assetByteSize: assetStat.size,
  };
  if (previewBytes && previewContentType) {
    sessionBody.previewContentType = previewContentType;
    sessionBody.previewByteSize = previewBytes.length;
  }

  const sessionRes = await fetchFn(`${base}/api/v1/listings/upload-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionBody),
  });
  if (!sessionRes.ok) {
    const text = await sessionRes.text();
    throw new Error(`upload-session HTTP ${sessionRes.status}: ${text.slice(0, 240)}`);
  }
  const session = parseUploadSession((await sessionRes.json()) as Record<string, unknown>);

  await putPresigned(session.asset, assetBytes, fetchFn);
  if (session.preview && previewBytes) {
    await putPresigned(session.preview, previewBytes, fetchFn);
  }

  const completeBody = {
    listingId: session.listingId,
    sellerWallet: signed.sellerWallet,
    sellerChallenge: signed.sellerChallenge,
    sellerSignature: signed.sellerSignature,
    title: options.title,
    description: options.description ?? '',
    category: options.category,
    priceUsdc: options.priceUsdc,
    agentFriendly: options.agentFriendly ?? false,
    displayName: options.displayName,
    tags: options.tags,
    license: options.license,
    contentHash: options.contentHash,
    previewUploaded: Boolean(session.preview && previewBytes),
  };

  const completeRes = await fetchFn(`${base}/api/v1/listings/complete-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(completeBody),
  });
  if (!completeRes.ok) {
    const text = await completeRes.text();
    throw new Error(`complete-upload HTTP ${completeRes.status}: ${text.slice(0, 240)}`);
  }
  return parseListing((await completeRes.json()) as Record<string, unknown>);
}

export async function forgePublishMultipart(
  options: ForgeClientOptions & ForgePublishInput,
): Promise<ForgeListing> {
  const base = apiBase(options.forgeApiBase);
  const fetchFn = defaultFetch(options.fetchFn);
  const assetBytes = await readFile(options.assetPath);

  const challenge = await forgeSellerChallenge(base, options.sellerKeypair.publicKey.toBase58(), fetchFn);
  const signed = signedSellerFields(options.sellerKeypair, challenge);

  const form = new FormData();
  form.set('seller_wallet', signed.sellerWallet);
  form.set('seller_challenge', signed.sellerChallenge);
  form.set('seller_signature', signed.sellerSignature);
  form.set('title', options.title);
  form.set('description', options.description ?? '');
  form.set('category', options.category);
  form.set('price_usdc', options.priceUsdc);
  if (options.agentFriendly) form.set('agent_friendly', 'true');
  if (options.tags) form.set('tags', options.tags);
  if (options.license) form.set('license', options.license);
  if (options.contentHash) form.set('content_hash', options.contentHash);
  if (options.displayName) form.set('display_name', options.displayName);

  const assetBlob = new Blob([new Uint8Array(assetBytes)], {
    type: options.assetContentType ?? guessContentType(options.assetPath),
  });
  form.set('asset', assetBlob, options.assetPath.split('/').pop() ?? 'asset');

  if (options.previewPath) {
    const previewBytes = await readFile(options.previewPath);
    const previewBlob = new Blob([new Uint8Array(previewBytes)], {
      type: options.previewContentType ?? guessContentType(options.previewPath),
    });
    form.set('preview', previewBlob, options.previewPath.split('/').pop() ?? 'preview');
  }

  const res = await fetchFn(`${base}/api/v1/listings`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`forge publish multipart HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  return parseListing((await res.json()) as Record<string, unknown>);
}

export async function forgePublish(
  options: ForgeClientOptions & ForgePublishInput,
): Promise<ForgeListing> {
  const caps = await forgeCapabilities(options);
  if (caps.presignedUpload) {
    return forgePublishPresigned(options);
  }
  return forgePublishMultipart(options);
}

export async function forgeDelist(
  options: ForgeClientOptions & {
    listingId: string;
    sellerKeypair: Keypair;
  },
): Promise<void> {
  const base = apiBase(options.forgeApiBase);
  const fetchFn = defaultFetch(options.fetchFn);
  const wallet = options.sellerKeypair.publicKey.toBase58();
  const challenge = await forgeDelistChallenge(base, wallet, options.listingId, fetchFn);
  const signed = signedSellerFields(options.sellerKeypair, challenge);

  const res = await fetchFn(`${base}/api/v1/listings/${options.listingId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seller_wallet: signed.sellerWallet,
      seller_challenge: signed.sellerChallenge,
      seller_signature: signed.sellerSignature,
    }),
  });
  if (res.status !== 204 && !res.ok) {
    const text = await res.text();
    throw new Error(`forge delist HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
}
