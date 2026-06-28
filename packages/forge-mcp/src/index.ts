#!/usr/bin/env node
/**
 * @http402/forge-mcp — MCP server for Digital Bazaar (list, preview, buy, publish, delist, vault).
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  createForgePayFetch,
  forgeBuy,
  forgeDelist,
  forgePreviewMeta,
  forgePublish,
  forgeSearch,
  forgeVaultStatus,
} from '@http402/forge-client';

const require = createRequire(import.meta.url);
const { version: packageVersion } = require('../package.json') as { version: string };

function env(name: string, fallback?: string): string {
  const v = process.env[name]?.trim();
  if (v) return v.replace(/\/$/, '');
  if (fallback) return fallback;
  throw new Error(`${name} is required`);
}

function loadKeypair(): Keypair | null {
  const path = process.env.FORGE_KEYPAIR?.trim();
  const rawEnv =
    process.env.FORGE_SECRET_KEY?.trim() ?? process.env.BUYER_SECRET_KEY?.trim();
  if (path) {
    return Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')) as number[]),
    );
  }
  const raw = rawEnv;
  if (!raw) return null;
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  }
  return Keypair.fromSecretKey(bs58.decode(raw));
}

const forgeApiBase = env('FORGE_API_BASE', 'https://preview.forge.http402.trade');
const facilitatorBase = env('FACILITATOR_BASE', 'https://preview.ipay.sh');
const payer = loadKeypair();
const pay402Fetch = payer
  ? createForgePayFetch(payer, facilitatorBase)
  : null;

const server = new Server(
  { name: '@http402/forge-mcp', version: packageVersion },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'forge_list',
      description: 'Search Forge listings',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          category: { type: 'string' },
          seller_wallet: { type: 'string' },
          agent_friendly: { type: 'boolean' },
          sort: { type: 'string' },
          limit: { type: 'number' },
          offset: { type: 'number' },
        },
      },
    },
    {
      name: 'forge_preview',
      description: 'Preview metadata for a listing',
      inputSchema: {
        type: 'object',
        properties: { listing_id: { type: 'string' } },
        required: ['listing_id'],
      },
    },
    {
      name: 'forge_purchase',
      description: 'Buy and download via x402 (requires FORGE_SECRET_KEY)',
      inputSchema: {
        type: 'object',
        properties: { listing_id: { type: 'string' } },
        required: ['listing_id'],
      },
    },
    {
      name: 'forge_publish',
      description: 'Publish listing (requires FORGE_SECRET_KEY)',
      inputSchema: {
        type: 'object',
        properties: {
          asset_path: { type: 'string' },
          title: { type: 'string' },
          price_usdc: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          agent_friendly: { type: 'boolean' },
        },
        required: ['asset_path', 'title', 'price_usdc'],
      },
    },
    {
      name: 'forge_delist',
      description: 'Soft-delist a listing (requires FORGE_SECRET_KEY)',
      inputSchema: {
        type: 'object',
        properties: { listing_id: { type: 'string' } },
        required: ['listing_id'],
      },
    },
    {
      name: 'forge_vault_status',
      description: 'Seller SplitVault status (requires FORGE_SECRET_KEY)',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

function requirePayer(): Keypair {
  if (!payer) {
    throw new Error('Set FORGE_KEYPAIR or FORGE_SECRET_KEY (or BUYER_SECRET_KEY)');
  }
  return payer;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    if (name === 'forge_list') {
      const result = await forgeSearch({
        forgeApiBase,
        q: a.q ? String(a.q) : undefined,
        category: a.category ? String(a.category) : undefined,
        sellerWallet: a.seller_wallet ? String(a.seller_wallet) : undefined,
        agentFriendly:
          typeof a.agent_friendly === 'boolean' ? a.agent_friendly : undefined,
        sort: a.sort ? String(a.sort) : 'trending',
        limit: typeof a.limit === 'number' ? a.limit : undefined,
        offset: typeof a.offset === 'number' ? a.offset : undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'forge_preview') {
      const meta = await forgePreviewMeta({
        forgeApiBase,
        listingId: String(a.listing_id ?? ''),
      });
      return { content: [{ type: 'text', text: JSON.stringify(meta, null, 2) }] };
    }

    if (name === 'forge_purchase') {
      if (!pay402Fetch) {
        throw new Error('Set FORGE_KEYPAIR or FORGE_SECRET_KEY (or BUYER_SECRET_KEY)');
      }
      const id = String(a.listing_id ?? '');
      const kp = requirePayer();
      const { bytes, contentType, saleId, verify } = await forgeBuy({
        forgeApiBase,
        listingId: id,
        pay402Fetch,
        autoFeedback: true,
        buyerWallet: kp.publicKey.toBase58(),
        buyerKeypair: kp,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                listing_id: id,
                sale_id: saleId ?? null,
                bytes: bytes.length,
                content_type: contentType,
                verify: verify ?? null,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === 'forge_publish') {
      const kp = requirePayer();
      const listing = await forgePublish({
        forgeApiBase,
        sellerKeypair: kp,
        assetPath: String(a.asset_path ?? ''),
        title: String(a.title ?? ''),
        priceUsdc: String(a.price_usdc ?? ''),
        category: a.category ? String(a.category) : 'art',
        description: a.description ? String(a.description) : undefined,
        agentFriendly: Boolean(a.agent_friendly),
      });
      return { content: [{ type: 'text', text: JSON.stringify(listing, null, 2) }] };
    }

    if (name === 'forge_delist') {
      const kp = requirePayer();
      const id = String(a.listing_id ?? '');
      await forgeDelist({ forgeApiBase, listingId: id, sellerKeypair: kp });
      return { content: [{ type: 'text', text: JSON.stringify({ delisted: id }) }] };
    }

    if (name === 'forge_vault_status') {
      const kp = requirePayer();
      const status = await forgeVaultStatus({
        forgeApiBase,
        sellerWallet: kp.publicKey.toBase58(),
      });
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (e) {
    return {
      content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
