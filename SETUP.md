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
├── indexer.js                          # Core indexing logic
├── server.js                           # API server
├── sources.json.template               # Template (tracked in git)
├── sources.json                        # Your config (NOT tracked - private)
├── synonyms.json                       # Search synonym expansions
├── data/
│   ├── index.json                      # Generated search index
│   ├── index.meta.json                 # Index metadata
│   ├── cache/                          # Offline cached pages
│   └── backup-YYYY-MM-DDTHH-mm-ss.zip  # Backup file
└── public/
    └── app.html                        # Web interface
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

Docker note:

- Local/native runs can use host paths like `./notes` or `/home/user/notes`
- Docker runs should use container paths like `/app/notes`, with the real host path set in `.env` as `NOTES_PATH=/home/user/notes`

**Key Settings:**
- `default_ttl_days` - Days before re-indexing (default: 7)
- `max_pages_per_source` - Limit pages per source (null = unlimited)
- `timeout_seconds` - HTTP timeout (default: 15)
- `retry_attempts` - Retry failed requests (default: 2)

See [Configuration Guide](./CONFIGURATION-GUIDE.md) for complete reference.

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

If using Docker, do not put the host path in `sources.json`. Use `/app/notes` there instead, and put the real host path in `.env`.

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
npm run update /path/to/file.md
```

### Check Index Status
```bash
npm run info
```

**Example output:**
```
📊 ENGRAM Index Status
   Total pages: 292
   Last updated: 2026-03-10T15:30:00.000Z

📚 Sources:
   - HackTricks: 143 pages (indexed 2 days ago, TTL: 7d)
   - Local Notes: 45 pages (indexed today, TTL: 7d)
```

---

### Search the Index
```bash
npm run search "sql injection"
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
npm run remove /path/to/file.md
```

### CLI Help
```bash
npm run help
```

### Backup of index
```bash
npm run backup # Produces ./data/backup-2026-03-17T10-00-00.zip
```

### Restore of index
```bash
npm run restore # Auto-finds the latest zip in /data/
```
---

## 🐛 Troubleshooting

### "sources.json not found"
```bash
cp sources.json.template sources.json
```

### Git keeps tracking sources.json
```bash
git rm --cached sources.json
git commit -m "Stop tracking sources.json"
```

### Index seems outdated
```bash
# Check current status
node indexer.js info

# Force update everything
npm run index -- --force

# Or just update online sources
npm run index -- --force --online
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
npm run remove /path/to/file.md
```

### CLI Search
```bash
npm run search "sql injection"
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

### Indexing Commands
| Command | Description | Time |
|---------|-------------|------|
| `npm run index` | Smart incremental update | ~5-30s |
| `npm run index -- --force` | Force re-index everything | ~15min |
| `npm run index -- --online` | Index only online sources | ~10min |
| `npm run index -- --local` | Index only local files | ~5s |
| `npm run index -- --force --online` | Force online re-index | ~10min |
| `npm run index -- --force --local` | Force local re-index | ~5s |

### Information & Search
| Command | Description | Time |
|---------|-------------|------|
| `npm run info` | Show index status | instant |
| `npm run search "query"` | Search the index | instant |
| `npm run help` | Show help | instant |

### Cache & File Management
| Command | Description | Time |
|---------|-------------|------|
| `npm run cache` | Cache pages for offline use | varies |
| `npm run cache-status` | Check cache status | instant |
| `npm run update <file>` | Update single file | instant |
| `npm run remove <file>` | Remove file from index | instant |

### Server
| Command | Description | Time |
|---------|-------------|------|
| `npm start` | Start API server | instant |
