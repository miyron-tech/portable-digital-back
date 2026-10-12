# Production deploy — portable.digital

Server `5.101.179.107`, directory `/opt/portable`. The site sits behind Cloudflare and the
shared Caddy from `/opt/buydone` (container `buydone-caddy`, network `buydone_buydone`).
Other sites run on the same host (buydone.tech, intexa-ai.com, mplato.com), so deploys only
ever recreate `portable-*` containers.

## How a deploy happens

A push to `main` in either repository runs `.github/workflows/deploy.yml`:

1. **Gate** — `npm ci`, typecheck/lint and a production build. The frontend build runs with an
   unreachable `API_URL` on purpose: a build that depends on a live API fails here.
2. **Sync** — rsync of the repository to `/opt/portable/back/` or `/opt/portable/front/`.
   `.env*`, `node_modules` and build output are never shipped. The backend workflow also copies
   `deploy/docker-compose.yml` and `deploy/deploy.sh` to `/opt/portable/`.
3. **Roll out** — `/opt/portable/deploy.sh <backend|frontend> <sha>` tags the running image
   `:previous`, builds, recreates only that service and waits for health. If the service does
   not become healthy, it swaps back to `:previous` automatically.
4. **Smoke test** through the public domain.

Every run is logged in `/opt/portable/deploy.log`. A lock (`.deploy.lock`) serialises the two
repositories' deploys.

## Manual operations on the server

```sh
/opt/portable/deploy.sh frontend --rollback   # swap back to the previous image (run again to undo)
/opt/portable/deploy.sh backend --rollback
tail /opt/portable/deploy.log
```

Deploy by pushing to `main` (or *Run workflow* in Actions), not by copying files from a laptop.

## Secrets

Production secrets live only in `/opt/portable/.env` on the server: `PUBLIC_ORIGIN`,
`MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and for payments `WEMOPAY_API_KEY`,
`WEMOPAY_SIGNING_KEY` (optional `WEMOPAY_BASE_URL`). Payments stay off while the keys are empty.

GitHub, in both repositories → Settings → Environments → `production`:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | `5.101.179.107` |
| `DEPLOY_SSH_KEY` | private key `github-actions-deploy@portable.digital` (authorised for root on the server) |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan 5.101.179.107`, checked against the known fingerprints |
