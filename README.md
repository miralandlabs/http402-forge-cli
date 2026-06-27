# http402-forge-cli

Agent-first CLI and SDK for the **http402.trade Digital Bazaar** (Forge marketplace).

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@http402/forge-client` | SDK | Buy, publish, delist, vault — TypeScript library |
| `@http402/forge-cli` | `forge` bin | Terminal CLI for agents and humans |
| `@http402/forge-mcp` | `forge-mcp` | MCP tools for Cursor, Claude Desktop, etc. |

## Quick start (local monorepo)

```bash
cd http402-forge-cli
npm install
npm run build
```

Payment rail comes from npm: [`@pr402/buyer-typescript`](https://www.npmjs.com/package/@pr402/buyer-typescript) (installed automatically via `@http402/forge-client`).

### CLI

```bash
export FORGE_API_BASE=https://preview.forge.http402.trade
export FACILITATOR_BASE=https://preview.ipay.sh
export FORGE_KEYPAIR=/path/to/keypair.json

node packages/forge-cli/dist/cli-entry.js list --pretty
node packages/forge-cli/dist/cli-entry.js buy <listing-uuid> --verify
node packages/forge-cli/dist/cli-entry.js vault status
node packages/forge-cli/dist/cli-entry.js publish --asset ./file.pdf --title "My PDF" --price 0.05
```

### MCP

```json
{
  "mcpServers": {
    "forge": {
      "command": "node",
      "args": ["/path/to/http402-forge-cli/packages/forge-mcp/dist/index.js"],
      "env": {
        "FORGE_API_BASE": "https://preview.forge.http402.trade",
        "FACILITATOR_BASE": "https://preview.ipay.sh",
        "FORGE_SECRET_KEY": "[...]"
      }
    }
  }
}
```

## Agent discovery

1. `GET https://http402.trade/.well-known/x402-portal.json`
2. Forge API: `GET {FORGE_API}/.well-known/x402-resources.json`
3. Catalog: `GET {FORGE_API}/api/v1/listings`
4. OpenAPI: `GET {FORGE_API}/openapi.yaml`

See [http402-forge-api/docs/AGENT_API.md](../http402-forge-api/docs/AGENT_API.md).

## Publish to npm (phase 3)

```bash
npm publish -w @http402/forge-client
npm publish -w @http402/forge-cli
npm publish -w @http402/forge-mcp
```

Requires `@http402` org on npmjs.com and published `@pr402/buyer-typescript` (dependency of `@http402/forge-client`).
