# 🔎 ENGRAM — Indexed Search Surface

> A fast local tool for searching indexed documentation — both online sources and local markdown files.

## Why?

Technical documentation is fragmented between remote public docs and local notes. ENGRAM eliminates the overhead of switching between browser tabs and local editors by providing a single unified search interface, consumed directly by tools like [PRAGMA](https://github.com/VJakoby/pragma).

---

## ✨ Features

- **Fast Indexing & Search** — Built with performance in mind for quick documentation retrieval
- **Smart Incremental Updates** — TTL-based indexing only re-fetches sources when needed (30x faster daily runs)
- **Smart Relevance Ranking** — Scoring based on match quality (exact > partial > fuzzy) and position (title > URL > content)
- **Synonym Expansion** — Search for "ssh" and automatically include "secure shell", "22/tcp", "openssh"
- **Offline Caching** — Download and store online sources locally for zero-latency searching and offline preview
- **Rate-Limit Protection** — Smart jitter, retry logic, and configurable timeouts to avoid being blocked
- **Snippet Previews** — Shows where your search term appears in the content with surrounding context
- **REST API** — Consumed by PRAGMA or any other tool on `http://localhost:3002`

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Sources
```bash
# Copy the template
cp sources.json.template sources.json

# Edit with your sources
nano sources.json
```

### 3. Build Index
```bash
# First time: force full index
npm run index -- --force

# After that: smart incremental updates
npm run index
```

### 4. Start Server
```bash
npm start
```

Service runs on `http://localhost:3002`.

---

## 🐳 Docker (Alternative)

```bash
docker-compose up --build
```

ENGRAM will be available at `http://localhost:3002`.

When running alongside PRAGMA in Docker, they communicate over a shared internal network (`http://engram:3002`). See PRAGMA's [DOCKER.md](https://github.com/VJakoby/pragma/blob/main/DOCKER.md) for the combined setup.

### Local Notes in Docker

For Docker-first setups, local markdown notes should be mounted into the container and referenced by container paths in `sources.json`.

Single parent directory:
```env
NOTES_PATH=/home/user/pentest-notes
```

```json
"offline_sources": [
  {
    "id": "oscp",
    "path": "/app/notes/OSCP",
    "enabled": true
  },
  {
    "id": "ad",
    "path": "/app/notes/ActiveDirectory",
    "enabled": true
  }
]
```

Multiple unrelated note roots:
```env
NOTES_PATH=/home/user/notes-main
NOTES_PATH_2=/mnt/archive/redteam-notes
NOTES_PATH_3=/srv/wiki/export
```

```json
"offline_sources": [
  { "id": "main", "path": "/app/notes", "enabled": true },
  { "id": "archive", "path": "/app/notes-2", "enabled": true },
  { "id": "wiki", "path": "/app/notes-3", "enabled": true }
]
```

If `NOTES_PATH_2` or `NOTES_PATH_3` are unused, leave them empty and disable the corresponding offline sources. Empty values fall back to internal empty directories, so you do not get duplicate mounts by accident.

---

## 🛠️ CLI Commands

| Command | Description |
|---|---|
| `npm run index -- --help` | Show available commands |
| `npm run index` | Smart incremental indexing (respects TTL) |
| `npm run index -- --force` | Force re-index "all" sources regardless of TTL |
| `npm run index -- --local` | Force re-index "local" sources regardless of TTL |
| `npm run index -- --online` | Force re-index "online" sources regardless of TTL |
| `node indexer.js info` | View index statistics and source ages |
| `npm run cache` | Cache online sources locally for offline use |
| `npm run cache-status` | Show storage usage and cached page statistics |
| `node indexer.js search <query>` | Fast CLI-based search |
| `node indexer.js update <file>` | Update a specific local file in the index |
| `node indexer.js remove <file>` | Remove a file from the index |

---

## 🔢 How Results Are Ranked

Results are ranked by **relevance**, not keyword count.

| Score | Match type |
|---|---|
| 100 pts | Exact title match |
| 50 pts | Title contains term |
| 30 pts | Page name (URL) match |
| 20 pts | URL fragment match |
| 2 pts/occurrence | Content matches |
| +5 pts | Bonus for concise titles |
| Fuzzy | Always used as fallback for typos |

**Synonym expansion:** Searching for "smb" automatically includes "samba", "445/tcp", "cifs" — configure in `synonyms.json`.

---

## ⚙️ Configuration

### Advanced Settings

The global settings look like this:

```json
{
  "index_settings": {
    "default_ttl_days": 7,
    "max_pages_per_source": null,
    "timeout_seconds": 15,
    "retry_attempts": 2
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `default_ttl_days` | 7 | Days before re-indexing a source |
| `max_pages_per_source` | null | Limit pages per source (null = unlimited) |
| `timeout_seconds` | 15 | HTTP request timeout |
| `retry_attempts` | 2 | Retry attempts for failed requests |

All global settings support per-source overrides: 

**Per-source override example:**
```json
{
  "id": "slow_site",
  "ttl_days": 30,
  "timeout_seconds": 45,
  "retry_attempts": 5
}
```
---

## 📚 Source Types

ENGRAM supports the following source types:
- Local Files (`type: "local"`)
- GitBook (`type: "gitbook"`)
- Docusaurus (`type: "docusaurus"`)
- Markdown URLs (`type: "markdown"`)

---

## 🚀 Performance

### Incremental Indexing (TTL-based)

**Before TTL:**
- ⏱️ Time: ~15 minutes
- 📡 Requests: ~500 HTTP calls
- 💾 Bandwidth: ~50 MB

**After TTL (daily runs):**
- ⏱️ Time: ~30 seconds (30x faster!)
- 📡 Requests: ~50 HTTP calls (only old sources)
- 💾 Bandwidth: ~5 MB

**Example output:**
```
ℹ️  Using TTL: 7 days

✅ HackTricks - Skipping (indexed 2 days ago, TTL: 7 days)
   Using 143 cached pages from index

✅ HTB Academy - Skipping (indexed 5 days ago, TTL: 7 days)
   Using 89 cached pages from index

📚 Indexing OWASP Testing Guide...
  [1/15] Fetching: https://...
```

### Tuning

Adjust `RATE` constant in `indexer.js`:

| Value | Speed | Notes |
|---|---|---|
| `1000ms` | 1 req/sec | Conservative, safest |
| `500ms` | 2 req/sec | Default — good balance |
| `200ms` | 5 req/sec | Fast, higher risk |

---

## 🔍 Search Features

### Synonym Expansion

Configure in `synonyms.json`:

```json
{
  "ssh": ["secure shell", "22/tcp", "openssh"],
  "smb": ["samba", "445/tcp", "cifs"],
  "sqli": ["sql injection", "union select"]
}
```

Searching for "ssh" automatically includes all synonyms in results.

---

### Fuzzy Matching

Built-in fuzzy matching catches typos:
- "sqlinjection" → matches "sql injection"
- "privelege" → matches "privilege"
- "hydra" → matches "hydra", "thc-hydra"

---

## 📁 File Structure

```
engram/
├── indexer.js                  # Core indexing logic
├── server.js                   # API server
├── sources.json.template       # Configuration template (tracked)
├── sources.json                # Your config (NOT tracked - private)
├── synonyms.json               # Search synonyms
├── data/
│   ├── index.json             # Generated search index
│   ├── index.meta.json        # Index metadata
│   └── cache/                 # Offline cached pages
│       └── online/
│           └── <source_id>/
│               ├── metadata.json
│               └── <hash>.html
├── public/
│   └── app.html               # Web interface
├── SETUP.md                   # Setup guide
├── CONFIGURATION-GUIDE.md     # Full config reference
└── TTL-SIMPLE-GUIDE.md       # TTL quick guide
```

---

## 📖 Documentation

- **[SETUP.md](./SETUP.md)** — Getting started guide
- **[DOCKER.md](./DOCKER.md)** — Docker setuo guide

---

### Setup for New Users

```bash
# Clone repo
git clone your-repo.git
cd engram

# Copy template
cp sources.json.template sources.json

# Configure
nano sources.json

# Build index
npm run index -- --force

# Start
npm start
```

---

## 🛠️ Troubleshooting

### "sources.json not found"
```bash
cp sources.json.template sources.json
```

### Index seems outdated
```bash
npm run index -- --force
```

### Too many timeouts
Increase timeout in `sources.json`:
```json
{
  "index_settings": {
    "timeout_seconds": 30,
    "retry_attempts": 3
  }
}
```

### Index too large
Limit pages per source:
```json
{
  "index_settings": {
    "max_pages_per_source": 100
  }
}
```

### Check index status
```bash
node indexer.js info
```

---

## 🤝 Integration with PRAGMA

ENGRAM is designed to work seamlessly with [PRAGMA](https://github.com/VJakoby/pragma).

**Standalone:**
```
ENGRAM (localhost:3002) → Search API
```

**With PRAGMA:**
```
PRAGMA → ENGRAM (localhost:3002) → Search API
```

---

## 📝 License

Created by VJakoby + 🤖 | Licensed under MIT | [View AI & Architectural Disclosure](./AI-DISCLOSURE.md)
