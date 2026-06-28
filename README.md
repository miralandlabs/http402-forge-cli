# http402-forge-cli

Agent-first CLI and SDK for the **http402.trade Digital Bazaar** (Forge marketplace).

## Packages (npm)

| Package | npm | Description |
|---------|-----|-------------|
| `@http402/forge-client` | [npm](https://www.npmjs.com/package/@http402/forge-client) | SDK — buy, publish, delist, vault |
| `@http402/forge-cli` | [npm](https://www.npmjs.com/package/@http402/forge-cli) | CLI binary `forge` |
| `@http402/forge-mcp` | [npm](https://www.npmjs.com/package/@http402/forge-mcp) | MCP server `forge-mcp` |

Payment rail: [`@pr402/buyer-typescript`](https://www.npmjs.com/package/@pr402/buyer-typescript) (dependency of `@http402/forge-client`).

## Quick start (npm)

```bash
npm install -g @http402/forge-cli
# or without global install:
npx @http402/forge-cli list --pretty

export FORGE_KEYPAIR=/path/to/keypair.json

forge list --pretty
forge buy <listing-uuid> --verify
forge vault status
forge publish --asset ./file.pdf --title "My PDF" --price 0.05
```

Defaults use **production** (mainnet): `https://forge.http402.trade`, `https://ipay.sh`. For devnet preview:

```bash
export FORGE_API_BASE=https://preview.forge.http402.trade
export FACILITATOR_BASE=https://preview.ipay.sh
export FORGE_RPC_URL=https://api.devnet.solana.com
```

SDK:

```bash
npm install @http402/forge-client
```

### MCP (Cursor / Claude Desktop)

```json
{
  "mcpServers": {
    "forge": {
      "command": "npx",
      "args": ["-y", "@http402/forge-mcp"],
      "env": {
        "FORGE_KEYPAIR": "/absolute/path/to/keypair.json"
      }
    }
  }
}
```

See [`packages/forge-mcp/README.md`](packages/forge-mcp/README.md) and [x402-buyer-starter/examples/mcp/forge-cursor-mcp.json](../x402-buyer-starter/examples/mcp/forge-cursor-mcp.json).

## Develop from source (monorepo)

```bash
git clone https://github.com/miralandlabs/http402-forge-cli.git
cd http402-forge-cli
npm install && npm run build
node packages/forge-cli/dist/cli-entry.js list --pretty
```

## Agent discovery

1. `GET https://http402.trade/.well-known/x402-portal.json` — channel router + npm package names
2. Forge API: `GET {FORGE_API}/.well-known/x402-resources.json`
3. Catalog: `GET {FORGE_API}/api/v1/listings`
4. OpenAPI: `GET {FORGE_API}/openapi.yaml`

See [http402-forge-api/docs/AGENT_API.md](../http402-forge-api/docs/AGENT_API.md).
