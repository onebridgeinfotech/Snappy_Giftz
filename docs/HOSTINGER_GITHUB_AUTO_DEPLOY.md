# Hostinger ↔ GitHub auto-deploy (snappygiftz.com)

Production is a **Next.js Node.js** app on Hostinger. Auto-deploy on every `main` push needs the **Hostinger GitHub App** (not zip upload alone).

## One-time setup in hPanel (required)

1. Log in to [hPanel](https://hpanel.hostinger.com).
2. **Websites** → **snappygiftz.com** → **Manage**.
3. Open **Advanced** → **Git** (or **Deployments** → **Git**).
4. Click **Connect GitHub** (or **Authorize GitHub**) and approve access for **onebridgeinfotech/Snappy_Giftz**.
5. Tell your agent: **“enable Hostinger git auto-deploy”** — it will call Hostinger API to:
   - Set repo `onebridgeinfotech/Snappy_Giftz`, branch **`main`**
   - Start the first Git-sourced Node.js build
   - Turn on **auto-deploy on push**

Until step 4 is done, API returns: `No active Git installation`.

## What runs on each push to `main`

After setup:

1. GitHub notifies Hostinger (Hostinger GitHub App webhook).
2. Hostinger clones `main`, runs `npm run build` (Next.js 22, output `.next`).
3. Publishes standalone output and restarts the Node process.

Build settings are stored on the server (Node 22, `app_type: next`, `build_script: build`).

## Manual deploy (without waiting for Git)

- **Zip:** upload `Snappy_Giftz-main.zip` + **Start build** in hPanel, or use `scripts/upload-hostinger-archive.ps1`.
- **Local MCP:** `hosting_deploy` with project path (see deploy history in chat).

## GitHub webhook (legacy)

A **repository webhook** may exist pointing at `webhooks.hostinger.com/deploy/...` from an older **Git → public_html subdirectory** setup. That path does **not** replace the Node.js build pipeline above. Prefer the GitHub App flow in hPanel.

## Transactional email (SMTP / outbox)

Hostinger Titan for **info@snappygiftz.com** (not `snppygiftz` — common typo).

In hPanel → **snappygiftz.com** → **Advanced** → **Node.js** → **Environment variables**, set:

| Variable | Value |
|----------|--------|
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `info@snappygiftz.com` |
| `SMTP_PASSWORD` | *(mailbox password — must match Titan)* |
| `SMTP_FROM_EMAIL` | `info@snappygiftz.com` |
| `EMAIL_FROM` | `info@snappygiftz.com` |
| `EMAIL_AUTO_DISPATCH` | `true` |

Save (Hostinger restarts Node). Local check: `node scripts/verify-smtp.cjs` with `SMTP_PASSWORD` set.

Admin → **Emails** → **Process Outbox Worker**, then **Retry** on any `FAILED` rows.

To push env via API you need a **full** `.env.hostinger` export (see `scripts/hostinger-env-from-dotenv.cjs`); MCP replace deletes any key not included.

After deploy: `GET /api/health/email` reports SMTP verify status (no secrets).

## Verify

- After pushing to `main`, check hPanel **Deployments** / build logs, or ask the agent to run `hosting_get-deployment` for `snappygiftz.com`.
- Smoke: `npx tsx scripts/qa-production-smoke.ts`
