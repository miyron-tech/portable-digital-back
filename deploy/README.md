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

## Catalogue updates

The catalogue lives in `src/seed/services.data.ts`. Deploying the backend does not change the
database; after a catalogue change, run the seed once on the server:

```sh
docker exec portable-backend node dist/seed/seed.js
```

It upserts every service by slug and unpublishes the legacy slugs listed in
`LEGACY_SERVICE_SLUGS` (the frontend redirects those addresses with 301). Services edited in the
admin panel are overwritten by the seed for matching slugs — check the live catalogue first.

Before changing catalogue texts, check them against buydone.tech, which shares the merchant
account: export its live catalogue as JSON lines (slug, title, summary, description, features,
seo, pricing labels and milestone titles) and run

```sh
npm run build && node -e "const {SERVICES_SEED:s,LEGACY_SERVICE_SLUGS:l}=require('./dist/seed/services.data.js');require('fs').writeFileSync('/tmp/portable.json',JSON.stringify({services:s,legacy:l}))"
python3 scripts/catalogue-overlap.py /tmp/portable.json buydone-live.jsonl <buydone repo>/src/seed/services.data.ts
```

The expected result is `overlaps with buydone: 0`.

## Email

After a successful payment the customer receives an "order paid" email: the order contents, the
amount, the accepted terms edition and how to cancel. Emails are written to the `mail_outbox`
collection first and sent by a worker inside the API, with retries; a repeated webhook never
sends a second email (`order-paid:<order id>` dedupe key).

Without `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` in `/opt/portable/.env` the emails stay queued
and go out once SMTP is configured and the backend restarted. Before that, the sending domain
needs SPF, DKIM and DMARC records for the chosen mailbox provider, otherwise mail lands in spam.
Optional: `SMTP_PORT` (465 by default), `MAIL_FROM`, `MAIL_REPLY_TO`.
