# Mapepire IBM i Node for n8n

Run IBM i Db2 SQL queries and CL commands in n8n through a Mapepire server (`@ibm/mapepire-js`). Focused, fast, parameterized.

## What It Does

- SQL query execution with automatic paging
- CL command execution
- Optional parameter binding via JSON (array or object)
- Connection reuse toggle for bulk item performance
- Include / exclude metadata & update counts
- Optional terse output (rows only)
- TLS: ignore self‑signed or provide custom CA
- Structured errors when workflow uses continueOnFail

## Quick Start

1. Install deps & build

```bash
npm install
npm run build
```

2. Launch n8n with this node:

```bash
# Fast path (build + run using dist/)
npm run dev:n8n

# Watch mode (rebuild on file save, then n8n runs with built code)
npm run dev:n8n:watch

# Manual (if you prefer explicit commands)
npm run build
N8N_CUSTOM_EXTENSIONS="$(pwd)/dist" npx n8n

# If n8n installed globally instead of npx
export N8N_CUSTOM_EXTENSIONS="$(pwd)/dist" && n8n start

# Alternative: point at project root (package.json -> dist)
N8N_CUSTOM_EXTENSIONS="$(pwd)" npx n8n

# Classic link into a local n8n clone
(cd /path/to/your/n8n && npm link n8n-nodes-ibmi-mapepire)
```

3. In n8n: add node named "Mapepire".

## Credentials

Host, port, user, password. For TLS:

- Ignore Unauthorized TLS: accept self‑signed
- CA Certificate: paste PEM if you prefer validation

## Using the Node

Operation: choose SQL Query or CL Command.

For SQL:

- Query: your SQL (use placeholders supported by current `@ibm/mapepire-js` version)
- Use Parameters: enable, then provide JSON
  - Array example: `["ACME", 42]`
  - Object example: `{ "CUST_ID": 42, "STATUS": "A" }`
- Reuse Connection: speed up many input items with same creds
- Include Metadata: disable for leaner output (rows only)
- Terse Result: further trims auxiliary fields

For CL: just supply the command text. Result returns completion info & messages.

Errors: When continueOnFail is enabled, each item returns an `error` object instead of throwing.

## Testing & Development

```bash
npm test          # Run Vitest suite
npm run test:watch
```

Implementation mocks Mapepire classes—no live IBM i needed.

### Code Style

This repo uses Prettier. Format all files before committing (release script enforces it):

```bash
npm run format        # write changes
npm run format:check  # verify only
```

## Releasing (Summary)

Use semantic scripts (patch | minor | major):

```bash
npm run release:patch
```

They bump version + tag; CI (with NPM_TOKEN secret) builds, tests, publishes. See `CHANGELOG.md` for history.

## Troubleshooting

Node missing in n8n:

- Confirm `dist/` exists (rebuild if not)
- Ensure `N8N_CUSTOM_EXTENSIONS` path is absolute & exported
- Restart n8n after rebuilding

Parameter issues: verify placeholder style matches library version.

TLS failures: try Ignore Unauthorized first; if that works, add proper CA.

## License

MIT

---

Lean README version: detailed release & CI notes moved to history / scripts. Check `CHANGELOG.md` for full enhancement log.

- Ensure environment variable path is correct
