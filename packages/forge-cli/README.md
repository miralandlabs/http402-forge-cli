# @http402/forge-cli

Command-line interface for the http402 **Forge Digital Bazaar** — list, preview, buy, publish, delist, and manage seller vaults.

## Install

```bash
npm install -g @http402/forge-cli
# or run without installing:
npx @http402/forge-cli help
```

## Environment

| Variable | Description | Default |
|----------|-------------|---------|
| `FORGE_API_BASE` | Forge API URL | `https://forge.http402.trade` |
| `FACILITATOR_BASE` | x402 facilitator URL | `https://ipay.sh` |
| `FORGE_KEYPAIR` | Path to Solana keypair JSON file | — |
| `FORGE_SECRET_KEY` | Base58 or JSON-array secret key | — |
| `BUYER_SECRET_KEY` | Alias for `FORGE_SECRET_KEY` | — |
| `FORGE_RPC_URL` | Solana RPC (vault activation) | `https://api.mainnet-beta.solana.com` |

Set `FORGE_KEYPAIR` **or** `FORGE_SECRET_KEY` for signed operations (buy, publish, delist, vault).

For **devnet / preview** testing, override `FORGE_API_BASE`, `FACILITATOR_BASE`, and `FORGE_RPC_URL` (see `@pr402/buyer-typescript` preview URLs).

## Usage

```bash
# Search listings
forge list --q art --limit 10

# Listing details and free preview
forge get <listing-id>
forge preview <listing-id>

# Purchase (x402 payment + download)
forge buy <listing-id> --out ./asset.bin --verify

# Seller: publish, delist, vault
forge publish --asset ./file.bin --title "My Asset" --price 0.05
forge delist <listing-id>
forge vault status
forge vault activate --send

# Output: JSON (default) or human-readable
forge list --pretty
```

Global flags: `--api`, `--facilitator`, `--rpc`, `--json`, `--pretty`.

Run `forge help` for the full command list.
