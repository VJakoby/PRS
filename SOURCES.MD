# Example Sources.JSON
Create a new file `sources.json` with this content inside and choose your sources.
```
{
  "offline_sources": [
    {
      "id": "local-notes",
      "name": "Local Notes",
      "type": "markdown",
      "path": "./change/to/localnote/dir",
      "file_extensions": [
        ".md",
        ".markdown"
      ],
      "enabled": false,
      "description": "Personal pentest notes in markdown format"
    }
  ],
  "online_sources": [
    {
      "id": "github-notes-example",
      "name": "SQL Injection Payloads - GitHub",
      "type": "markdown",
      "enabled": true,
      "cache_offline": false,
      "description": "EXAMPLE Raw markdown files from GitHub",
      "urls": [
        "https://github.com/yogsec/SQL-Injection-Payloads/blob/main/README.md"
      ]
    },
    ...
    ...
  ],
  "index_settings": {
    "auto_refresh": false,
    "refresh_interval_hours": 24,
    "max_pages_per_source": 50,
    "timeout_seconds": 15,
    "retry_attempts": 2
  }
}
```