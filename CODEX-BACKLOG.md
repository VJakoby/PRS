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
STATUS: [ ]

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
