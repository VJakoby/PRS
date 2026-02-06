# 🔍 Pentesting Reference Search (PRS)

- A **fast, local search engine for pentesting reference material**.  
- Designed for offline use with fuzzy search, smart relevance ranking, and a modern web UI.
---

## ✨ Key-Features

- 💨 Fast indexing and searching
- 🎯 Search algorithm with multi-level scoring
- ℹ️ Uses online (GitBook) sources or local sources (.MD files)
- 📚 Source overview on the homepage
- 💬 Snippet previews showing keyword context
- 🔍 Fuzzy search for misspellings

## 🔢 Relevance Scoring

Search results are ranked using a **weighted relevance scoring system** that prioritizes strong, intentional matches over raw keyword frequency.

Each result is scored based on:
- **Match strength** (exact, partial, fuzzy)
- **Match location** (title, URL, content)
- **Source type** (external vs local)

Results are sorted by their **final adjusted score**, highest first.

---

### 📊 Scoring Signals

| Signal | Score |
|------|-------|
| Exact title match | +100 |
| Title contains term | +50 |
| Page name match | +30 |
| URL match | +20 |
| Content match | +2 per occurrence (capped) |
| Short title bonus (<50 chars) | +5 |
| Fuzzy match (fallback) | ≤ +6 (capped) |

Scores are cumulative, with caps applied to prevent noisy results from dominating.

---

### 🌐 Source Priority

- **External documentation** (GitBook, Docusaurus, web) is prioritized over local files when relevance is similar.
- **Local files** rank slightly lower by default.

Hard rules:
- Fuzzy matching is **fallback only**
- Fuzzy results are always ranked **after** non-fuzzy results
- Fuzzy + external results are heavily penalized

---

### 🥇 Effective Ranking Order

1. Exact and partial matches in external sources  
2. Exact and partial matches in local files  
3. Content-only matches  
4. Fuzzy matches (shown last as related results)


---

## ➕ Sources

All searchable content is defined in `sources.json`.
Either online sources(primarily gitbooks) or offline sources(primarily .md markdown files)

### Steps

1. Open `sources.json`
2. Add a new online/offline source object
```json
{
  "online_sources": [
    {
      "id": "source-1",
      "name": "Source",
      "type": "gitbook",
      "search_url": "https://example.gitbook.io/example/?q={query}",
      "index_url": "https://example.gitbook.io/example",
      "enabled": true,
      "description": "Description of Example Site"
    },
    ....
    ....
],
  "offline_sources": [
    {
      "id": "local-notes",
      "name": "Offline Notes",
      "type": "local",
      "path": "/path/to/offline-notes",
      "file_extensions": [
        ".md"    # And other if you want
      ],
      "enabled": true,
      "description": "Local notes"
    }
  ]
}
```

3. Run the indexer
4. Restart the server

---

## 🚀 Quick Start

```bash
npm install
npm run index
npm start
