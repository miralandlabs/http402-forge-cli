export type ForgeFeedbackOutcome =
  | 'as_described'
  | 'hash_mismatch'
  | 'corrupt'
  | 'misleading'
  | 'other';

export interface ForgeListing {
  id: string;
  sellerWallet: string;
  title: string;
  description: string;
  category: string;
  priceMicroUsdc: number;
  contentType: string;
  byteSize: number;
  agentFriendly: boolean;
  deliveryScheme: string;
  previewUrl: string;
  previewContentType: string;
  tags?: string[];
  license?: string;
  contentHash?: string;
  qualityScore?: number;
  verifiedFeedbackCount?: number;
  createdAt: string;
}

export interface ForgeListResponse {
  items: ForgeListing[];
  total: number;
}

export interface ForgeBuyResult {
  bytes: Buffer;
  contentType: string | null;
  saleId?: string;
  verify?: 'ok' | 'hash_mismatch' | 'no_hash';
}

export interface ForgeClientOptions {
  forgeApiBase: string;
  facilitatorBase?: string;
  fetchFn?: typeof fetch;
}

export interface ForgeChallenge {
  message: string;
  expiresAt: string;
}

export interface ForgeCapabilities {
  presignedUpload: boolean;
  presignedDownload: boolean;
  objectDelivery: string;
}

export interface ForgeSellerStatus {
  vaultActivated: boolean;
  canSell: boolean;
  vaultPda: string | null;
  feeBps: number | null;
  protocolFeePercent: string | null;
  sellerDashboardUrl: string;
  vaultCheckEnforced: boolean;
}

export interface ForgePublishInput {
  sellerKeypair: import('@solana/web3.js').Keypair;
  title: string;
  description?: string;
  category: string;
  priceUsdc: string;
  assetPath: string;
  assetContentType?: string;
  previewPath?: string;
  previewContentType?: string;
  agentFriendly?: boolean;
  tags?: string;
  license?: string;
  contentHash?: string;
  displayName?: string;
}

export interface PresignedUploadTarget {
  objectKey: string;
  method: string;
  url: string;
  headers: [string, string][];
}

export interface UploadSessionResponse {
  listingId: string;
  expiresAt: string;
  asset: PresignedUploadTarget;
  preview?: PresignedUploadTarget;
}

export type ForgeCategory =
  | 'art'
  | 'text'
  | 'audio'
  | 'video'
  | 'prompt_pack';
