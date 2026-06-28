# @http402/forge-client

TypeScript SDK for the http402 **Forge Digital Bazaar** — search, buy, publish, delist, and vault management with x402 payments.

## Install

```bash
npm install @http402/forge-client @pr402/buyer-typescript
```

## Environment

Configure URLs and keys in your app (or via `process.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `FORGE_API_BASE` | Forge API URL | `https://preview.forge.http402.trade` |
| `FACILITATOR_BASE` | x402 facilitator URL | `https://preview.ipay.sh` |
| `FORGE_KEYPAIR` | Path to Solana keypair JSON file | — |
| `FORGE_SECRET_KEY` | Base58 or JSON-array secret key | — |

## Basic usage

```typescript
import { Keypair } from '@solana/web3.js';
import {
  createForgePayFetch,
  forgeSearch,
  forgeBuy,
  forgePublish,
} from '@http402/forge-client';

const forgeApiBase = process.env.FORGE_API_BASE ?? 'https://preview.forge.http402.trade';
const facilitatorBase = process.env.FACILITATOR_BASE ?? 'https://preview.ipay.sh';
const keypair = Keypair.fromSecretKey(/* your secret */);

// Browse catalog
const { items } = await forgeSearch({ forgeApiBase, q: 'art', limit: 20 });

// Buy with x402
const pay402Fetch = createForgePayFetch(keypair, facilitatorBase);
const { bytes, contentType } = await forgeBuy({
  forgeApiBase,
  listingId: items[0].id,
  pay402Fetch,
  outputPath: './download.bin',
});

// Publish (seller)
await forgePublish({
  forgeApiBase,
  sellerKeypair: keypair,
  assetPath: './asset.bin',
  title: 'My Listing',
  priceUsdc: '0.05',
  category: 'art',
});
```

See exports in `index.ts` for vault, delist, preview, and verification helpers.
