# ENGRAM - Setup Guide (NPM)

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
│   └── index.json         # Generated search index
└── public/
    └── app.html           # Web interface
```

---

## ⚙️ Configuration

### sources.json Structure

```json
{
  "index_settings": {
    "default_ttl_days": 7
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
npm run index -- --force
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

### Update Index (Smart Mode)
```bash
npm run index
```
Only re-indexes sources older than their TTL.

### Force Full Re-index
```bash
npm run index -- --force
```
Re-indexes everything regardless of TTL.

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
npm run index -- --force
```

### Check index status
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

### Update Single File (Local Sources)
```bash
node indexer.js update /path/to/file.md
```

---

## 🔐 Security Note

**Never commit `sources.json` to public repositories!**

It may contain:
- Private file paths
- Internal documentation URLs
- Your personal note locations

The `.gitignore` file prevents this, but always double-check:
```bash
git status  # sources.json should NOT appear
```

---

## 📖 Documentation

- [TTL Simple Guide](./TTL-SIMPLE-GUIDE.md) - TTL configuration
- [TTL Full Guide](./TTL-GUIDE.md) - Advanced TTL features
- `sources.json.template` - Configuration template

---

## 🆘 Getting Help

1. Check `node indexer.js info` for index status
2. Check server logs in terminal
3. Verify sources.json syntax (valid JSON)
4. Try `npm run index -- --force` to rebuild

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