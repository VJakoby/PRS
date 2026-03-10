# 🔎 ENGRAM — Knowledge Base Indexer

> A fast local tool for searching indexed documentation — both online sources and local markdown files.

## Why?

Technical documentation is fragmented between remote public docs and local notes. ENGRAM eliminates the overhead of switching between browser tabs and local editors by providing a single unified search interface, consumed directly by tools like [PRAGMA](https://github.com/VJakoby/pragma).

---

## ✨ Features

- **Fast Indexing & Search** — Built with performance in mind for quick documentation retrieval
- **Smart Relevance Ranking** — Scoring based on match quality (exact > partial > fuzzy) and position (title > URL > content)
- **Offline Caching** — Download and store online sources locally for zero-latency searching and offline preview
- **Rate-Limit Protection** — Smart jitter and sequential requests to avoid being blocked by documentation hosts
- **Snippet Previews** — Shows where your search term appears in the content with surrounding context
- **REST API** — Consumed by PRAGMA or any other tool on `http://localhost:3002`

---

## 🔢 How Results Are Ranked

Results are ranked by **relevance**, not keyword count.

| Score | Match type |
|---|---|
| 100 pts | Exact title match |
| 50 pts | Title contains term |
| 30 pts | Page name (URL) match |
| 20 pts | URL fragment match |
| 10 pts | Content match |
| penalty | Fuzzy match — always used as fallback for typos |

---

## 🚀 Getting Started

### Docker (recommended)

```bash
docker-compose up --build
```

ENGRAM will be available at `http://localhost:3002`.

When running alongside PRAGMA in Docker, they communicate over a shared internal network (`http://engram:3002`). See PRAGMA's [DOCKER.md](https://github.com/VJakoby/pragma/blob/main/DOCKER.md) for the combined setup.

### Node.js

#### 1. Install dependencies
```bash
npm install
```

#### 2. Configure sources
Edit `sources.json` and add your documentation sources. See the [Sources Reference](#-sources-reference) below.

#### 3. Build the index
```bash
# Index all enabled sources
npm run index

# Optionally cache online sources for offline use
npm run cache
```

#### 4. Start the service
```bash
npm start
```

Service runs on `http://localhost:3002`.

---

## 🛠️ CLI Commands

| Command | Description |
|---|---|
| `npm run index` | Build/refresh the entire search index |
| `npm run cache` | Cache online sources locally for offline use |
| `npm run cache-status` | Show storage usage and cached page statistics |
| `npm run update <path>` | Force-update a specific local file in the index |
| `npm run info` | View index statistics (total pages, sources, last update) |
| `npm run search -- "query"` | Fast CLI-based search |

---

## ⚙️ Performance Tuning

Adjust the `RATE` variable at the top of `indexer.js` to control indexing speed:

| Value | Speed | Notes |
|---|---|---|
| `1000ms` | 1 req/sec | Very conservative, safest for sensitive hosts |
| `200ms` | 5 req/sec | Default — good balance |
| `100ms` | 10 req/sec | Fast, higher risk of rate-limiting |

---

## ➕ Sources Reference

All sources are defined in `sources.json`, which has three top-level keys:

```
sources.json
├── offline_sources   — local markdown directories
├── online_sources    — remote documentation sites
└── index_settings    — global indexing behaviour
```

### Supported source types

| Type | Use case | URL fields |
|---|---|---|
| `markdown` | Raw `.md` files — local dirs or direct URLs (e.g. GitHub raw links) | `urls` (array) |
| `gitbook` | GitBook sites and GitBook-style documentation | `index_url` + `search_url` |
| `docusaurus` | Docusaurus sites | `index_url` + `search_url` |

---

### `offline_sources`

Local markdown directories indexed directly from disk.

```json
{
  "offline_sources": [
    {
      "id": "local-pentest-notes",
      "name": "Local Pentest Notes",
      "type": "markdown",
      "path": "./path/to/your/notes",
      "file_extensions": [".md", ".markdown"],
      "enabled": true,
      "description": "Personal pentest notes in markdown format"
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Unique identifier for this source |
| `name` | string | ✅ | Display name shown in search results |
| `type` | string | ✅ | Always `markdown` for local sources |
| `path` | string | ✅ | Path to local directory containing markdown files |
| `file_extensions` | array | ✅ | Extensions to index, e.g. `[".md", ".markdown"]` |
| `enabled` | bool | ✅ | Set `false` to exclude from indexing without removing the entry |
| `description` | string | ❌ | Optional human-readable description |

---

### `online_sources`

Remote documentation sites. The `type` field determines which fields are used.

#### `markdown` type — direct URLs

```json
{
  "id": "github-notes-example",
  "name": "SQL Injection Payloads - GitHub",
  "type": "markdown",
  "enabled": true,
  "cache_offline": false,
  "description": "Raw markdown files from GitHub",
  "urls": [
    "https://github.com/user/repo/blob/main/README.md"
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Unique identifier |
| `name` | string | ✅ | Display name shown in search results |
| `type` | string | ✅ | `markdown` |
| `enabled` | bool | ✅ | Whether to include in indexing |
| `cache_offline` | bool | ✅ | If `true`, content is downloaded locally for offline search |
| `urls` | array | ✅ | List of raw markdown URLs to fetch and index |
| `description` | string | ❌ | Optional description |

#### `gitbook` / `docusaurus` type — crawled sites

```json
{
  "id": "hacktricks",
  "name": "HackTricks",
  "type": "gitbook",
  "index_url": "https://book.hacktricks.xyz/",
  "search_url": "https://book.hacktricks.xyz/?q={query}",
  "enabled": true,
  "description": "Hacking tricks and techniques"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Unique identifier |
| `name` | string | ✅ | Display name shown in search results |
| `type` | string | ✅ | `gitbook` or `docusaurus` |
| `index_url` | string | ✅ | Root URL used as the crawl entry point |
| `search_url` | string | ✅ | Search URL template — `{query}` is replaced with the search term at query time |
| `enabled` | bool | ✅ | Whether to include in indexing |
| `description` | string | ❌ | Optional description |

---

### `index_settings`

Global settings that apply to all sources during indexing.

```json
{
  "index_settings": {
    "auto_refresh": false,
    "refresh_interval_hours": 24,
    "max_pages_per_source": 50,
    "timeout_seconds": 15,
    "retry_attempts": 2
  }
}
```

| Field | Type | Description |
|---|---|---|
| `auto_refresh` | bool | Automatically re-index sources on a schedule |
| `refresh_interval_hours` | number | How often to refresh when `auto_refresh` is `true` |
| `max_pages_per_source` | number | Maximum pages crawled per source |
| `timeout_seconds` | number | Request timeout per page |
| `retry_attempts` | number | How many times to retry a failed request |

---

## 🔌 API

ENGRAM exposes a simple REST API on `http://localhost:3002`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search?q=<query>` | Search the index — returns ranked results |
| `GET` | `/api/sources` | List all enabled sources and their status |
| `GET` | `/api/cache-status` | Storage usage and cached page statistics |

> These endpoints are consumed by PRAGMA but can be used by any HTTP client for debugging or integration.

---

Created by VJakoby + 🤖 | Licensed under MIT | [View AI & Architectural Disclosure](./AI-DISCLOSURE.md)