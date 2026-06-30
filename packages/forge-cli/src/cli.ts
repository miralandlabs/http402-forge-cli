import { readFileSync } from 'fs';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  createForgePayFetch,
  forgeBuy,
  forgeDelist,
  forgeGetListing,
  forgePreviewMeta,
  forgeProvisionVaultTx,
  forgePublish,
  forgeRedownload,
  forgeSaleFeedback,
  forgeSearch,
  forgeVaultStatus,
} from '@http402/forge-client';

export interface CliConfig {
  apiBase: string;
  facilitatorBase: string;
  rpcUrl: string;
  keypair: Keypair | null;
  json: boolean;
  pretty: boolean;
}

export function loadKeypairFromEnv(): Keypair | null {
  const path = process.env.FORGE_KEYPAIR?.trim();
  const rawEnv = process.env.FORGE_SECRET_KEY?.trim() ?? process.env.BUYER_SECRET_KEY?.trim();
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

export function loadConfig(argv: string[]): CliConfig {
  const flags = new Set<string>();
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.add('json');
    else if (a === '--pretty') flags.add('pretty');
    else if (a.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      opts.set(a.slice(2), argv[++i]);
    }
  }

  return {
    apiBase: (
      opts.get('api') ??
      process.env.FORGE_API_BASE ??
      'https://forge.http402.trade'
    ).replace(/\/$/, ''),
    facilitatorBase: (
      opts.get('facilitator') ??
      process.env.FACILITATOR_BASE ??
      'https://ipay.sh'
    ).replace(/\/$/, ''),
    rpcUrl:
      opts.get('rpc') ??
      process.env.FORGE_RPC_URL ??
      process.env.SOLANA_RPC_URL ??
      'https://api.mainnet-beta.solana.com',
    keypair: loadKeypairFromEnv(),
    json: flags.has('json') || !flags.has('pretty'),
    pretty: flags.has('pretty'),
  };
}

export function requireKeypair(cfg: CliConfig): Keypair {
  if (!cfg.keypair) {
    throw new Error('Set FORGE_KEYPAIR or FORGE_SECRET_KEY (or BUYER_SECRET_KEY)');
  }
  return cfg.keypair;
}

export function printOut(cfg: CliConfig, data: unknown, prettyLines?: string[]): void {
  if (cfg.pretty && prettyLines) {
    for (const line of prettyLines) console.log(line);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

export async function sendProvisionTx(
  cfg: CliConfig,
  provision: Record<string, unknown>,
): Promise<string> {
  const kp = requireKeypair(cfg);
  const txB64 = String(provision.transaction ?? '');
  if (!txB64) throw new Error('provision-tx response missing transaction field');
  const tx = VersionedTransaction.deserialize(Buffer.from(txB64, 'base64'));
  tx.sign([kp]);
  const conn = new Connection(cfg.rpcUrl, 'confirmed');
  const sig = await conn.sendTransaction(tx);
  await conn.confirmTransaction(sig, 'confirmed');
  return sig;
}

export function getOpt(rest: string[], name: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  if (i >= 0 && rest[i + 1]) return rest[i + 1];
  return undefined;
}

export function hasFlag(rest: string[], name: string): boolean {
  return rest.includes(`--${name}`);
}

export function stripGlobalFlags(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json' || a === '--pretty') continue;
    if (a === '--api' || a === '--facilitator' || a === '--rpc') {
      i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

export async function runCli(argv: string[]): Promise<void> {
  const cfg = loadConfig(argv);
  const args = stripGlobalFlags(argv);
  const cmd = args[0] ?? 'help';
  const rest = args.slice(1);
  const clientOpts = { forgeApiBase: cfg.apiBase };

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(`forge — http402 Digital Bazaar CLI

Usage:
  forge list [--q text] [--category art] [--agent-friendly] [--seller-wallet ADDR] [--sort trending] [--limit 20] [--offset 0]
  forge get <listing-id>
  forge preview <listing-id>
  forge buy <listing-id> [--out path] [--verify]
  forge redownload <listing-id> [--out path]
  forge feedback <sale-id> --signal as_described|corrupt|misleading|hash_mismatch
  forge publish --asset path --title "..." --price 0.05 [--display-name "..."] [--category art] [--description "..."]
  forge delist <listing-id>
  forge vault status
  forge vault activate [--asset USDC] [--send|--print-tx]

Env: FORGE_API_BASE, FACILITATOR_BASE, FORGE_KEYPAIR, FORGE_RPC_URL
Flags: --api --facilitator --rpc --json (default) --pretty`);
    return;
  }

  if (cmd === 'list') {
    const result = await forgeSearch({
      ...clientOpts,
      q: getOpt(rest, 'q'),
      category: getOpt(rest, 'category'),
      sellerWallet: getOpt(rest, 'seller-wallet') ?? process.env.FORGE_WALLET,
      agentFriendly: hasFlag(rest, 'agent-friendly') ? true : undefined,
      sort: getOpt(rest, 'sort') ?? 'trending',
      limit: getOpt(rest, 'limit') ? Number(getOpt(rest, 'limit')) : 20,
      offset: getOpt(rest, 'offset') ? Number(getOpt(rest, 'offset')) : undefined,
    });
    if (cfg.pretty) {
      printOut(cfg, result, [
        `Found ${result.total} listings (showing ${result.items.length}):`,
        ...result.items.map(
          (item) =>
            `${item.id}  ${(item.priceMicroUsdc / 1e6).toFixed(2)} USDC  [${item.category}] ${item.title}`,
        ),
      ]);
    } else {
      printOut(cfg, result);
    }
    return;
  }

  if (cmd === 'get') {
    const id = rest.find((a) => !a.startsWith('--'));
    if (!id) throw new Error('usage: forge get <listing-id>');
    const listing = await forgeGetListing({ ...clientOpts, listingId: id });
    printOut(cfg, listing);
    return;
  }

  if (cmd === 'preview') {
    const id = rest.find((a) => !a.startsWith('--'));
    if (!id) throw new Error('usage: forge preview <listing-id>');
    const meta = await forgePreviewMeta({ ...clientOpts, listingId: id });
    printOut(cfg, meta);
    return;
  }

  if (cmd === 'buy') {
    const id = rest.find((a) => !a.startsWith('--'));
    if (!id) throw new Error('usage: forge buy <listing-id>');
    const kp = requireKeypair(cfg);
    const out = getOpt(rest, 'out') ?? `forge-${id.slice(0, 8)}.bin`;
    const verify = hasFlag(rest, 'verify');
    const pay402Fetch = createForgePayFetch(kp, cfg.facilitatorBase);
    const result = await forgeBuy({
      ...clientOpts,
      listingId: id,
      pay402Fetch,
      outputPath: out,
      autoFeedback: verify,
      buyerWallet: verify ? kp.publicKey.toBase58() : undefined,
      buyerKeypair: verify ? kp : undefined,
    });
    printOut(cfg, { ...result, bytes: result.bytes.length, outputPath: out });
    return;
  }

  if (cmd === 'redownload') {
    const id = rest.find((a) => !a.startsWith('--'));
    if (!id) throw new Error('usage: forge redownload <listing-id>');
    const kp = requireKeypair(cfg);
    const out = getOpt(rest, 'out') ?? `forge-${id.slice(0, 8)}.bin`;
    const result = await forgeRedownload({
      ...clientOpts,
      listingId: id,
      buyerWallet: kp.publicKey.toBase58(),
      buyerKeypair: kp,
      outputPath: out,
    });
    printOut(cfg, { ...result, bytes: result.bytes.length, outputPath: out });
    return;
  }

  if (cmd === 'feedback') {
    const saleId = rest.find((a) => !a.startsWith('--'));
    const signal = getOpt(rest, 'signal') as
      | 'as_described'
      | 'corrupt'
      | 'misleading'
      | 'hash_mismatch'
      | undefined;
    if (!saleId || !signal) {
      throw new Error(
        'usage: forge feedback <sale-id> --signal as_described|corrupt|misleading|hash_mismatch',
      );
    }
    const kp = requireKeypair(cfg);
    await forgeSaleFeedback({
      ...clientOpts,
      saleId,
      buyerWallet: kp.publicKey.toBase58(),
      buyerKeypair: kp,
      outcome: signal,
    });
    printOut(cfg, { feedback: signal, saleId });
    return;
  }

  if (cmd === 'publish') {
    const kp = requireKeypair(cfg);
    const asset = getOpt(rest, 'asset');
    const title = getOpt(rest, 'title');
    const price = getOpt(rest, 'price');
    if (!asset || !title || !price) {
      throw new Error('usage: forge publish --asset path --title "..." --price 0.05');
    }
    const listing = await forgePublish({
      ...clientOpts,
      sellerKeypair: kp,
      assetPath: asset,
      title,
      priceUsdc: price,
      description: getOpt(rest, 'description'),
      category: getOpt(rest, 'category') ?? 'art',
      previewPath: getOpt(rest, 'preview'),
      agentFriendly: hasFlag(rest, 'agent-friendly'),
      tags: getOpt(rest, 'tags'),
      license: getOpt(rest, 'license'),
      displayName: getOpt(rest, 'display-name'),
    });
    printOut(cfg, listing);
    return;
  }

  if (cmd === 'delist') {
    const id = rest.find((a) => !a.startsWith('--'));
    if (!id) throw new Error('usage: forge delist <listing-id>');
    const kp = requireKeypair(cfg);
    await forgeDelist({ ...clientOpts, listingId: id, sellerKeypair: kp });
    printOut(cfg, { delisted: id });
    return;
  }

  if (cmd === 'vault') {
    const sub = rest[0];
    const kp = requireKeypair(cfg);
    const wallet = kp.publicKey.toBase58();
    if (sub === 'status') {
      const status = await forgeVaultStatus({ ...clientOpts, sellerWallet: wallet });
      printOut(cfg, status);
      return;
    }
    if (sub === 'activate') {
      const provision = await forgeProvisionVaultTx({
        ...clientOpts,
        sellerWallet: wallet,
        asset: getOpt(rest.slice(1), 'asset') ?? 'USDC',
      });
      if (hasFlag(rest, 'print-tx') || !hasFlag(rest, 'send')) {
        printOut(cfg, provision);
        if (!hasFlag(rest, 'send')) {
          console.error('Pass --send to sign and broadcast (requires FORGE_RPC_URL)');
        }
        return;
      }
      const sig = await sendProvisionTx(cfg, provision);
      printOut(cfg, { signature: sig, wallet });
      return;
    }
    throw new Error('usage: forge vault status | forge vault activate [--send]');
  }

  throw new Error(`unknown command: ${cmd}. Run forge help`);
}
