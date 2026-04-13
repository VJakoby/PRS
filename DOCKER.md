# 🚀 Docker Usage Workflow

### 1. Build the image (only when code changes)
```bash
docker compose build
```
---

### Local Note Mounts

Rule of thumb:

- `.env` uses real host paths such as `/home/kali/SYNC/Pentesting-Methodology`
- `sources.json` uses container paths such as `/app/notes`
- Docker should run as your host user for bind-mounted `./data`

If `sources.json` points to a host path while running in Docker, indexing will fail because that path does not exist inside the container.

The container supports one primary notes root and two optional additional note roots:

```env
NOTES_PATH=/home/user/pentest-notes
PUID=1000
PGID=1000
NOTES_PATH_2=
NOTES_PATH_3=
```

On Linux, set `PUID` and `PGID` to your real user:

```bash
echo "PUID=$(id -u)" >> .env
echo "PGID=$(id -g)" >> .env
```

Mounted paths inside the container:

- `NOTES_PATH` -> `/app/notes`
- `NOTES_PATH_2` -> `/app/notes-2`
- `NOTES_PATH_3` -> `/app/notes-3`

If all notes live under one parent directory, only `NOTES_PATH` is needed.
If notes live in multiple unrelated directories, define multiple `offline_sources` entries in `sources.json` that point to `/app/notes`, `/app/notes-2`, and `/app/notes-3`.
If `NOTES_PATH_2` or `NOTES_PATH_3` are left empty, they fall back to internal empty directories.

Example:

`.env`
```env
NOTES_PATH=/home/kali/SYNC/Pentesting-Methodology
```

`sources.json`
```json
{
  "offline_sources": [
    {
      "id": "pentesting-methodology",
      "name": "Pentesting Methodology",
      "type": "markdown",
      "path": "/app/notes",
      "enabled": true
    }
  ]
}
```

---

### 2. Run indexing after editing `sources.json` 
```bash
# Show usage commands
npm run docker:index:help

# ALL sources (index all defined sources)
npm run docker:index

# ALL sources (Force index on all defined sources)
npm run docker:index:force

# LOCAL sources (Index only local sources)
npm run docker:index:local

# ONLINE sources (Index only online sources)
npm run docker:index:online

# OPTIONAL: Build offline cache for sources (both online and local)
npm run docker:cache

# Create a portable zip backup of ./data
npm run docker:backup
---
```
---

### 3. Start the webserver
```bash
npm run docker:up
# OR
docker compose up -d
```

### Common Failure Modes

If you restored or moved `./data`, Docker may no longer be able to write `/app/data/index.json`. Fix it on the host:

```bash
mkdir -p data
sudo chown -R $USER:$USER data
chmod -R u+rwX data
```

If that directory is bind-mounted from Linux, also ensure `.env` contains matching `PUID` and `PGID`, then recreate the container:

```bash
npm run docker:down
npm run docker:up
```
