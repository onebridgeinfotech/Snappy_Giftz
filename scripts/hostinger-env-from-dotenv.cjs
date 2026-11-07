/**
 * Build env_vars JSON for Hostinger "Replace Node.js environment variables".
 *
 * Hostinger requires the FULL env set on every replace — never send masked ******** values.
 *
 * Usage:
 *   1. Export current production env from hPanel (or copy from a trusted backup) into `.env.hostinger`
 *   2. Add / edit Google keys in that file (see .env.example)
 *   3. node scripts/hostinger-env-from-dotenv.cjs .env.hostinger > .hostinger-req.json
 *   4. Apply via Hostinger MCP execute: hosting_nodejs_replace-environment-variables
 *   5. hosting_nodejs_start-build if you changed NEXT_PUBLIC_* vars
 */
const fs = require('fs');
const path = require('path');

const dotenvPath = process.argv[2];
if (!dotenvPath) {
  console.error('Usage: node scripts/hostinger-env-from-dotenv.cjs <path-to-dotenv>');
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(dotenvPath), 'utf8');
const env_vars = [];
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  env_vars.push({ key, value });
}

const payload = {
  username: 'u285517860',
  domain: 'snappygiftz.com',
  env_vars,
};

process.stdout.write(JSON.stringify(payload, null, 2));
