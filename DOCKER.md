# 🚀 Docker Usage Workflow

### 1. Edit sources that should be indexed
```
sources.json
```

---

### 2. Build the image (only when code changes)
```bash
docker compose build
```

---

### 2. Run indexing after editing `sources.json`
```bash
docker compose run --rm app npm run index
---- OR ----
npm run docker:index
```

---

### 3. Optional: Build offline cache for sources
Requires the `"cache_offline": true,` on specific sources
```bash
docker compose run --rm app npm run cache
```

---

### 4. Start the webserver
```bash
docker compose up -d
---- OR ----
npm run docker:up
```
