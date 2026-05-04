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

On Linux:

```bash
echo "PUID=$(id -u)" >> .env
echo "PGID=$(id -g)" >> .env
```

Mounted paths:

- `/app/notes`
- `/app/notes-2`
- `/app/notes-3`

---

### 2. Run indexing (Docker CLI)

```bash
docker compose run --rm engram npm run index --help
```

#### Indexing

```bash
docker compose run --rm engram npm run index
docker compose run --rm engram npm run index -- --local
docker compose run --rm engram npm run index -- --online
docker compose run --rm engram npm run index -- --force
```

#### Utilities

```bash
docker compose run --rm engram npm run info
docker compose run --rm engram npm run search "query"
```

#### Cache / backup

```bash
docker compose run --rm engram npm run cache
docker compose run --rm engram npm run backup
docker compose run --rm engram npm run restore
```

---

### 3. Start server

```bash
docker compose up -d
```

---

### Common Issues

Fix permissions:

```bash
mkdir -p data
sudo chown -R $USER:$USER data
chmod -R u+rwX data
```

Restart:

```bash
docker compose down
docker compose up -d
```
