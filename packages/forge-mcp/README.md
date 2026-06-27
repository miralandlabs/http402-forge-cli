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
        "FORGE_API_BASE": "https://preview.forge.http402.trade",
        "FACILITATOR_BASE": "https://preview.ipay.sh",
        "FORGE_SECRET_KEY": "[base58-or-json-array-secret-key]"
      }
    }
  }
}
```

Alternatively set `FORGE_KEYPAIR=/absolute/path/to/keypair.json`.

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
