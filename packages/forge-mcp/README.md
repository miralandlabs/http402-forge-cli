# @http402/forge-mcp

MCP server for the http402 **Forge Digital Bazaar** — list, preview, buy, publish, delist, and vault status.

## Install (npm)

```bash
npm install @http402/forge-mcp
# or run without installing:
npx -y @http402/forge-mcp
```

Payment signing uses [`@pr402/buyer-typescript`](https://www.npmjs.com/package/@pr402/buyer-typescript) via `@http402/forge-client`.

## Cursor / Claude Desktop

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

Alternatively set `FORGE_KEYPAIR=/absolute/path/to/keypair.json` or `FORGE_SECRET_KEY`.

Defaults target **production** (Solana mainnet): `https://forge.http402.trade` and `https://ipay.sh`. For devnet preview, set `FORGE_API_BASE=https://preview.forge.http402.trade` and `FACILITATOR_BASE=https://preview.ipay.sh`.

## Tools

| Tool | Description |
|------|-------------|
| `forge_list` | Search catalog |
| `forge_preview` | Free preview snippet |
| `forge_purchase` | Pay + download with hash verify |
| `forge_publish` | Upload listing (seller) |
| `forge_delist` | Remove listing (seller) |
| `forge_vault_status` | SplitVault activation check |

See [AGENT_API.md](https://github.com/miralandlabs/http402-forge-api/blob/main/docs/AGENT_API.md).
