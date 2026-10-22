# XML → Redis exporter

A TypeScript CLI that reads `config.xml` and atomically writes its subdomains and cookies to Redis. The supplied XML is included unchanged.

## Run

Requires Docker Engine and Docker Compose v2. From the repository:

```sh
./export.sh -v ./config.xml
# Or any readable XML file (paths with spaces are supported):
./export.sh "/path/to/my config.xml"
```

If the repository is on your PATH, the command is also `export.sh -v /path/to/xml`.

The script starts Redis, waits for its health check, builds the TypeScript container, and runs a disposable importer. Redis remains running and persists data in the `redis-data` Docker volume. No host Redis port is exposed. `-v` prints each saved key to stdout; a summary and diagnostic messages go to stderr. Without `-v`, no keys are printed. Failures return a nonzero status.

For the included file, the result is **47 keys**:

- `subdomains`: a JSON array of 38 URLs, preserving order.
- `cookie:<name>:<host>`: 46 string values, preserving case and whitespace (XML entities are decoded).

For example, `cookie:dlp-avast:amazon` contains `mmm_amz_dlp_777_ppc_m`.

```sh
docker compose exec -T redis redis-cli GET subdomains
docker compose exec -T redis redis-cli GET cookie:dlp-avast:amazon
docker compose down          # stop; keep data
docker compose down -v       # stop and DELETE persisted data
```

Imports overwrite matching keys with a single atomic `MSET`; unrelated keys, including cookies from older imports absent from the current file, remain unchanged. Repeating an import is safe. Malformed XML, DTDs/custom entities, missing sections/attributes, duplicate cookie keys, nested cookie values, and colons in cookie names/hosts are rejected before connecting to Redis. Empty sections and empty cookie strings are supported.

## Develop and test

Requires Node.js 22+ (Docker uses Node.js 24).

```sh
npm ci
npm run build
npm test
```

Tests cover the included XML, singleton/empty collections, string preservation, invalid input, arguments, and atomic Redis writes/failures. To run the compiled CLI against an existing Redis instance:

```sh
REDIS_URL=redis://localhost:6379 npm start -- -v ./config.xml
```

The URL defaults to `redis://localhost:6379`; Compose supplies its internal Redis URL. Never commit credentials or `.env` files.

## Deployment

This assignment is a batch importer, so a web UI or Vercel deployment is unnecessary. Docker Compose provides the requested importer and Redis containers locally or on a Docker host. Vercel does not run this Compose stack or host Redis. A future web interface would need a separately hosted Redis service and authenticated upload/API handling; that is outside this CLI's scope.

When building behind a corporate/cloud proxy, Compose forwards existing `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` settings. Set `NODE_EXTRA_CA_CERTS` to your trusted proxy CA file if required; it is mounted only as a build secret. TLS verification stays enabled. On cloud hosts with a read-only Docker configuration directory, use `DOCKER_CONFIG=/tmp/emaww-docker ./export.sh -v config.xml`.
