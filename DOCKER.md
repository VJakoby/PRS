# 🚀 Docker Usage Workflow

### 1. Build the image (only when code changes)
```bash
docker compose build
```
---

### Local Note Mounts

The container supports one primary notes root and two optional additional note roots:

```env
NOTES_PATH=/home/user/pentest-notes
NOTES_PATH_2=
NOTES_PATH_3=
```

Mounted paths inside the container:

- `NOTES_PATH` -> `/app/notes`
- `NOTES_PATH_2` -> `/app/notes-2`
- `NOTES_PATH_3` -> `/app/notes-3`

If all notes live under one parent directory, only `NOTES_PATH` is needed.
If notes live in multiple unrelated directories, define multiple `offline_sources` entries in `sources.json` that point to `/app/notes`, `/app/notes-2`, and `/app/notes-3`.
If `NOTES_PATH_2` or `NOTES_PATH_3` are left empty, they fall back to internal empty directories.

---

### 2. Run indexing after editing `sources.json` 
```bash
# Show usage commands
docker compose run --rm engram npm run index -- --help

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

# OPTIONAL: Build offline cache for sources(both online and local)

docker compose run --rm engram npm run cache
```
---

### 3. Start the webserver
```bash
docker compose up -d
# OR
npm run docker:up
```
