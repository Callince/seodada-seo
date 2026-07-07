# Deploying to DigitalOcean (Droplet + Docker Compose)

This deploys the whole stack — Postgres, Redis, the FastAPI API, the recurring
scheduler, the React SPA, and a Caddy edge proxy with **automatic HTTPS** — onto
a single DigitalOcean Droplet.

```
                         Internet
                            │  :80 / :443 (HTTPS, auto Let's Encrypt)
                       ┌────▼────┐
                       │  Caddy  │   /api/* → api    /* → web
                       └──┬───┬──┘
                  ┌───────┘   └────────┐
             ┌────▼────┐          ┌────▼────┐
             │  web    │          │   api   │  (uvicorn, SCHEDULER_ENABLED=false)
             │ (nginx) │          └──┬───┬──┘
             └─────────┘             │   │
                              ┌──────▼┐ ┌▼───────┐    ┌────────────┐
                              │  db   │ │ redis  │    │ scheduler  │  (one replica)
                              │postgres│ │        │    │ SCHEDULER_ │
                              └───────┘ └────────┘    │ ENABLED=true│
                                                      └────────────┘
```

Only Caddy is exposed to the internet (ports 80/443). Everything else talks over
the private compose network.

---

## 1. Create the Droplet

- DigitalOcean → **Create → Droplet**.
- **Image:** Ubuntu 24.04 LTS.
- **Plan:** Basic / Regular. **2 GB RAM / 1 vCPU** ($12/mo) is comfortable;
  1 GB ($6/mo) works for light use (add a swap file if you hit OOM during builds).
- **Authentication:** SSH key (recommended).
- Create it, note the **public IPv4**.

## 2. Point your domain at it

In your DNS provider, add an **A record**:

| Type | Host                 | Value (Droplet IPv4) | TTL  |
|------|----------------------|----------------------|------|
| A    | `app` (or `@`)       | `xxx.xxx.xxx.xxx`    | 3600 |

Caddy can only issue a TLS certificate once this record resolves to the Droplet.
Verify: `dig +short app.yourdomain.com` returns the Droplet IP.

## 3. Install Docker on the Droplet

SSH in (`ssh root@DROPLET_IP`) and run:

```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

(Optional) basic firewall:

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 4. Get the code onto the Droplet

```bash
git clone <YOUR_REPO_URL> /opt/seo && cd /opt/seo
# …or use `scp -r` / `rsync` to copy this project to /opt/seo
```

## 5. Configure secrets

```bash
cp .env.production.example .env.production
nano .env.production
```

Fill in **every** `CHANGE_ME`:

- `DOMAIN` / `TLS_EMAIL` — your domain and an email for Let's Encrypt.
- `POSTGRES_PASSWORD` — generate: `openssl rand -hex 24` (keep it alphanumeric).
- `DATABASE_URL` — must contain the **same** user/password/db, host stays `db`.
- `JWT_SECRET` — generate: `openssl rand -hex 32`.
- `DFS_LOGIN` / `DFS_PASSWORD` — your DataForSEO API credentials.
- `CORS_ORIGINS` — `https://<your DOMAIN>`.
- (Optional) `SMTP_*` for scheduled-report email, `GEMINI_API_KEY` for the AI Advisor.

## 6. Deploy

```bash
chmod +x deploy.sh
./deploy.sh            # builds images, runs migrations, starts everything
```

Or manually:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Watch it come up:

```bash
./deploy.sh ps
./deploy.sh logs caddy     # first run: you'll see the certificate being issued
```

Visit **https://app.yourdomain.com** — the green padlock confirms TLS.

## 7. Create your first account

Open the site and register, or via the API:

```bash
curl -s -X POST https://app.yourdomain.com/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@yourdomain.com","password":"a-strong-password","full_name":"You","org_name":"Your Co"}'
```

---

## Day-2 operations

**Redeploy after a code change**
```bash
cd /opt/seo && git pull && ./deploy.sh
```

**Logs**
```bash
./deploy.sh logs            # everything
./deploy.sh logs api        # one service: api | scheduler | web | caddy | db | redis
```

**Database backup / restore**
```bash
# Backup (writes a timestamped dump to the host)
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_dump -U seo seo | gzip > backup-$(date +%F).sql.gz

# Restore
gunzip -c backup-YYYY-MM-DD.sql.gz | \
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db psql -U seo seo
```
Tip: schedule the backup line in `crontab -e` and copy dumps to DO Spaces.

**Run a migration manually**
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate
```

**Stop / start**
```bash
./deploy.sh down
./deploy.sh up
```

---

## Notes & gotchas

- **HTTPS not issuing?** The A record must resolve to the Droplet *before* Caddy
  starts, and ports 80/443 must be open. Check `./deploy.sh logs caddy`. While
  testing, you can flip Caddy to the Let's Encrypt **staging** CA (see the
  commented line in `Caddyfile`) to avoid hitting rate limits, then switch back.
- **Scheduler runs in its own container.** The API runs with
  `SCHEDULER_ENABLED=false`; only the `scheduler` service ticks. This means you
  can safely scale the API (`docker compose ... up -d --scale api=3`) without
  duplicating scheduled reports. (You'd also need to remove the `api` host-port
  publish — already the case here, since only Caddy publishes ports.)
- **Secrets** live only in `.env.production` on the Droplet. It is git-ignored
  and excluded from the Docker build context — never baked into an image.
- **Data persists** in named volumes `pgdata`, `redisdata`, and `caddy_data`
  (certificates). `docker compose ... down` keeps them; add `-v` only if you
  intend to wipe all data.
- **DataForSEO is billed** (`DFS_USE_SANDBOX=false`). Set it to `true` to demo
  with mock data at no cost.
