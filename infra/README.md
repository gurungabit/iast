# Terminal Development Infrastructure

## Quick Start

### Start Valkey (Redis)

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Stop Valkey

```bash
docker compose -f docker-compose.dev.yml down
```

### View Logs

```bash
docker compose -f docker-compose.dev.yml logs -f valkey
```

### Connect to Valkey CLI

```bash
docker exec -it terminal-valkey valkey-cli
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Valkey | 6379 | Redis-compatible pub/sub for terminal I/O |

## Data Persistence

Valkey data is persisted in a Docker volume named `valkey-data`.

To completely reset:

```bash
docker compose -f docker-compose.dev.yml down -v
```
