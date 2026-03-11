# 🚀 Docker Usage Workflow

### 1. Build the image (only when code changes)
```bash
docker compose build
```
---

### 2. Run indexing after editing `sources.json` 
```bash
# ALL sources (Index all defined sources
docker compose run --rm engram npm run index

# ALL sources (Force index on all defined sources)
docker compose run --rm engram npm run index -- --force

# LOCAL sources (Index only local sources)
docker compose run --rm engram npm run index -- --local

# ONLINE sources (Index only local sources)
docker compose run --rm engram npm run index -- --online

# ONLINE sources (Force index on all defined sources)
docker compose run --rm engram npm run index -- --force --online
---

### 3. OPTIONAL: Build offline cache for sources(both online and local)
Requires the `"cache_offline": true,` on specific sources
```bash
docker compose run --rm engram npm run cache
```
---

### 4. Start the webserver
```bash
docker compose up -d
---- OR ----
npm run docker:up
```
