#!/usr/bin/env node
// Let's Hang — one-command setup + deploy to Cloudflare Workers.
//   npm install
//   npm run setup
// Safe to re-run: it skips steps that are already done.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const DB_NAME = 'lets-hang';
const TOML = new URL('../wrangler.toml', import.meta.url);
const say = (m) => console.log(`\n\x1b[1;35m▶ ${m}\x1b[0m`);
const ok = (m) => console.log(`\x1b[32m✔ ${m}\x1b[0m`);
const warn = (m) => console.log(`\x1b[33m! ${m}\x1b[0m`);

function wrangler(args, { capture = false, input } = {}) {
  const r = spawnSync('npx', ['wrangler', ...args], {
    shell: process.platform === 'win32',
    encoding: 'utf8',
    input,
    stdio: capture || input !== undefined ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return { code: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}` };
}

const readToml = () => readFileSync(TOML, 'utf8');
const writeToml = (s) => writeFileSync(TOML, s);

async function main() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) { console.error('Node 18 or newer is required (you have ' + process.versions.node + ').'); process.exit(1); }
  const rl = createInterface({ input: stdin, output: stdout });

  // 1. Log in
  say('Checking your Cloudflare login');
  let who = wrangler(['whoami'], { capture: true });
  if (who.code !== 0 || /not authenticated|You are not logged in/i.test(who.out)) {
    console.log('A browser window will open — log in to Cloudflare and click Allow.');
    if (wrangler(['login']).code !== 0) { console.error('Login failed.'); process.exit(1); }
  }
  ok('Logged in to Cloudflare');

  // 2. Database
  say('Setting up the database');
  let toml = readToml();
  if (toml.includes('REPLACE_WITH_YOUR_D1_DATABASE_ID')) {
    let id = null;
    const created = wrangler(['d1', 'create', DB_NAME], { capture: true });
    const m = created.out.match(/"?database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/i);
    if (m) id = m[1];
    if (!id) {
      // Already exists? Look it up.
      const list = wrangler(['d1', 'list', '--json'], { capture: true });
      try {
        const json = JSON.parse(list.out.slice(list.out.indexOf('['), list.out.lastIndexOf(']') + 1));
        id = json.find((d) => d.name === DB_NAME)?.uuid || null;
      } catch { /* fall through */ }
    }
    if (!id) { console.error('Could not create or find the database. Wrangler said:\n' + created.out); process.exit(1); }
    toml = toml.replace('REPLACE_WITH_YOUR_D1_DATABASE_ID', id);
    writeToml(toml);
    ok(`Database ready (${id}) and saved to wrangler.toml`);
  } else {
    ok('Database already configured');
  }

  // 3. Tables
  say('Creating / updating tables');
  const mig = wrangler(['d1', 'migrations', 'apply', DB_NAME, '--remote'], { input: 'y\n' });
  console.log(mig.out.split('\n').filter((l) => /✅|migrat|No migrations/i.test(l)).join('\n'));
  if (mig.code !== 0) { console.error(mig.out); process.exit(1); }
  ok('Tables are up to date');

  // 4. Deploy
  say('Deploying the app');
  let dep = wrangler(['deploy'], { capture: true });
  if (dep.code !== 0) { console.error(dep.out); process.exit(1); }
  const url = (dep.out.match(/https:\/\/[^\s]+\.workers\.dev/) || [])[0];
  if (url) ok(`Live at ${url}`); else ok('Deployed (check the Cloudflare dashboard for the URL)');

  // 5. APP_URL (needed for verifying Twilio reply webhooks)
  toml = readToml();
  if (url && /APP_URL\s*=\s*""/.test(toml)) {
    writeToml(toml.replace(/APP_URL\s*=\s*""/, `APP_URL = "${url}"`));
    say('Saving your app URL and redeploying');
    dep = wrangler(['deploy'], { capture: true });
    if (dep.code !== 0) { console.error(dep.out); process.exit(1); }
    ok('APP_URL set');
  }

  // 6. Texting (optional)
  const ans = (await rl.question('\nSet up Twilio texting now? You need your Account SID, Auth Token and Twilio number. (y/N) ')).trim().toLowerCase();
  if (ans === 'y' || ans === 'yes') {
    const sid = (await rl.question('Twilio Account SID (starts with AC): ')).trim();
    const token = (await rl.question('Twilio Auth Token: ')).trim();
    const from = (await rl.question('Twilio phone number (e.g. +16055551234): ')).trim();
    for (const [name, value] of [['TWILIO_ACCOUNT_SID', sid], ['TWILIO_AUTH_TOKEN', token], ['TWILIO_FROM', from]]) {
      if (!value) { warn(`Skipped ${name} (empty)`); continue; }
      const r = wrangler(['secret', 'put', name], { input: value + '\n' });
      if (r.code === 0) ok(`${name} saved`); else { warn(`Could not save ${name}:\n${r.out}`); }
    }
    if (url) {
      console.log(`\nIn the Twilio console, open your number → Messaging → "A message comes in":`);
      console.log(`  Webhook  ${url}/api/sms/inbound   (HTTP POST)`);
      console.log('That lets people reply OK to a pickup heads-up.');
    }
    warn('Remember: US texting needs A2P 10DLC (or toll-free) registration in Twilio before carriers deliver your texts.');
  } else {
    console.log('No problem — the app runs in practice mode (texts are logged, not sent). Run `npm run setup` again anytime.');
  }
  rl.close();

  say('All done!');
  if (url) console.log(`Open ${url} on your phone → "I'm a Parent" → "Set up your family".`);
  console.log('Tip: commit the updated wrangler.toml so GitHub deploys use the same database.');
}

main().catch((e) => { console.error(e); process.exit(1); });
