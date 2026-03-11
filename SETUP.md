# ENGRAM - Setup Guide

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
nano sources.json  # or use your favorite editor
```

### 3. Build Initial Index
```bash
npm run index -- --force
```

### 4. Start Server
```bash
npm start
```

---

## 📁 File Structure

```
engram/
├── indexer.js              # Core indexing logic
├── server.js               # API server
├── sources.json.template   # Template (tracked in git)
├── sources.json            # Your config (NOT tracked - private)
├── synonyms.json           # Search synonym expansions
├── data/
│   ├── index.json         # Generated search index
│   ├── index.meta.json    # Index metadata
│   └── cache/             # Offline cached pages
└── public/
    └── app.html           # Web interface
```

---

## 🛠️ Indexing Commands

### Smart Incremental (Default)
```bash
npm run index
```
- Respects TTL - only re-indexes old sources
- Fast daily updates (~5-30 seconds)
- Checks local files for modifications

### Force Full Re-index
```bash
npm run index -- --force
```
- Re-indexes ALL sources regardless of TTL
- Use after major config changes
- Takes ~10-15 minutes

### Index Only Online Sources
```bash
npm run index -- --online
```
- Indexes only online sources (GitBook, Docusaurus, etc.)
- Preserves local files in index
- Useful for updating documentation sites

### Index Only Local Files
```bash
npm run index -- --local
```
- Indexes only local markdown files
- Preserves online sources in index
- Super fast (~5 seconds)
- Perfect for daily note updates

### Combine Flags
```bash
# Force re-index only online sources
npm run index -- --force --online

# Force re-index only local files
npm run index -- --force --local
```

---

## ⚙️ Configuration

### sources.json Structure

```json
{
  "index_settings": {
    "default_ttl_days": 7,
    "max_pages_per_source": null,
    "timeout_seconds": 15,
    "retry_attempts": 2
  },
  "online_sources": [
    {
      "id": "unique_id",
      "name": "Display Name",
      "type": "gitbook|docusaurus|markdown",
      "enabled": true,
      "index_url": "https://...",
      "ttl_days": 7  // Optional override
    }
  ],
  "offline_sources": [
    {
      "id": "my_notes",
      "name": "My Notes",
      "type": "local",
      "enabled": true,
      "path": "./notes",
      "file_extensions": [".md", ".txt"]
    }
  ]
}
```

**Key Settings:**
- `default_ttl_days` - Days before re-indexing (default: 7)
- `max_pages_per_source` - Limit pages per source (null = unlimited)
- `timeout_seconds` - HTTP timeout (default: 15)
- `retry_attempts` - Retry failed requests (default: 2)
---

## 🔧 Common Tasks

### Add a New Online Source
```json
{
  "id": "new_source",
  "name": "New Documentation",
  "type": "gitbook",
  "enabled": true,
  "index_url": "https://docs.example.com"
}
```

Then run:
```bash
npm run index -- --force --online
```

### Add Local Files
```json
{
  "id": "my_notes",
  "type": "local",
  "enabled": true,
  "path": "/path/to/your/notes"
}
```

Then run:
```bash
npm run index -- --local
```

### Daily Update Workflow
```bash
# Quick incremental update (respects TTL)
npm run index

# Or if you only changed local files
npm run index -- --local
```

### Update Single File
```bash
node indexer.js update /path/to/file.md
```

### Check Index Status
```bash
node indexer.js info
```

---

## 📚 Advanced

### Custom Synonyms
Edit `synonyms.json` to add search term expansions:
```json
{
  "ssh": ["secure shell", "22/tcp", "openssh"],
  "smb": ["samba", "445/tcp", "cifs"]
}
```

### Cache for Offline Use
```bash
npm run cache
```

Check cache status:
```bash
npm run cache-status
```

### Remove File from Index
```bash
node indexer.js remove /path/to/file.md
```

### CLI Search
```bash
node indexer.js search "sql injection"
```

---

## 📊 Performance Tips

### Daily Workflow (Fastest)
```bash
npm run index -- --local  # ~5 seconds
```
Only updates your local notes.

### Weekly Update
```bash
npm run index  # ~30 seconds
```
Smart incremental - only updates sources outside TTL.

### Monthly Full Refresh
```bash
npm run index -- --force  # ~15 minutes
```
Complete re-index of everything.


---

## 📖 Documentation
- **[README.md](./README.md)** - Full documentation
- `sources.json.template` - Configuration template

---

## 🆘 Getting Help

1. Check index status: `node indexer.js info`
2. Check server logs in terminal
3. Verify `sources.json` syntax (valid JSON)
4. Try `npm run index -- --force` to rebuild
5. Check documentation links above

---

## ✅ First Time Setup Checklist

- [ ] Run `npm install`
- [ ] Copy `sources.json.template` to `sources.json`
- [ ] Edit `sources.json` with your sources
- [ ] Verify `sources.json` is in `.gitignore`
- [ ] Run `npm run index -- --force`
- [ ] Run `npm start`
- [ ] Visit `http://localhost:3002`
- [ ] Test search functionality
- [ ] Configure TTL if needed

Done! 🎉

---

## 🎯 Quick Reference

| Command | Description | Time |
|---------|-------------|------|
| `npm run index` | Smart incremental update | ~5-30s |
| `npm run index -- --force` | Force re-index everything | ~15min |
| `npm run index -- --online` | Index only online sources | ~10min |
| `npm run index -- --local` | Index only local files | ~5s |
| `npm run index -- --force --online` | Force online re-index | ~10min |
| `npm run index -- --force --local` | Force local re-index | ~5s |
| `node indexer.js info` | Show index status | instant |
| `node indexer.js update <file>` | Update single file | instant |
| `npm start` | Start API server | instant |