import { readFile } from 'fs/promises';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

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
  let raw = rawEnv;
  if (path) {
    raw = undefined;
  }
  if (path) {
    return Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')) as number[]),
    );
  }
  if (!raw) return null;
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  }
  return Keypair.fromSecretKey(bs58.decode(raw));
}

import { readFileSync } from 'fs';

export function loadConfig(argv: string[]): CliConfig {
  const flags = new Set<string>();
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.add('json');
    else if (a === '--pretty') flags.add('pretty');
    else if (a.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      opts.set(a.slice(2), argv[++i]);
    } else if (a.startsWith('--')) {
      opts.set(a.slice(2), 'true');
    }
  }

  return {
    apiBase: (
      opts.get('api') ??
      process.env.FORGE_API_BASE ??
      'https://preview.forge.http402.trade'
    ).replace(/\/$/, ''),
    facilitatorBase: (
      opts.get('facilitator') ??
      process.env.FACILITATOR_BASE ??
      'https://preview.ipay.sh'
    ).replace(/\/$/, ''),
    rpcUrl:
      opts.get('rpc') ??
      process.env.FORGE_RPC_URL ??
      process.env.SOLANA_RPC_URL ??
      'https://api.devnet.solana.com',
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

export async function readKeypairFile(path: string): Promise<Keypair> {
  const raw = await readFile(path, 'utf8');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}

export function parseArgs(argv: string[]): { cmd: string; rest: string[] } {
  const rest = [...argv];
  while (rest[0]?.startsWith('--')) rest.shift();
  if (rest[0]?.startsWith('--')) rest.shift();
  const cmd = rest.shift() ?? 'help';
  return { cmd, rest };
}

export function getOpt(rest: string[], name: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  if (i >= 0 && rest[i + 1]) return rest[i + 1];
  return undefined;
}

export function hasFlag(rest: string[], name: string): boolean {
  return rest.includes(`--${name}`);
}
