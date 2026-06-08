# Project Backlog (Codex-Optimized v2)

## GLOBAL RULES
- Do not refactor unrelated code
- Only modify explicitly required files
- Keep diffs minimal
- Do not merge tasks
- Preserve existing architecture

---

# Fixes
## F1-01 — Add guided first-run setup command
STATUS: [x]

CONTEXT:
ENGRAM currently requires manually copying and editing sources.json before indexing.

PROBLEM:
Fresh setup requires users to understand local vs Docker paths, source structure, and indexing commands before the app can be launched successfully.

SCOPE:
- package.json
- scripts/setup.js
- sources.json.template
- README.md
- .env.example
- docker-compose.yml

EXPECTED BEHAVIOR:
- `npm run setup` creates a valid sources.json when missing
- User can configure a local notes path interactively
- Setup validates generated JSON
- Setup prints the next indexing and start commands
- Existing sources.json is not overwritten without confirmation
- `npm run setup -- --docker` writes host note paths to `.env` and container paths to `sources.json`
- Docker setup creates required local data and empty mount directories
- Docker setup allows a configurable host port while keeping container port `3002`


---

## F1-02 — Improve incremental indexing CLI workflow
STATUS: [ ]

CONTEXT:
ENGRAM supports local modification-time checks and source-level TTL skipping, but incremental runs do not safely or clearly report page-level changes.

PROBLEM:
Users need a reliable command that updates only changed content. Failed source scans can currently remove valid indexed pages, online sources refetch every page after TTL expiry, deleted and failed pages are not reported clearly, and a running server does not reload the updated index.

SCOPE:
- package.json
- indexer.js
- server.js
- README.md

EXPECTED BEHAVIOR:
- `npm run reindex` performs the default incremental indexing workflow
- `npm run index` remains available as a compatibility alias
- Local files use modification timestamps to skip unchanged content
- Local scans report added, updated, removed, unchanged, and failed pages
- Deleted local files are removed only after a successful source scan
- Existing pages are preserved when a local source is unavailable or unreadable
- Online sources continue to respect source TTL
- Online pages use ETag and Last-Modified validators when provided
- HTTP 304 responses reuse existing indexed pages
- Online pages use content hashes when HTTP validators are unavailable
- New and removed online URLs are detected from successful source discovery
- Existing online pages are preserved when discovery or individual page requests fail
- CLI summary reports added, updated, removed, unchanged, failed, and TTL-skipped totals
- `--local` and `--online` remain source filters; `--force` remains the explicit full re-index option
- Native and Docker reindex commands are documented consistently
- A running server reloads the updated index safely after a successful indexing run
- Existing index backups and atomic save behavior are preserved

VERIFICATION:
- Unchanged local files are reused without rereading content
- Modified and new local files update the index
- Deleted local files are removed after a successful scan
- Unavailable local sources retain their previous pages
- HTTP 304 pages are reused and HTTP 200 changed pages are updated
- Failed online requests retain previous pages and are counted as failures
- CLI totals match page-level changes
- The running API serves the updated index without a manual restart


---
