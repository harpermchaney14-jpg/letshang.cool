// Let's Hang — Cloudflare Worker API.
// Every permission check happens here on the server; the app's own checks are only for display.

import { hashPassword, verifyPassword, createSession, readSession, destroySession } from './auth.js';
import { sendSms, normalizePhone, verifyTwilioSignature, smsConfigured } from './sms.js';
import { TIME_RE, toMin, localNow, pickSchoolDay, schedule, walkWeather, geocode } from './today.js';
import { MIGRATIONS } from './schema.js';

// ================================================================ helpers
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const json = (data, init = {}) => new Response(JSON.stringify(data), {
  status: init.status || 200,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers || {}) },
});
const nowIso = () => new Date().toISOString();
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const toInt = (v) => { const n = Number(v); return Number.isInteger(n) ? n : null; };
const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on') ? 1 : 0;
const all = async (env, sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results || [];
const first = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).first();
const run = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).run();
const firstName = (n) => String(n || '').split(' ')[0];

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const AVATARS = ['star', 'fox', 'cat', 'unicorn', 'alien', 'panda', 'frog', 'fire', 'skate', 'music', 'gamer', 'butterfly', 'crown', 'rocket', 'rainbow', 'bolt'];
const THEMES = ['neon', 'pastel'];
const TZ = (env) => env.TIMEZONE || 'America/Chicago';
const when = (env, iso) => new Intl.DateTimeFormat('en-US', {
  timeZone: TZ(env), weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(iso));

/** Allow at most `limit` events per `windowMs` for a key. Records the attempt when allowed. */
async function rateLimit(env, key, limit, windowMs, message) {
  const r = await first(env, 'SELECT COUNT(*) AS n FROM rate_events WHERE key = ? AND at > ?', key, ago(windowMs));
  if (r.n >= limit) fail(429, message || 'Slow down a little and try again soon.');
  await run(env, 'INSERT INTO rate_events (key) VALUES (?)', key);
}

/** Friend codes like HANG-7KQ2: 32^4 ≈ 1M combinations from crypto randomness, rate-limited lookups. */
async function newFriendCode(env) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 20; i++) {
    const b = crypto.getRandomValues(new Uint8Array(4));
    const code = 'HANG-' + [...b].map((x) => alphabet[x % 32]).join('');
    if (!(await first(env, 'SELECT id FROM users WHERE friend_code = ?', code))) return code;
  }
  fail(500, 'Could not make a friend code, try again');
}

function randomRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(12));
  const s = [...b].map((x) => alphabet[x % 32]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

// ---- moderation: keep personal info and mean words out of kid chat
const PERSONAL_INFO = [
  /\b\d{3}[\s.\-)]*\d{3}[\s.\-]*\d{4}\b/,                                  // phone numbers
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,                                           // emails
  /\b\d{1,5}\s+(\w+\s){0,2}(st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive|ct|court|way|pl|place)\b/i, // addresses
  /\b(https?:\/\/|www\.)\S+/i,                                             // links
];
const MEAN_WORDS = /\b(fuck\w*|shit\w*|bitch\w*|cunt|nigg\w*|fag\w*|retard\w*|slut\w*|whore\w*|kys|kill\s+yourself)\b/i;
const NEEDS_CARE = /\b(kill\s+myself|kms|want\s+to\s+die|suicid\w*|hurt\s+myself|cut\s+myself)\b/i;
function moderate(text) {
  if (PERSONAL_INFO.some((re) => re.test(text))) return "For safety, don't share phone numbers, emails, addresses or links in chat.";
  if (MEAN_WORDS.test(text)) return "Let's keep it kind — that message has words we don't allow.";
  return null;
}

// ---- relationships
const kidRow = (env, id) => first(env, `SELECT id, family_id, display_name, avatar, chat_enabled, notify_prefs FROM users WHERE id = ? AND role = 'kid'`, id);
const parentsOf = (env, familyId) => all(env, `SELECT id, display_name, phone, sms_opt_in, notify_prefs FROM users WHERE family_id = ? AND role = 'parent'`, familyId);

/** Can this user act for (or view) this kid? Kids: only themselves. Parents: kids in their family. */
async function ownKid(env, user, kidId) {
  const kid = await kidRow(env, toInt(kidId));
  if (!kid) fail(404, 'Kid not found');
  if (user.role === 'kid' ? kid.id !== user.id : kid.family_id !== user.family_id) fail(403, "That's not your account");
  return kid;
}
async function isBlocked(env, a, b) {
  return !!(await first(env, 'SELECT 1 AS x FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)', a, b, b, a));
}
function pair(a, b) { return a < b ? [a, b] : [b, a]; }
const publicKid = (u) => ({ id: u.id, display_name: u.display_name, avatar: u.avatar });

/** Friendship visible to this user: a kid in it, or a parent of a kid in it. */
async function friendshipFor(env, user, id) {
  const f = await first(env,
    `SELECT f.*, a.family_id AS fam_a, b.family_id AS fam_b,
            a.display_name AS name_a, b.display_name AS name_b, a.avatar AS av_a, b.avatar AS av_b
       FROM friendships f JOIN users a ON a.id = f.kid_a JOIN users b ON b.id = f.kid_b WHERE f.id = ?`, toInt(id));
  if (!f) fail(404, 'Not found');
  const allowed = user.role === 'kid' ? (f.kid_a === user.id || f.kid_b === user.id) : (f.fam_a === user.family_id || f.fam_b === user.family_id);
  if (!allowed) fail(403, 'Not allowed');
  return f;
}

// ---- notifications
const PREF_FOR = { checkin: 'checkins', message: 'messages', friend_request: 'friends', friend_accepted: 'friends', friend_approval: 'friends', plan_approval: 'plans', plan_update: 'plans', ready: 'ready' };
async function notify(env, ctx, users, n, { sms = false } = {}) {
  const stmts = [];
  const texts = [];
  for (const u of users) {
    if (!u) continue;
    let prefs = {};
    try { prefs = JSON.parse(u.notify_prefs || '{}'); } catch { /* default */ }
    const cat = PREF_FOR[n.type];
    if (cat && prefs[cat] === false && n.type !== 'plan_approval' && n.type !== 'friend_approval') continue; // approvals always delivered
    if (n.dedupe) {
      const dup = await first(env, 'SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ? AND read_at IS NULL', u.id, n.dedupe);
      if (dup) continue;
    }
    stmts.push(env.DB.prepare('INSERT INTO notifications (user_id, type, title, body, link, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(u.id, n.type, n.title, n.body || null, n.link || null, n.dedupe || null));
    if (sms && u.sms_opt_in && u.phone) texts.push(u.phone);
  }
  if (stmts.length) await env.DB.batch(stmts);
  for (const phone of new Set(texts)) ctx.waitUntil(sendSms(env, phone, `${n.title}${n.body ? ' — ' + n.body : ''}`).catch(console.error));
}
const usersById = (env, ids) => ids.length
  ? all(env, `SELECT id, role, display_name, phone, sms_opt_in, notify_prefs, family_id FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids)
  : [];

// ================================================================ routing
const routes = [];
function add(method, path, handler, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, auth: opts.auth !== false, role: opts.role, raw: !!opts.raw });
}

// ---- self-setup: apply any database migrations that haven't run yet.
// Uses the same d1_migrations table as `wrangler d1 migrations apply`, so the two never double-apply.
let schemaReady = null;
async function applyMigrations(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  const done = new Set((await all(env, 'SELECT name FROM d1_migrations')).map((r) => r.name));
  const applied = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    // One batch = one transaction: the migration and its record land together or not at all.
    await env.DB.batch([
      ...m.statements.map((s) => env.DB.prepare(s)),
      env.DB.prepare('INSERT INTO d1_migrations (name) VALUES (?)').bind(m.name),
    ]);
    applied.push(m.name);
  }
  if (applied.length) console.log('Applied migrations:', applied.join(', '));
}
function ensureSchema(env) {
  if (!schemaReady) schemaReady = applyMigrations(env).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try { await ensureSchema(env); } catch (e) {
      console.error('Database setup failed', e);
      return json({ error: 'Database setup failed: ' + String(e.message || e).slice(0, 200) }, { status: 500 });
    }
    if (request.method !== 'GET' && url.pathname !== '/api/sms/inbound') {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'Bad origin' }, { status: 403 });
    }
    for (const r of routes) {
      if (r.method !== request.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      try {
        let user = null;
        if (r.auth) {
          user = await readSession(env, request);
          if (!user) fail(401, 'Please log in');
          if (r.role && user.role !== r.role) fail(403, r.role === 'parent' ? 'Only parents can do that' : 'Only kids can do that');
        }
        let body = {};
        if (!r.raw && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) body = (await request.json().catch(() => ({}))) || {};
        return await r.handler({ request, env, ctx, url, params, user, body });
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
        console.error(e);
        return json({ error: 'Something went wrong on our end. Try again.' }, { status: 500 });
      }
    }
    return json({ error: 'Not found' }, { status: 404 });
  },

  // Daily clean-up: data retention + expired sessions.
  async scheduled(event, env) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()),
      env.DB.prepare('DELETE FROM rate_events WHERE at < ?').bind(ago(2 * 864e5)),
      env.DB.prepare('DELETE FROM notifications WHERE created_at < ?').bind(ago(60 * 864e5)),
      env.DB.prepare('DELETE FROM messages WHERE created_at < ?').bind(ago(365 * 864e5)),
      env.DB.prepare('DELETE FROM family_messages WHERE created_at < ?').bind(ago(365 * 864e5)),
      env.DB.prepare('DELETE FROM ready_events WHERE created_at < ?').bind(ago(30 * 864e5)),
      env.DB.prepare('DELETE FROM sms_log WHERE created_at < ?').bind(ago(90 * 864e5)),
      env.DB.prepare('DELETE FROM rides WHERE starts_at < ?').bind(ago(90 * 864e5)),
    ]);
  },
};

// ================================================================ health
add('GET', '/api/health', async ({ env }) => {
  try {
    const t = await all(env, "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users','friendships','houses','plans')");
    const cols = await all(env, "SELECT name FROM pragma_table_info('users') WHERE name = 'theme'");
    const mig = await all(env, 'SELECT name FROM d1_migrations ORDER BY id');
    return json({ ok: t.length === 4 && cols.length === 1, tables: t.map((x) => x.name).sort(), theme_column: cols.length === 1, migrations: mig.map((x) => x.name) });
  } catch (e) {
    return json({ ok: false, error: 'Database not reachable — is the D1 binding named DB?' }, { status: 500 });
  }
}, { auth: false });

// ================================================================ accounts
add('POST', '/api/signup', async ({ env, request, body }) => {
  const name = str(body.name, 40);
  const username = str(body.username, 30).toLowerCase();
  const password = String(body.password || '');
  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (!name) fail(400, 'Enter your name');
  if (!USERNAME_RE.test(username)) fail(400, 'Username: 3–30 letters, numbers, dots or dashes');
  if (password.length < 8) fail(400, 'Password needs at least 8 characters');
  if (body.phone && !phone) fail(400, "That phone number doesn't look right");
  await rateLimit(env, 'signup:' + (request.headers.get('cf-connecting-ip') || 'x'), 10, 3600e3);
  if (await first(env, 'SELECT id FROM users WHERE username = ?', username)) fail(409, 'That username is taken');

  const family = await first(env, 'INSERT INTO families (name) VALUES (?) RETURNING id', str(body.family_name, 40) || `${name.split(' ').pop()} Family`);
  const { hash, salt } = await hashPassword(password);
  const recovery = randomRecoveryCode();
  const rec = await hashPassword(recovery);
  const u = await first(env,
    `INSERT INTO users (family_id, role, display_name, username, pass_hash, pass_salt, phone, sms_opt_in, avatar, onboarded, recovery_hash, recovery_salt)
     VALUES (?, 'parent', ?, ?, ?, ?, ?, ?, 'crown', 1, ?, ?) RETURNING id`,
    family.id, name, username, hash, salt, phone, phone ? bool(body.sms_opt_in) : 0, rec.hash, rec.salt);
  const cookie = await createSession(env, request, u.id);
  return json({ ok: true, recovery_code: recovery }, { headers: { 'set-cookie': cookie } });
}, { auth: false });

add('POST', '/api/login', async ({ env, request, body }) => {
  const username = str(body.username, 30).toLowerCase();
  const key = 'login:' + username;
  const r = await first(env, 'SELECT COUNT(*) AS n FROM rate_events WHERE key = ? AND at > ?', key, ago(15 * 60e3));
  if (r.n >= 8) fail(429, 'Too many tries. Wait 15 minutes, or ask a parent to reset your PIN.');
  const u = await first(env, 'SELECT id, role, pass_hash, pass_salt FROM users WHERE username = ?', username);
  if (!u || !(await verifyPassword(String(body.password || ''), u.pass_hash, u.pass_salt))) {
    await run(env, 'INSERT INTO rate_events (key) VALUES (?)', key);
    fail(401, "That username or password isn't right");
  }
  if (body.role && body.role !== u.role) fail(403, u.role === 'parent' ? "This is a parent account — tap I'M A PARENT" : "This is a kid account — tap I'M A KID");
  await run(env, 'DELETE FROM rate_events WHERE key = ?', key);
  const cookie = await createSession(env, request, u.id);
  return json({ ok: true, role: u.role }, { headers: { 'set-cookie': cookie } });
}, { auth: false });

add('POST', '/api/logout', async ({ env, request }) => {
  return json({ ok: true }, { headers: { 'set-cookie': await destroySession(env, request) } });
}, { auth: false });

// Parent account recovery with the one-time code shown at signup.
add('POST', '/api/recover', async ({ env, request, body }) => {
  const username = str(body.username, 30).toLowerCase();
  await rateLimit(env, 'recover:' + username, 5, 3600e3, 'Too many tries. Wait an hour.');
  const u = await first(env, `SELECT id, recovery_hash, recovery_salt FROM users WHERE username = ? AND role = 'parent'`, username);
  const code = str(body.recovery_code, 20).toUpperCase();
  if (!u || !u.recovery_hash || !(await verifyPassword(code, u.recovery_hash, u.recovery_salt))) fail(401, "That recovery code doesn't match");
  const pw = String(body.new_password || '');
  if (pw.length < 8) fail(400, 'New password needs at least 8 characters');
  const { hash, salt } = await hashPassword(pw);
  const recovery = randomRecoveryCode();
  const rec = await hashPassword(recovery);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, recovery_hash = ?, recovery_salt = ? WHERE id = ?').bind(hash, salt, rec.hash, rec.salt, u.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id),
  ]);
  const cookie = await createSession(env, request, u.id);
  return json({ ok: true, recovery_code: recovery }, { headers: { 'set-cookie': cookie } });
}, { auth: false });

async function badgeCounts(env, user) {
  const n = await first(env, 'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', user.id);
  let messages = 0, approvals = 0, rides = 0;
  if (user.role === 'kid') {
    const m = await first(env,
      `SELECT COUNT(*) AS n FROM messages m JOIN friendships f ON f.id = m.friendship_id
         LEFT JOIN chat_reads r ON r.friendship_id = f.id AND r.user_id = ?
        WHERE f.status = 'active' AND (f.kid_a = ? OR f.kid_b = ?) AND m.sender_id != ? AND m.id > COALESCE(r.last_read_id, 0)`,
      user.id, user.id, user.id, user.id);
    messages = m.n;
  } else {
    const a = await first(env,
      `SELECT (SELECT COUNT(*) FROM friendships f JOIN users a ON a.id = f.kid_a JOIN users b ON b.id = f.kid_b
                WHERE f.status = 'awaiting_parent' AND ((a.family_id = ?1 AND f.parent_ok_a = 0) OR (b.family_id = ?1 AND f.parent_ok_b = 0)))
            + (SELECT COUNT(*) FROM plan_members pm JOIN plans p ON p.id = pm.plan_id JOIN users k ON k.id = pm.kid_id
                WHERE k.family_id = ?1 AND pm.parent_status = 'waiting' AND p.cancelled = 0 AND p.starts_at > ?2
                  AND NOT EXISTS (SELECT 1 FROM plan_members d WHERE d.plan_id = p.id AND d.parent_status = 'declined')) AS n`,
      user.family_id, ago(3600e3));
    approvals = a.n;
    const rd = await first(env,
      `SELECT COUNT(*) AS n FROM rides r WHERE r.status = 'open' AND r.starts_at > ?2
          AND EXISTS (SELECT 1 FROM ride_riders x JOIN users k ON k.id = x.kid_id WHERE x.ride_id = r.id AND k.family_id = ?1)`,
      user.family_id, ago(15 * 60e3));
    rides = rd.n;
  }
  const fm = await first(env, 'SELECT COUNT(*) AS n FROM family_messages WHERE to_id = ? AND read_at IS NULL', user.id);
  // Newest notification — the app plays a sound when this id goes up.
  const latest = await first(env, 'SELECT id, type FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1', user.id);
  return { notifications: n.n, messages, approvals, rides, family_messages: fm.n, latest_id: latest?.id || 0, latest_type: latest?.type || null };
}

add('GET', '/api/me', async ({ env, user }) => {
  const family = await all(env,
    `SELECT id, role, display_name, username, avatar, friend_code, phone, sms_opt_in, chat_enabled, onboarded
       FROM users WHERE family_id = ? ORDER BY role DESC, display_name`, user.family_id);
  // Kids only see what they need about their parents (name, avatar, phone for "Text parent").
  const visible = user.role === 'kid'
    ? family.filter((u) => u.role === 'parent' || u.id === user.id).map((u) => u.role === 'parent'
      ? { id: u.id, role: u.role, display_name: u.display_name, avatar: u.avatar, phone: u.phone } : u)
    : family;
  let prefs = {};
  try { prefs = JSON.parse(user.notify_prefs || '{}'); } catch { /* */ }
  const last = user.role === 'kid' ? await first(env, 'SELECT created_at FROM ready_events WHERE kid_id = ? ORDER BY id DESC LIMIT 1', user.id) : null;
  return json({
    user: { ...user, notify_prefs: prefs, last_ready_at: last?.created_at || null },
    family: visible, badges: await badgeCounts(env, user), avatars: AVATARS, sms_live: smsConfigured(env),
  });
});

add('GET', '/api/badges', async ({ env, user }) => json(await badgeCounts(env, user)));

add('PATCH', '/api/me', async ({ env, user, body }) => {
  const sets = [], vals = [];
  if (body.display_name !== undefined) {
    const n = str(body.display_name, 24);
    if (!n) fail(400, "Display name can't be empty");
    if (moderate(n)) fail(400, 'Pick a different display name');
    sets.push('display_name = ?'); vals.push(n);
  }
  if (body.avatar !== undefined) { if (!AVATARS.includes(body.avatar)) fail(400, 'Pick an avatar from the list'); sets.push('avatar = ?'); vals.push(body.avatar); }
  if (body.onboarded !== undefined) { sets.push('onboarded = ?'); vals.push(bool(body.onboarded)); }
  if (body.theme !== undefined) { if (!THEMES.includes(body.theme)) fail(400, 'Pick a style from the list'); sets.push('theme = ?'); vals.push(body.theme); }
  if (body.notify_prefs && typeof body.notify_prefs === 'object') {
    const p = {};
    for (const k of ['messages', 'friends', 'plans', 'ready', 'checkins']) if (k in body.notify_prefs) p[k] = !!body.notify_prefs[k];
    sets.push('notify_prefs = ?'); vals.push(JSON.stringify(p));
  }
  if (user.role === 'parent') {
    if (body.phone !== undefined) {
      const p = body.phone ? normalizePhone(body.phone) : null;
      if (body.phone && !p) fail(400, "That phone number doesn't look right");
      sets.push('phone = ?'); vals.push(p);
      if (!p) sets.push('sms_opt_in = 0');
    }
    if (body.sms_opt_in !== undefined) { sets.push('sms_opt_in = ?'); vals.push(bool(body.sms_opt_in)); }
  }
  if (body.new_password) {
    const me = await first(env, 'SELECT pass_hash, pass_salt FROM users WHERE id = ?', user.id);
    if (!(await verifyPassword(String(body.current_password || ''), me.pass_hash, me.pass_salt))) fail(401, 'Current password is wrong');
    const min = user.role === 'parent' ? 8 : 4;
    if (String(body.new_password).length < min) fail(400, `New password needs at least ${min} characters`);
    const { hash, salt } = await hashPassword(String(body.new_password));
    sets.push('pass_hash = ?', 'pass_salt = ?'); vals.push(hash, salt);
  }
  if (sets.length) await run(env, `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...vals, user.id);
  return json({ ok: true });
});

add('POST', '/api/me/friend-code', async ({ env, user }) => {
  await rateLimit(env, 'newcode:' + user.id, 5, 864e5, 'You can only get a new code a few times a day.');
  const code = await newFriendCode(env);
  await run(env, 'UPDATE users SET friend_code = ? WHERE id = ?', code, user.id);
  return json({ ok: true, friend_code: code });
}, { role: 'kid' });

// ---- parents manage their family
add('POST', '/api/kids', async ({ env, user, body }) => {
  if (!body.consent) fail(400, 'Please confirm you are the parent or guardian and agree for your child to use Let\'s Hang');
  const name = str(body.display_name, 24);
  const username = str(body.username, 30).toLowerCase();
  const pin = String(body.pin || '');
  if (!name) fail(400, 'Enter a display name');
  if (moderate(name)) fail(400, 'Pick a different display name');
  if (!USERNAME_RE.test(username)) fail(400, 'Username: 3–30 letters, numbers, dots or dashes');
  if (pin.length < 4) fail(400, 'PIN/password needs at least 4 characters');
  if (await first(env, 'SELECT id FROM users WHERE username = ?', username)) fail(409, 'That username is taken');
  const avatar = AVATARS.includes(body.avatar) ? body.avatar : AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const { hash, salt } = await hashPassword(pin);
  const code = await newFriendCode(env);
  const row = await first(env,
    `INSERT INTO users (family_id, role, display_name, username, pass_hash, pass_salt, avatar, friend_code, consent_at, consent_by)
     VALUES (?, 'kid', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    user.family_id, name, username, hash, salt, avatar, code, nowIso(), user.id);
  return json({ ok: true, id: row.id, friend_code: code });
}, { role: 'parent' });

add('POST', '/api/parents', async ({ env, user, body }) => {
  const name = str(body.display_name, 40);
  const username = str(body.username, 30).toLowerCase();
  const pw = String(body.password || '');
  if (!name) fail(400, 'Enter a name');
  if (!USERNAME_RE.test(username)) fail(400, 'Username: 3–30 letters, numbers, dots or dashes');
  if (pw.length < 8) fail(400, 'Password needs at least 8 characters');
  if (await first(env, 'SELECT id FROM users WHERE username = ?', username)) fail(409, 'That username is taken');
  const { hash, salt } = await hashPassword(pw);
  const recovery = randomRecoveryCode();
  const rec = await hashPassword(recovery);
  await run(env,
    `INSERT INTO users (family_id, role, display_name, username, pass_hash, pass_salt, avatar, onboarded, recovery_hash, recovery_salt)
     VALUES (?, 'parent', ?, ?, ?, ?, 'crown', 1, ?, ?)`, user.family_id, name, username, hash, salt, rec.hash, rec.salt);
  return json({ ok: true, recovery_code: recovery });
}, { role: 'parent' });

add('PATCH', '/api/kids/:id', async ({ env, user, params, body }) => {
  const kid = await ownKid(env, user, params.id);
  const sets = [], vals = [];
  if (body.display_name !== undefined) { const n = str(body.display_name, 24); if (!n || moderate(n)) fail(400, 'Pick a different display name'); sets.push('display_name = ?'); vals.push(n); }
  if (body.avatar !== undefined) { if (!AVATARS.includes(body.avatar)) fail(400, 'Pick an avatar'); sets.push('avatar = ?'); vals.push(body.avatar); }
  if (body.chat_enabled !== undefined) { sets.push('chat_enabled = ?'); vals.push(bool(body.chat_enabled)); }
  if (body.pin) {
    if (String(body.pin).length < 4) fail(400, 'PIN needs at least 4 characters');
    const { hash, salt } = await hashPassword(String(body.pin));
    sets.push('pass_hash = ?', 'pass_salt = ?'); vals.push(hash, salt);
  }
  if (sets.length) await run(env, `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...vals, kid.id);
  if (body.pin) await run(env, 'DELETE FROM sessions WHERE user_id = ?', kid.id);
  return json({ ok: true });
}, { role: 'parent' });

async function deleteUserData(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM notifications WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM chat_reads WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM messages WHERE friendship_id IN (SELECT id FROM friendships WHERE kid_a = ?1 OR kid_b = ?1)').bind(id),
    env.DB.prepare('DELETE FROM chat_reads WHERE friendship_id IN (SELECT id FROM friendships WHERE kid_a = ?1 OR kid_b = ?1)').bind(id),
    env.DB.prepare('DELETE FROM friendships WHERE kid_a = ?1 OR kid_b = ?1').bind(id),
    env.DB.prepare('DELETE FROM blocks WHERE blocker_id = ?1 OR blocked_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM reports WHERE reporter_id = ?').bind(id),
    env.DB.prepare('DELETE FROM plan_members WHERE kid_id = ?').bind(id),
    env.DB.prepare('DELETE FROM plan_members WHERE plan_id IN (SELECT id FROM plans WHERE proposer_id = ?)').bind(id),
    env.DB.prepare('DELETE FROM plans WHERE proposer_id = ?').bind(id),
    env.DB.prepare('DELETE FROM ready_events WHERE kid_id = ?').bind(id),
    env.DB.prepare('DELETE FROM checkins WHERE kid_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pickups WHERE kid_id = ?').bind(id),
    env.DB.prepare('UPDATE pickups SET from_user = NULL WHERE from_user = ?').bind(id),
    env.DB.prepare('DELETE FROM family_messages WHERE from_id = ?1 OR to_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
}

add('DELETE', '/api/kids/:id', async ({ env, user, params }) => {
  const kid = await ownKid(env, user, params.id);
  await deleteUserData(env, kid.id);
  return json({ ok: true });
}, { role: 'parent' });

add('DELETE', '/api/family', async ({ env, user, body }) => {
  if (body.confirm !== 'DELETE') fail(400, 'Type DELETE to confirm');
  const members = await all(env, 'SELECT id FROM users WHERE family_id = ?', user.family_id);
  for (const m of members) await deleteUserData(env, m.id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM checkins WHERE house_id IN (SELECT id FROM houses WHERE family_id = ?)').bind(user.family_id),
    env.DB.prepare('UPDATE pickups SET house_id = NULL WHERE house_id IN (SELECT id FROM houses WHERE family_id = ?)').bind(user.family_id),
    env.DB.prepare('DELETE FROM houses WHERE family_id = ?').bind(user.family_id),
    env.DB.prepare('DELETE FROM families WHERE id = ?').bind(user.family_id),
  ]);
  return json({ ok: true }, { headers: { 'set-cookie': 'lh_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' } });
}, { role: 'parent' });

// ================================================================ friends
async function friendsView(env, kidId) {
  const rows = await all(env,
    `SELECT f.id, f.status, f.requested_by, f.parent_ok_a, f.parent_ok_b, f.kid_a, f.kid_b, f.updated_at,
            o.id AS other_id, o.display_name, o.avatar
       FROM friendships f JOIN users o ON o.id = CASE WHEN f.kid_a = ?1 THEN f.kid_b ELSE f.kid_a END
      WHERE (f.kid_a = ?1 OR f.kid_b = ?1) AND f.status IN ('pending','awaiting_parent','active')
      ORDER BY o.display_name`, kidId);
  const out = { friends: [], incoming: [], outgoing: [], awaiting_parent: [] };
  for (const r of rows) {
    const item = { friendship_id: r.id, kid: { id: r.other_id, display_name: r.display_name, avatar: r.avatar }, since: r.updated_at };
    if (r.status === 'active') out.friends.push(item);
    else if (r.status === 'awaiting_parent') out.awaiting_parent.push(item);
    else if (r.requested_by === kidId) out.outgoing.push(item);
    else out.incoming.push(item);
  }
  out.blocked = await all(env,
    `SELECT u.id, u.display_name, u.avatar FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ?`, kidId);
  return out;
}

add('GET', '/api/friends', async ({ env, user, url }) => {
  const kid = user.role === 'kid' ? user : await ownKid(env, user, url.searchParams.get('kid_id'));
  return json(await friendsView(env, kid.id));
});

add('POST', '/api/friends/request', async ({ env, ctx, user, body }) => {
  await rateLimit(env, 'friendcode:' + user.id, 10, 3600e3, 'Too many tries. Wait a bit before adding more friends.');
  const code = str(body.code, 12).toUpperCase().replace(/^HANG(?!-)/, 'HANG-');
  const other = await first(env, `SELECT id, family_id, display_name, notify_prefs FROM users WHERE friend_code = ? AND role = 'kid'`, code);
  if (!other) fail(404, "We couldn't find that friend code. Check it and try again.");
  if (other.id === user.id) fail(400, "That's your own code!");
  if (await isBlocked(env, user.id, other.id)) fail(404, "We couldn't find that friend code. Check it and try again.");
  const [a, b] = pair(user.id, other.id);
  const existing = await first(env, 'SELECT id, status FROM friendships WHERE kid_a = ? AND kid_b = ?', a, b);
  if (existing && ['pending', 'awaiting_parent', 'active'].includes(existing.status)) {
    fail(409, existing.status === 'active' ? "You're already friends!" : 'There is already a request between you two.');
  }
  if (existing) {
    await run(env, `UPDATE friendships SET status = 'pending', requested_by = ?, parent_ok_a = 0, parent_ok_b = 0, updated_at = ? WHERE id = ?`, user.id, nowIso(), existing.id);
  } else {
    await run(env, `INSERT INTO friendships (kid_a, kid_b, requested_by, status) VALUES (?, ?, ?, 'pending')`, a, b, user.id);
  }
  await notify(env, ctx, [other], { type: 'friend_request', title: `${user.display_name} sent you a friend request`, link: 'friends' });
  return json({ ok: true, to: { display_name: other.display_name } });
}, { role: 'kid' });

add('POST', '/api/friends/:id/respond', async ({ env, ctx, user, params, body }) => {
  const f = await friendshipFor(env, user, params.id);
  if (f.status !== 'pending' || f.requested_by === user.id) fail(400, 'Nothing to respond to');
  if (!body.accept) {
    await run(env, `UPDATE friendships SET status = 'declined', updated_at = ? WHERE id = ?`, nowIso(), f.id);
    return json({ ok: true, status: 'declined' });
  }
  await run(env, `UPDATE friendships SET status = 'awaiting_parent', updated_at = ? WHERE id = ?`, nowIso(), f.id);
  // Each kid's own parents are asked to approve (siblings in one family get one request).
  for (const [fam, kidName, otherName] of [[f.fam_a, f.name_a, f.name_b], [f.fam_b, f.name_b, f.name_a]]) {
    const parents = await parentsOf(env, fam);
    await notify(env, ctx, parents, {
      type: 'friend_approval', title: `Approve ${firstName(kidName)} + ${firstName(otherName)}?`,
      body: `${firstName(kidName)} wants to be friends with ${otherName} on Let's Hang.`, link: 'approvals', dedupe: `fa:${f.id}:${fam}`,
    }, { sms: true });
  }
  const requester = await usersById(env, [f.requested_by]);
  await notify(env, ctx, requester, { type: 'friend_accepted', title: `${user.display_name} accepted your request`, body: 'Waiting for parents to approve.', link: 'friends' });
  return json({ ok: true, status: 'awaiting_parent' });
}, { role: 'kid' });

add('POST', '/api/friends/:id/approve', async ({ env, ctx, user, params, body }) => {
  const f = await friendshipFor(env, user, params.id);
  if (f.status !== 'awaiting_parent') fail(400, 'This request is not waiting for approval');
  if (!body.approve) {
    await run(env, `UPDATE friendships SET status = 'declined', updated_at = ? WHERE id = ?`, nowIso(), f.id);
    const kids = await usersById(env, [f.kid_a, f.kid_b]);
    await notify(env, ctx, kids, { type: 'friend_approval', title: 'A friend request was not approved', body: `${f.name_a} + ${f.name_b}`, link: 'friends' });
    return json({ ok: true, status: 'declined' });
  }
  const sideA = f.fam_a === user.family_id, sideB = f.fam_b === user.family_id;
  const okA = sideA ? 1 : f.parent_ok_a, okB = sideB ? 1 : f.parent_ok_b;
  const status = okA && okB ? 'active' : 'awaiting_parent';
  await run(env, 'UPDATE friendships SET parent_ok_a = ?, parent_ok_b = ?, status = ?, updated_at = ? WHERE id = ?', okA, okB, status, nowIso(), f.id);
  if (status === 'active') {
    const [ka] = await usersById(env, [f.kid_a]);
    const [kb] = await usersById(env, [f.kid_b]);
    await notify(env, ctx, [ka], { type: 'friend_approval', title: `You and ${f.name_b} are friends now! 🎉`, body: 'You can chat and make plans.', link: `chat:${f.id}` });
    await notify(env, ctx, [kb], { type: 'friend_approval', title: `You and ${f.name_a} are friends now! 🎉`, body: 'You can chat and make plans.', link: `chat:${f.id}` });
  }
  return json({ ok: true, status });
}, { role: 'parent' });

add('DELETE', '/api/friends/:id', async ({ env, user, params }) => {
  const f = await friendshipFor(env, user, params.id);
  await run(env, `UPDATE friendships SET status = 'removed', updated_at = ? WHERE id = ?`, nowIso(), f.id);
  return json({ ok: true });
});

add('POST', '/api/blocks', async ({ env, user, body }) => {
  const otherId = toInt(body.user_id);
  const other = await kidRow(env, otherId);
  if (!other || other.id === user.id) fail(404, 'Not found');
  await run(env, 'INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', user.id, other.id);
  const [a, b] = pair(user.id, other.id);
  await run(env, `UPDATE friendships SET status = 'removed', updated_at = ? WHERE kid_a = ? AND kid_b = ?`, nowIso(), a, b);
  return json({ ok: true });
}, { role: 'kid' });

add('DELETE', '/api/blocks/:id', async ({ env, user, params }) => {
  await run(env, 'DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', user.id, toInt(params.id));
  return json({ ok: true });
}, { role: 'kid' });

add('POST', '/api/reports', async ({ env, ctx, user, body }) => {
  const other = await kidRow(env, toInt(body.user_id));
  if (!other) fail(404, 'Not found');
  const reasons = ['mean', 'bullying', 'inappropriate', 'personal_info', 'stranger', 'other'];
  const reason = reasons.includes(body.reason) ? body.reason : 'other';
  await rateLimit(env, 'report:' + user.id, 20, 864e5);
  let messageId = toInt(body.message_id);
  if (messageId) {
    const m = await first(env, `SELECT m.id FROM messages m JOIN friendships f ON f.id = m.friendship_id WHERE m.id = ? AND (f.kid_a = ?2 OR f.kid_b = ?2)`, messageId, user.id);
    if (!m) messageId = null;
  }
  await run(env, 'INSERT INTO reports (reporter_id, reported_id, message_id, reason, details) VALUES (?, ?, ?, ?, ?)',
    user.id, other.id, messageId, reason, str(body.details, 500) || null);
  const label = { mean: 'being mean', bullying: 'bullying', inappropriate: 'something inappropriate', personal_info: 'asking for personal info', stranger: "someone they don't know", other: 'a problem' }[reason];
  const myParents = await parentsOf(env, user.family_id);
  await notify(env, ctx, myParents, { type: 'safety', title: `${firstName(user.display_name)} reported ${other.display_name}`, body: `Reason: ${label}. Check in with them.`, link: `kid:${user.id}` }, { sms: true });
  const theirParents = await parentsOf(env, other.family_id);
  await notify(env, ctx, theirParents, { type: 'safety', title: `Safety report about ${firstName(other.display_name)}`, body: `Another kid reported ${label}. Please check in with your child.`, link: `kid:${other.id}` });
  return json({ ok: true });
}, { role: 'kid' });

// ================================================================ chat (kid ↔ approved friend)
async function chatList(env, kidId) {
  return all(env,
    `SELECT f.id AS friendship_id, o.id AS other_id, o.display_name, o.avatar,
            (SELECT body FROM messages WHERE friendship_id = f.id ORDER BY id DESC LIMIT 1) AS last_body,
            (SELECT sender_id FROM messages WHERE friendship_id = f.id ORDER BY id DESC LIMIT 1) AS last_sender,
            (SELECT created_at FROM messages WHERE friendship_id = f.id ORDER BY id DESC LIMIT 1) AS last_at,
            (SELECT COUNT(*) FROM messages m WHERE m.friendship_id = f.id AND m.sender_id != ?1
                AND m.id > COALESCE((SELECT last_read_id FROM chat_reads WHERE friendship_id = f.id AND user_id = ?1), 0)) AS unread
       FROM friendships f JOIN users o ON o.id = CASE WHEN f.kid_a = ?1 THEN f.kid_b ELSE f.kid_a END
      WHERE (f.kid_a = ?1 OR f.kid_b = ?1) AND f.status = 'active'
      ORDER BY COALESCE(last_at, f.updated_at) DESC`, kidId);
}

add('GET', '/api/chats', async ({ env, user, url }) => {
  const kid = user.role === 'kid' ? user : await ownKid(env, user, url.searchParams.get('kid_id'));
  return json({ chats: await chatList(env, kid.id), read_only: user.role === 'parent' });
});

add('GET', '/api/chats/:id/messages', async ({ env, user, params, url }) => {
  const f = await friendshipFor(env, user, params.id);
  const after = toInt(url.searchParams.get('after')) || 0;
  const rows = after
    ? await all(env, 'SELECT id, sender_id, body, created_at FROM messages WHERE friendship_id = ? AND id > ? ORDER BY id LIMIT 200', f.id, after)
    : (await all(env, 'SELECT id, sender_id, body, created_at FROM messages WHERE friendship_id = ? ORDER BY id DESC LIMIT 150', f.id)).reverse();
  if (user.role === 'kid' && rows.length) {
    await run(env, `INSERT INTO chat_reads (friendship_id, user_id, last_read_id) VALUES (?, ?, ?)
      ON CONFLICT(friendship_id, user_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`, f.id, user.id, rows[rows.length - 1].id);
    await run(env, `UPDATE notifications SET read_at = ? WHERE user_id = ? AND dedupe_key = ? AND read_at IS NULL`, nowIso(), user.id, `msg:${f.id}`);
  }
  const people = { [f.kid_a]: { id: f.kid_a, display_name: f.name_a, avatar: f.av_a }, [f.kid_b]: { id: f.kid_b, display_name: f.name_b, avatar: f.av_b } };
  return json({ messages: rows, people, status: f.status, read_only: user.role === 'parent' || f.status !== 'active' });
});

add('POST', '/api/chats/:id/messages', async ({ env, ctx, user, params, body }) => {
  const f = await friendshipFor(env, user, params.id);
  if (f.status !== 'active') fail(403, 'You can only chat with approved friends');
  if (!user.chat_enabled) fail(403, 'Chat is paused on your account. Talk to your parent.');
  const otherId = f.kid_a === user.id ? f.kid_b : f.kid_a;
  if (await isBlocked(env, user.id, otherId)) fail(403, "You can't message this person");
  const text = str(body.body, 500);
  if (!text) fail(400, 'Type a message');
  const problem = moderate(text);
  if (problem) fail(422, problem);
  await rateLimit(env, 'msg:' + user.id, 30, 60e3, "Whoa, that's a lot of messages! Take a breather.");
  const row = await first(env, 'INSERT INTO messages (friendship_id, sender_id, body) VALUES (?, ?, ?) RETURNING id, created_at', f.id, user.id, text);
  await run(env, `INSERT INTO chat_reads (friendship_id, user_id, last_read_id) VALUES (?, ?, ?)
    ON CONFLICT(friendship_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`, f.id, user.id, row.id);
  const other = await usersById(env, [otherId]);
  await notify(env, ctx, other, { type: 'message', title: `New message from ${user.display_name}`, link: `chat:${f.id}`, dedupe: `msg:${f.id}` });
  if (NEEDS_CARE.test(text)) {
    const parents = await parentsOf(env, user.family_id);
    await notify(env, ctx, parents, { type: 'safety', title: `Please check in with ${firstName(user.display_name)}`, body: 'A recent chat message may mean they need support.', link: `kid:${user.id}` }, { sms: true });
  }
  return json({ ok: true, id: row.id, created_at: row.created_at });
}, { role: 'kid' });

// ================================================================ parent ↔ kid messages
add('GET', '/api/family-chat/:id', async ({ env, user, params }) => {
  const other = await first(env, 'SELECT id, role, family_id, display_name, avatar, phone FROM users WHERE id = ?', toInt(params.id));
  if (!other || other.family_id !== user.family_id || other.role === user.role) fail(404, 'Not found');
  const rows = await all(env,
    `SELECT id, from_id, to_id, body, created_at FROM family_messages
      WHERE family_id = ? AND ((from_id = ?2 AND to_id = ?3) OR (from_id = ?3 AND to_id = ?2)) ORDER BY id DESC LIMIT 100`,
    user.family_id, user.id, other.id);
  await run(env, 'UPDATE family_messages SET read_at = ? WHERE to_id = ? AND from_id = ? AND read_at IS NULL', nowIso(), user.id, other.id);
  return json({ messages: rows.reverse(), other: { id: other.id, display_name: other.display_name, avatar: other.avatar, phone: user.role === 'kid' || other.role === 'kid' ? other.phone : null } });
});

add('POST', '/api/family-chat/:id', async ({ env, ctx, user, params, body }) => {
  const other = await first(env, 'SELECT id, role, family_id, display_name, phone, sms_opt_in, notify_prefs FROM users WHERE id = ?', toInt(params.id));
  if (!other || other.family_id !== user.family_id || other.role === user.role) fail(404, 'Not found');
  const text = str(body.body, 500);
  if (!text) fail(400, 'Type a message');
  await rateLimit(env, 'fmsg:' + user.id, 30, 60e3);
  await run(env, 'INSERT INTO family_messages (family_id, from_id, to_id, body) VALUES (?, ?, ?, ?)', user.family_id, user.id, other.id, text);
  await notify(env, ctx, [other], { type: 'parent_message', title: `Message from ${user.display_name}`, body: text.slice(0, 80), link: `family:${user.id}` }, { sms: other.role === 'parent' });
  return json({ ok: true });
});

// ================================================================ plans ("Made a Plan") + parent approval
function planStatus(p, members) {
  if (p.cancelled) return 'cancelled';
  if (members.some((m) => m.parent_status === 'declined')) return 'declined';
  if (members.every((m) => m.parent_status === 'approved')) return 'approved';
  return 'waiting';
}

async function plansFor(env, user, kidIds) {
  if (!kidIds.length) return [];
  const ph = kidIds.map(() => '?').join(',');
  const plans = await all(env,
    `SELECT DISTINCT p.id, p.proposer_id, p.title, p.starts_at, p.ends_at, p.location, p.details, p.cancelled, p.created_at
       FROM plans p JOIN plan_members pm ON pm.plan_id = p.id
      WHERE pm.kid_id IN (${ph}) AND p.starts_at > ? ORDER BY p.starts_at LIMIT 200`, ...kidIds, ago(7 * 864e5));
  if (!plans.length) return [];
  const members = await all(env,
    `SELECT pm.plan_id, pm.kid_id, pm.parent_status, u.display_name, u.avatar, u.family_id
       FROM plan_members pm JOIN users u ON u.id = pm.kid_id WHERE pm.plan_id IN (${plans.map(() => '?').join(',')})`, ...plans.map((p) => p.id));
  return plans.map((p) => {
    const ms = members.filter((m) => m.plan_id === p.id);
    return {
      ...p, status: planStatus(p, ms),
      members: ms.map((m) => ({ id: m.kid_id, display_name: m.display_name, avatar: m.avatar, parent_status: m.parent_status, my_family: m.family_id === user.family_id })),
    };
  });
}

add('GET', '/api/plans', async ({ env, user }) => {
  const kidIds = user.role === 'kid' ? [user.id]
    : (await all(env, `SELECT id FROM users WHERE family_id = ? AND role = 'kid'`, user.family_id)).map((k) => k.id);
  return json({ plans: await plansFor(env, user, kidIds) });
});

add('POST', '/api/plans', async ({ env, ctx, user, body }) => {
  const friendIds = [...new Set((Array.isArray(body.friend_ids) ? body.friend_ids : [body.friend_id]).map(toInt).filter(Boolean))].slice(0, 6);
  if (!friendIds.length) fail(400, 'Pick at least one friend');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ''))) fail(400, 'Pick a date');
  if (!/^\d{2}:\d{2}$/.test(String(body.time || ''))) fail(400, 'Pick a time');
  const starts = new Date(body.starts_at || `${body.date}T${body.time}`);
  if (isNaN(starts)) fail(400, 'Pick a date and time');
  if (starts < new Date(Date.now() - 5 * 60e3)) fail(400, "That time already passed — pick a time that's coming up");
  for (const fid of friendIds) {
    const [a, b] = pair(user.id, fid);
    const ok = await first(env, `SELECT id FROM friendships WHERE kid_a = ? AND kid_b = ? AND status = 'active'`, a, b);
    if (!ok) fail(403, 'You can only make plans with approved friends');
  }
  await rateLimit(env, 'plan:' + user.id, 20, 864e5, "That's a lot of plans for one day!");
  const title = str(body.title, 60) || 'Hang out';
  if (moderate(title) || (body.details && moderate(String(body.details)))) fail(422, "For safety, don't put phone numbers, emails or links in plans.");
  const ends = body.ends_at ? new Date(body.ends_at) : null;
  const plan = await first(env,
    'INSERT INTO plans (proposer_id, title, starts_at, ends_at, location, details) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    user.id, title, starts.toISOString(), ends && !isNaN(ends) && ends > starts ? ends.toISOString() : null,
    str(body.location, 80) || null, str(body.details, 300) || null);
  const kidIds = [user.id, ...friendIds];
  await env.DB.batch(kidIds.map((k) => env.DB.prepare('INSERT INTO plan_members (plan_id, kid_id) VALUES (?, ?)').bind(plan.id, k)));

  const kids = await usersById(env, kidIds);
  const nameOf = (id) => kids.find((k) => k.id === id)?.display_name || 'a friend';
  const others = friendIds.map(nameOf).join(', ');
  const whenText = when(env, starts.toISOString());
  for (const k of kids) {
    const parents = await parentsOf(env, k.family_id);
    const withWho = k.id === user.id ? others : [user.display_name, ...friendIds.filter((x) => x !== k.id).map(nameOf)].join(', ');
    await notify(env, ctx, parents, {
      type: 'plan_approval', title: `Approve a plan for ${firstName(k.display_name)}?`,
      body: `"${title}" with ${withWho} · ${whenText}`, link: 'approvals',
    }, { sms: true });
  }
  await notify(env, ctx, kids.filter((k) => k.id !== user.id), {
    type: 'plan_update', title: `${user.display_name} made a plan with you!`, body: `"${title}" · ${whenText} · waiting for parents`, link: 'plans',
  });
  return json({ ok: true, id: plan.id, status: 'waiting' });
}, { role: 'kid' });

add('POST', '/api/plans/:id/decision', async ({ env, ctx, user, params, body }) => {
  const planId = toInt(params.id);
  const kid = await ownKid(env, user, body.kid_id);
  const plan = await first(env, 'SELECT * FROM plans WHERE id = ?', planId);
  if (!plan) fail(404, 'Plan not found');
  const member = await first(env, 'SELECT * FROM plan_members WHERE plan_id = ? AND kid_id = ?', planId, kid.id);
  if (!member) fail(404, 'Your kid is not in this plan');
  if (plan.cancelled) fail(400, 'This plan was cancelled');
  const status = body.approve ? 'approved' : 'declined';
  await run(env, 'UPDATE plan_members SET parent_status = ?, decided_by = ?, decided_at = ? WHERE plan_id = ? AND kid_id = ?', status, user.id, nowIso(), planId, kid.id);
  const members = await all(env, 'SELECT kid_id, parent_status FROM plan_members WHERE plan_id = ?', planId);
  const overall = planStatus(plan, members);
  if (overall !== 'waiting') {
    const kids = await usersById(env, members.map((m) => m.kid_id));
    await notify(env, ctx, kids, {
      type: 'plan_update',
      title: overall === 'approved' ? `Plan approved! "${plan.title}" ✅` : `Plan not approved: "${plan.title}"`,
      body: when(env, plan.starts_at), link: 'plans', dedupe: `plan:${planId}:${overall}`,
    });
  }
  return json({ ok: true, status: overall });
}, { role: 'parent' });

add('POST', '/api/plans/:id/cancel', async ({ env, ctx, user, params }) => {
  const plan = await first(env, 'SELECT p.*, u.family_id FROM plans p JOIN users u ON u.id = p.proposer_id WHERE p.id = ?', toInt(params.id));
  if (!plan) fail(404, 'Plan not found');
  const allowed = user.role === 'kid' ? plan.proposer_id === user.id : plan.family_id === user.family_id;
  if (!allowed) fail(403, 'Only the kid who made the plan (or their parent) can cancel it');
  await run(env, 'UPDATE plans SET cancelled = 1 WHERE id = ?', plan.id);
  const members = await all(env, 'SELECT kid_id FROM plan_members WHERE plan_id = ?', plan.id);
  const kids = await usersById(env, members.map((m) => m.kid_id).filter((id) => id !== user.id));
  await notify(env, ctx, kids, { type: 'plan_update', title: `Plan cancelled: "${plan.title}"`, body: when(env, plan.starts_at), link: 'plans' });
  return json({ ok: true });
});

// ================================================================ I'm Ready!
add('POST', '/api/ready', async ({ env, ctx, user, body }) => {
  const last = await first(env, 'SELECT created_at FROM ready_events WHERE kid_id = ? ORDER BY id DESC LIMIT 1', user.id);
  if (last && new Date(last.created_at) > new Date(Date.now() - 3 * 60e3)) {
    return json({ ok: true, already: true, at: last.created_at }); // no repeat notification within 3 minutes
  }
  const note = str(body.note, 120) || null;
  const row = await first(env, 'INSERT INTO ready_events (kid_id, note) VALUES (?, ?) RETURNING created_at', user.id, note);
  const parents = await parentsOf(env, user.family_id);
  await notify(env, ctx, parents, {
    type: 'ready', title: `${firstName(user.display_name)} is ready! 🙌`, body: note || 'Tap to message them.', link: `family:${user.id}`,
  }, { sms: true });
  return json({ ok: true, already: false, at: row.created_at, told: parents.length });
}, { role: 'kid' });

// ================================================================ parent dashboard + approvals
add('GET', '/api/dashboard', async ({ env, user }) => {
  const kids = await all(env,
    `SELECT u.id, u.display_name, u.username, u.avatar, u.friend_code, u.chat_enabled,
            (SELECT created_at FROM ready_events WHERE kid_id = u.id ORDER BY id DESC LIMIT 1) AS last_ready_at,
            (SELECT COUNT(*) FROM friendships f WHERE (f.kid_a = u.id OR f.kid_b = u.id) AND f.status = 'active') AS friends,
            (SELECT COUNT(*) FROM reports r WHERE r.reporter_id = u.id OR r.reported_id = u.id) AS reports,
            (SELECT COUNT(*) FROM family_messages fm WHERE fm.from_id = u.id AND fm.to_id = ? AND fm.read_at IS NULL) AS unread_from
       FROM users u WHERE u.family_id = ? AND u.role = 'kid' ORDER BY u.display_name`, user.id, user.family_id);

  const friendApprovals = await all(env,
    `SELECT f.id, f.parent_ok_a, f.parent_ok_b, f.created_at,
            a.id AS a_id, a.display_name AS a_name, a.avatar AS a_avatar, a.family_id AS a_fam,
            b.id AS b_id, b.display_name AS b_name, b.avatar AS b_avatar, b.family_id AS b_fam
       FROM friendships f JOIN users a ON a.id = f.kid_a JOIN users b ON b.id = f.kid_b
      WHERE f.status = 'awaiting_parent' AND ((a.family_id = ?1 AND f.parent_ok_a = 0) OR (b.family_id = ?1 AND f.parent_ok_b = 0))`, user.family_id);
  const friends = friendApprovals.map((r) => {
    const mineIsA = r.a_fam === user.family_id;
    return {
      friendship_id: r.id, created_at: r.created_at,
      kid: mineIsA ? { id: r.a_id, display_name: r.a_name, avatar: r.a_avatar } : { id: r.b_id, display_name: r.b_name, avatar: r.b_avatar },
      friend: mineIsA ? { id: r.b_id, display_name: r.b_name, avatar: r.b_avatar } : { id: r.a_id, display_name: r.a_name, avatar: r.a_avatar },
      other_parent_ok: mineIsA ? !!r.parent_ok_b : !!r.parent_ok_a,
    };
  });
  const plans = await plansFor(env, user, kids.map((k) => k.id));
  return json({ kids, approvals: { friends, plans: plans.filter((p) => p.status === 'waiting' && p.members.some((m) => m.my_family && m.parent_status === 'waiting')) }, plans });
}, { role: 'parent' });

add('GET', '/api/kids/:id/safety', async ({ env, user, params }) => {
  const kid = await ownKid(env, user, params.id);
  const reports = await all(env,
    `SELECT r.id, r.reason, r.details, r.status, r.created_at, r.reporter_id, r.reported_id,
            a.display_name AS reporter_name, b.display_name AS reported_name
       FROM reports r JOIN users a ON a.id = r.reporter_id JOIN users b ON b.id = r.reported_id
      WHERE r.reporter_id = ?1 OR r.reported_id = ?1 ORDER BY r.id DESC LIMIT 50`, kid.id);
  const friends = await friendsView(env, kid.id);
  return json({ kid: { id: kid.id, display_name: kid.display_name, avatar: kid.avatar, chat_enabled: kid.chat_enabled }, reports, ...friends });
}, { role: 'parent' });

// ================================================================ notifications
add('GET', '/api/notifications', async ({ env, user }) => {
  const rows = await all(env, 'SELECT id, type, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100', user.id);
  return json({ notifications: rows });
});
add('POST', '/api/notifications/read', async ({ env, user, body }) => {
  if (body.all) await run(env, 'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowIso(), user.id);
  else if (toInt(body.id)) await run(env, 'UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?', nowIso(), toInt(body.id), user.id);
  return json({ ok: true });
});

// ================================================================ texting
add('POST', '/api/sms/test', async ({ env, user }) => {
  const me = await first(env, 'SELECT phone, sms_opt_in FROM users WHERE id = ?', user.id);
  if (!me.phone) fail(400, 'Add your phone number first');
  if (!me.sms_opt_in) fail(400, 'Turn on texts first');
  const r = await sendSms(env, me.phone, "Test text — Let's Hang alerts are working. Reply STOP to opt out.");
  if (r.status === 'failed') fail(502, `Twilio said: ${r.error}`);
  return json({ ok: true, status: r.status });
}, { role: 'parent' });

add('POST', '/api/sms/inbound', async ({ env, request, url }) => {
  const twiml = (text) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${text ? `<Message>${text.replace(/[<&>]/g, '')}</Message>` : ''}</Response>`, { headers: { 'content-type': 'text/xml' } });
  const form = Object.fromEntries(await request.formData());
  const publicUrl = env.APP_URL ? env.APP_URL.replace(/\/$/, '') + url.pathname : url.toString();
  if (!(await verifyTwilioSignature(env.TWILIO_AUTH_TOKEN, publicUrl, form, request.headers.get('x-twilio-signature')))) return new Response('Invalid signature', { status: 403 });
  const from = normalizePhone(form.From);
  const text = String(form.Body || '').trim();
  if (/^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(text)) {
    if (from) await run(env, 'UPDATE users SET sms_opt_in = 0 WHERE phone = ?', from);
    return twiml('');
  }
  return twiml("Open the Let's Hang app to approve plans and see alerts.");
}, { auth: false, raw: true });

// ================================================================ rides (rain/snow pickup + drop-off requests)
const RIDE_REASONS = { rain: '🌧️ Rain', snow: '🌨️ Snow', storm: '⛈️ Storms', cold: '🥶 Freezing', other: '🚗' };
const rideKind = (k) => (k === 'dropoff' ? 'drop-off' : 'pickup');

/** Rides this user can see: kids — rides they ride in; parents — rides with any of their kids. */
async function ridesFor(env, user, rideId = null) {
  const scope = user.role === 'kid'
    ? 'EXISTS (SELECT 1 FROM ride_riders x WHERE x.ride_id = r.id AND x.kid_id = ?1)'
    : 'EXISTS (SELECT 1 FROM ride_riders x JOIN users k ON k.id = x.kid_id WHERE x.ride_id = r.id AND k.family_id = ?1)';
  const rows = await all(env,
    `SELECT r.*, q.display_name AS requested_by_name, c.display_name AS claimed_by_name, c.phone AS claimed_by_phone
       FROM rides r JOIN users q ON q.id = r.requested_by LEFT JOIN users c ON c.id = r.claimed_by
      WHERE ${scope} AND ${rideId ? 'r.id = ?3' : "r.status != 'cancelled' AND r.starts_at > ?2"}
      ORDER BY r.starts_at LIMIT 30`,
    ...[user.role === 'kid' ? user.id : user.family_id, ago(3 * 3600e3), ...(rideId ? [rideId] : [])]);
  if (!rows.length) return [];
  const riders = await all(env,
    `SELECT x.ride_id, u.id, u.display_name, u.avatar, u.family_id FROM ride_riders x JOIN users u ON u.id = x.kid_id
      WHERE x.ride_id IN (${rows.map(() => '?').join(',')})`, ...rows.map((r) => r.id));
  return rows.map((r) => {
    const rs = riders.filter((x) => x.ride_id === r.id);
    return {
      id: r.id, kind: r.kind, reason: r.reason, starts_at: r.starts_at, from_place: r.from_place, to_place: r.to_place, note: r.note,
      status: r.status, requested_by: r.requested_by, requested_by_name: r.requested_by_name,
      claimed_by: r.claimed_by, claimed_by_name: r.claimed_by_name, claimed_at: r.claimed_at,
      // Only the families riding see the driver's number.
      claimed_by_phone: r.claimed_by_phone || null,
      riders: rs.map(({ id, display_name, avatar }) => ({ id, display_name, avatar })),
      my_kids: user.role === 'parent' ? rs.filter((x) => x.family_id === user.family_id).map((x) => x.id) : [],
    };
  });
}
/** Every rider plus every rider's parents (optionally minus one user). */
async function rideAudience(env, ride, exceptId) {
  const kids = await usersById(env, ride.riders.map((k) => k.id));
  const fams = [...new Set(kids.map((k) => k.family_id))];
  const parents = (await Promise.all(fams.map((f) => parentsOf(env, f)))).flat();
  return { kids: kids.filter((k) => k.id !== exceptId), parents: parents.filter((p) => p.id !== exceptId) };
}

add('GET', '/api/rides', async ({ env, user }) => json({ rides: await ridesFor(env, user) }));

add('POST', '/api/rides', async ({ env, ctx, user, body }) => {
  const kind = body.kind === 'dropoff' ? 'dropoff' : body.kind === 'pickup' ? 'pickup' : fail(400, 'Pick pickup or drop-off');
  const reason = Object.hasOwn(RIDE_REASONS, body.reason) ? body.reason : 'other';
  const starts = new Date(body.starts_at || '');
  if (isNaN(starts)) fail(400, 'Pick a time');
  if (starts < new Date(Date.now() - 15 * 60e3)) fail(400, "That time already passed — pick a time that's coming up");
  if (starts > new Date(Date.now() + 7 * 864e5)) fail(400, 'Rides can be asked for up to a week ahead');
  const from = str(body.from_place, 80), to = str(body.to_place, 80), note = str(body.note, 160) || null;
  if (!from || !to) fail(400, 'Say where from and where to');
  if ([from, to, note].some((t) => t && moderate(t))) fail(422, "For safety, don't put phone numbers, street addresses or links in a ride request — say \"school\" or \"the Lee house\".");
  const friendIds = [...new Set((Array.isArray(body.friend_ids) ? body.friend_ids : []).map(toInt).filter((x) => x && x !== user.id))].slice(0, 6);
  for (const fid of friendIds) {
    const [a, b] = pair(user.id, fid);
    if (!(await first(env, `SELECT id FROM friendships WHERE kid_a = ? AND kid_b = ? AND status = 'active'`, a, b))) fail(403, 'You can only add approved friends to a ride');
    if (await isBlocked(env, user.id, fid)) fail(403, 'You can only add approved friends to a ride');
  }
  await rateLimit(env, 'ride:' + user.id, 10, 864e5, "That's a lot of ride requests today — ask a parent directly.");
  const row = await first(env, 'INSERT INTO rides (requested_by, kind, reason, starts_at, from_place, to_place, note) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    user.id, kind, reason, starts.toISOString(), from, to, note);
  await env.DB.batch([user.id, ...friendIds].map((k) => env.DB.prepare('INSERT INTO ride_riders (ride_id, kid_id) VALUES (?, ?)').bind(row.id, k)));
  const [ride] = await ridesFor(env, user, row.id);
  const { kids, parents } = await rideAudience(env, ride, user.id);
  const names = ride.riders.map((k) => firstName(k.display_name)).join(', ');
  const whenTxt = when(env, ride.starts_at);
  await notify(env, ctx, parents, {
    type: 'ride', title: `${RIDE_REASONS[reason]} — ${rideKind(kind)} needed`,
    body: `${names} · ${from} → ${to} · ${whenTxt}. Open Let's Hang and tap "I've got it" if you can drive.`, link: 'rides',
  }, { sms: true });
  await notify(env, ctx, kids, { type: 'ride_update', title: `${firstName(user.display_name)} asked for a ride for you too`, body: `${rideKind(kind)} · ${from} → ${to} · ${whenTxt}`, link: 'rides' });
  return json({ ok: true, id: row.id, parents_asked: parents.length });
}, { role: 'kid' });

add('POST', '/api/rides/:id/claim', async ({ env, ctx, user, params }) => {
  const [ride] = await ridesFor(env, user, toInt(params.id));
  if (!ride) fail(404, 'Ride not found');
  if (!ride.my_kids.length) fail(403, 'Only parents of kids in this ride can drive it');
  if (ride.status === 'cancelled') fail(400, 'This ride was cancelled');
  // Atomic: only one parent can win the claim.
  const r = await run(env, `UPDATE rides SET status = 'claimed', claimed_by = ?, claimed_at = ? WHERE id = ? AND status = 'open'`, user.id, nowIso(), ride.id);
  if (!r.meta.changes) fail(409, `${ride.claimed_by_name ? firstName(ride.claimed_by_name) : 'Another parent'} already has this one 👍`);
  const { kids, parents } = await rideAudience(env, ride, user.id);
  const msg = { type: 'ride_update', title: `🚗 ${user.display_name} is driving!`, body: `${rideKind(ride.kind)} · ${ride.from_place} → ${ride.to_place} · ${when(env, ride.starts_at)}`, link: 'rides' };
  await notify(env, ctx, kids, msg);
  await notify(env, ctx, parents, msg, { sms: true });
  return json({ ok: true });
}, { role: 'parent' });

add('POST', '/api/rides/:id/unclaim', async ({ env, ctx, user, params }) => {
  const [ride] = await ridesFor(env, user, toInt(params.id));
  if (!ride) fail(404, 'Ride not found');
  if (ride.claimed_by !== user.id || ride.status !== 'claimed') fail(403, "You're not the driver for this ride");
  await run(env, `UPDATE rides SET status = 'open', claimed_by = NULL, claimed_at = NULL WHERE id = ?`, ride.id);
  const { kids, parents } = await rideAudience(env, ride, user.id);
  await notify(env, ctx, parents, { type: 'ride', title: `⚠️ Still need a driver`, body: `${firstName(user.display_name)} can't make the ${rideKind(ride.kind)} (${ride.from_place} → ${ride.to_place} · ${when(env, ride.starts_at)}). Can you?`, link: 'rides' }, { sms: true });
  await notify(env, ctx, kids, { type: 'ride_update', title: 'Your ride needs a new driver', body: 'Parents have been asked again.', link: 'rides' });
  return json({ ok: true });
}, { role: 'parent' });

add('POST', '/api/rides/:id/cancel', async ({ env, ctx, user, params }) => {
  const [ride] = await ridesFor(env, user, toInt(params.id));
  if (!ride) fail(404, 'Ride not found');
  // The kid who asked, or a parent of any rider.
  if (user.role === 'kid' ? ride.requested_by !== user.id : !ride.my_kids.length) fail(403, 'Only the kid who asked (or a parent) can cancel');
  if (ride.status === 'cancelled') return json({ ok: true });
  await run(env, `UPDATE rides SET status = 'cancelled' WHERE id = ?`, ride.id);
  const { kids, parents } = await rideAudience(env, ride, user.id);
  const msg = { type: 'ride_update', title: 'Ride cancelled', body: `${firstName(user.display_name)} cancelled the ${rideKind(ride.kind)} · ${when(env, ride.starts_at)}`, link: 'rides' };
  await notify(env, ctx, kids, msg);
  await notify(env, ctx, parents, msg, { sms: ride.status === 'claimed' });
  return json({ ok: true });
});

// ================================================================ hang houses, check-in/out, pickup heads-ups
const SESSION_LABEL = { before: 'before school', after: 'after school', other: '' };
const clock = (env, iso) => new Intl.DateTimeFormat('en-US', { timeZone: TZ(env), hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** Houses a kid may check in at: their own family's, plus the homes of families of approved friends. */
async function housesForKid(env, kid) {
  return all(env,
    `SELECT h.id, h.name, h.address, h.notes, h.family_id, f.name AS family_name
       FROM houses h JOIN families f ON f.id = h.family_id
      WHERE h.active = 1 AND (h.family_id = ?1 OR h.family_id IN (
        SELECT o.family_id FROM friendships fr JOIN users o ON o.id = CASE WHEN fr.kid_a = ?2 THEN fr.kid_b ELSE fr.kid_a END
         WHERE (fr.kid_a = ?2 OR fr.kid_b = ?2) AND fr.status = 'active'))
      ORDER BY (h.family_id = ?1) DESC, h.name`, kid.family_id, kid.id);
}
async function openStay(env, kidId) {
  return first(env,
    `SELECT c.id, c.house_id, c.session, c.in_at, h.name AS house_name, h.family_id AS house_family_id
       FROM checkins c JOIN houses h ON h.id = c.house_id WHERE c.kid_id = ? AND c.out_at IS NULL`, kidId);
}

add('GET', '/api/houses', async ({ env, user, url }) => {
  if (user.role === 'parent' && !url.searchParams.get('kid_id')) {
    return json({ houses: await all(env, 'SELECT id, name, address, notes, family_id FROM houses WHERE family_id = ? AND active = 1 ORDER BY name', user.family_id) });
  }
  const kid = user.role === 'kid' ? await kidRow(env, user.id) : await ownKid(env, user, url.searchParams.get('kid_id'));
  return json({ houses: await housesForKid(env, kid) });
});

add('POST', '/api/houses', async ({ env, user, body }) => {
  const name = str(body.name, 50);
  if (!name) fail(400, 'Give the house a name, like "The Lee House"');
  const row = await first(env, 'INSERT INTO houses (family_id, name, address, notes) VALUES (?, ?, ?, ?) RETURNING id',
    user.family_id, name, str(body.address, 150) || null, str(body.notes, 300) || null);
  return json({ ok: true, id: row.id });
}, { role: 'parent' });

add('PATCH', '/api/houses/:id', async ({ env, user, params, body }) => {
  const h = await first(env, 'SELECT id, family_id FROM houses WHERE id = ?', toInt(params.id));
  if (!h || h.family_id !== user.family_id) fail(404, 'Not found');
  const name = str(body.name, 50);
  if (!name) fail(400, "Name can't be empty");
  await run(env, 'UPDATE houses SET name = ?, address = ?, notes = ? WHERE id = ?', name, str(body.address, 150) || null, str(body.notes, 300) || null, h.id);
  return json({ ok: true });
}, { role: 'parent' });

add('DELETE', '/api/houses/:id', async ({ env, user, params }) => {
  const h = await first(env, 'SELECT id, family_id FROM houses WHERE id = ?', toInt(params.id));
  if (!h || h.family_id !== user.family_id) fail(404, 'Not found');
  if ((await first(env, 'SELECT COUNT(*) AS n FROM checkins WHERE house_id = ? AND out_at IS NULL', h.id)).n) fail(409, 'Someone is still checked in there');
  await run(env, 'UPDATE houses SET active = 0 WHERE id = ?', h.id);
  return json({ ok: true });
}, { role: 'parent' });

/** Everything the home screens need about hang-outs. */
add('GET', '/api/hangout', async ({ env, user }) => {
  const sinceDay = ago(12 * 3600e3);
  if (user.role === 'kid') {
    const kid = await kidRow(env, user.id);
    const stay = await openStay(env, user.id);
    const here = stay ? await all(env,
      `SELECT u.id, u.display_name, u.avatar FROM checkins c JOIN users u ON u.id = c.kid_id
        WHERE c.house_id = ? AND c.out_at IS NULL AND c.kid_id != ?`, stay.house_id, user.id) : [];
    const pickups = await all(env,
      `SELECT p.id, p.kid_id, p.eta_minutes, p.message, p.created_at, p.ack_at, f.display_name AS from_name, k.display_name AS kid_name, h.name AS house_name
         FROM pickups p JOIN users k ON k.id = p.kid_id LEFT JOIN users f ON f.id = p.from_user LEFT JOIN houses h ON h.id = p.house_id
        WHERE p.created_at > ? AND p.ack_at IS NULL AND (p.kid_id = ? OR h.family_id = ?) ORDER BY p.id DESC`, sinceDay, user.id, user.family_id);
    return json({ stay, here, houses: await housesForKid(env, kid), pickups });
  }
  const kids = await all(env, `SELECT id, display_name, avatar FROM users WHERE family_id = ? AND role = 'kid'`, user.family_id);
  for (const k of kids) k.stay = await openStay(env, k.id);
  const atMyHouses = await all(env,
    `SELECT c.id, c.in_at, c.session, h.name AS house_name, u.id AS kid_id, u.display_name, u.avatar, u.family_id
       FROM checkins c JOIN houses h ON h.id = c.house_id JOIN users u ON u.id = c.kid_id
      WHERE h.family_id = ? AND c.out_at IS NULL ORDER BY c.in_at`, user.family_id);
  const pickups = await all(env,
    `SELECT p.id, p.kid_id, p.eta_minutes, p.message, p.created_at, p.ack_at, p.from_user, f.display_name AS from_name, k.display_name AS kid_name, h.name AS house_name, h.family_id AS house_family_id,
            a.display_name AS ack_name
       FROM pickups p JOIN users k ON k.id = p.kid_id LEFT JOIN users f ON f.id = p.from_user LEFT JOIN houses h ON h.id = p.house_id LEFT JOIN users a ON a.id = p.ack_by
      WHERE p.created_at > ? AND (k.family_id = ? OR h.family_id = ?) ORDER BY p.id DESC LIMIT 30`, sinceDay, user.family_id, user.family_id);
  return json({ kids, at_my_houses: atMyHouses, pickups, houses: await all(env, 'SELECT id, name, address, notes FROM houses WHERE family_id = ? AND active = 1', user.family_id) });
});

add('POST', '/api/checkin', async ({ env, ctx, user, body }) => {
  const kid = user.role === 'kid' ? await kidRow(env, user.id) : await ownKid(env, user, body.kid_id);
  const allowed = await housesForKid(env, kid);
  const house = allowed.find((h) => h.id === toInt(body.house_id));
  if (!house) fail(403, 'You can check in at your house or an approved friend\'s house');
  let session = ['before', 'after', 'other'].includes(body.session) ? body.session : (localNow(TZ(env)).hour < 11 ? 'before' : 'after');
  const open = await openStay(env, kid.id);
  if (open && open.house_id === house.id) fail(409, `Already checked in at ${house.name}`);
  const stamp = nowIso();
  const stmts = [];
  if (open) stmts.push(env.DB.prepare('UPDATE checkins SET out_at = ?, out_by = ? WHERE id = ?').bind(stamp, user.id, open.id));
  stmts.push(env.DB.prepare('INSERT INTO checkins (kid_id, house_id, session, in_at, in_by) VALUES (?, ?, ?, ?, ?)').bind(kid.id, house.id, session, stamp, user.id));
  await env.DB.batch(stmts);
  const msg = `${firstName(kid.display_name)} checked in at ${house.name}${SESSION_LABEL[session] ? ` (${SESSION_LABEL[session]})` : ''}`;
  const recipients = [...await parentsOf(env, kid.family_id)];
  if (house.family_id !== kid.family_id) recipients.push(...await parentsOf(env, house.family_id));
  await notify(env, ctx, recipients.filter((p) => p.id !== user.id), { type: 'checkin', title: msg, body: `at ${clock(env, stamp)}`, link: 'home' }, { sms: true });
  return json({ ok: true, house: house.name });
});

add('POST', '/api/checkout', async ({ env, ctx, user, body }) => {
  const kid = user.role === 'kid' ? await kidRow(env, user.id) : await ownKid(env, user, body.kid_id);
  const open = await openStay(env, kid.id);
  if (!open) fail(409, `${firstName(kid.display_name)} isn't checked in anywhere`);
  const stamp = nowIso();
  await env.DB.batch([
    env.DB.prepare('UPDATE checkins SET out_at = ?, out_by = ? WHERE id = ?').bind(stamp, user.id, open.id),
    env.DB.prepare('UPDATE pickups SET ack_at = ?, ack_by = ? WHERE kid_id = ? AND ack_at IS NULL').bind(stamp, user.id, kid.id),
  ]);
  const recipients = [...await parentsOf(env, kid.family_id)];
  if (open.house_family_id !== kid.family_id) recipients.push(...await parentsOf(env, open.house_family_id));
  await notify(env, ctx, recipients.filter((p) => p.id !== user.id), { type: 'checkin', title: `${firstName(kid.display_name)} checked out of ${open.house_name}`, body: `at ${clock(env, stamp)}`, link: 'home' }, { sms: true });
  return json({ ok: true });
});

add('GET', '/api/checkins', async ({ env, user, url }) => {
  const kid = user.role === 'kid' ? await kidRow(env, user.id) : await ownKid(env, user, url.searchParams.get('kid_id'));
  return json({ history: await all(env, `SELECT c.id, c.session, c.in_at, c.out_at, h.name AS house_name FROM checkins c JOIN houses h ON h.id = c.house_id WHERE c.kid_id = ? ORDER BY c.in_at DESC LIMIT 30`, kid.id) });
});

add('POST', '/api/pickups', async ({ env, ctx, user, body }) => {
  const kid = await ownKid(env, user, body.kid_id);
  let eta = toInt(body.eta_minutes);
  if (eta === null || eta < 0 || eta > 180) eta = 10;
  const note = str(body.message, 160) || null;
  const stay = await openStay(env, kid.id);
  const row = await first(env, 'INSERT INTO pickups (kid_id, house_id, from_user, eta_minutes, message) VALUES (?, ?, ?, ?, ?) RETURNING id',
    kid.id, stay ? stay.house_id : null, user.id, eta, note);
  const etaText = eta === 0 ? "is outside now" : `is on the way — about ${eta} min`;
  const k = (await usersById(env, [kid.id]))[0];
  await notify(env, ctx, [k], { type: 'pickup', title: `🚗 ${firstName(user.display_name)} ${etaText}`, body: note || 'Start packing up! Tap "Got it" so they know.', link: 'home' });
  let hosts = 0;
  if (stay && stay.house_family_id !== kid.family_id) {
    const hostFamily = await all(env, 'SELECT id, role, display_name, phone, sms_opt_in, notify_prefs FROM users WHERE family_id = ?', stay.house_family_id);
    hosts = hostFamily.length;
    await notify(env, ctx, hostFamily, { type: 'pickup', title: `🚗 Pickup for ${firstName(kid.display_name)} at ${stay.house_name}`, body: `${firstName(user.display_name)} ${etaText}.${note ? ` "${note}"` : ''}`, link: 'home' }, { sms: true });
  }
  return json({ ok: true, id: row.id, at: stay ? stay.house_name : null, hosts });
}, { role: 'parent' });

add('POST', '/api/pickups/:id/ack', async ({ env, ctx, user, params }) => {
  const p = await first(env, `SELECT p.*, k.display_name AS kid_name, h.family_id AS house_family_id FROM pickups p JOIN users k ON k.id = p.kid_id LEFT JOIN houses h ON h.id = p.house_id WHERE p.id = ?`, toInt(params.id));
  if (!p) fail(404, 'Not found');
  const allowed = user.id === p.kid_id || (p.house_family_id && user.family_id === p.house_family_id);
  if (!allowed) fail(403, 'Only the kid or the host family can confirm');
  if (!p.ack_at) {
    await run(env, 'UPDATE pickups SET ack_at = ?, ack_by = ? WHERE id = ?', nowIso(), user.id, p.id);
    if (p.from_user) {
      const sender = await usersById(env, [p.from_user]);
      const who = user.id === p.kid_id ? `${firstName(p.kid_name)} got your heads-up 👍` : `${firstName(user.display_name)} will tell ${firstName(p.kid_name)} you're coming 👍`;
      await notify(env, ctx, sender, { type: 'pickup', title: who, link: 'home' }, { sms: true });
    }
  }
  return json({ ok: true });
});

// ---- school schedule + walk weather (per family)
const famRow = (env, id) => first(env, 'SELECT id, name, school_name, school_arrive, school_start, school_end, walk_minutes, walk_miles, location_name, lat, lon FROM families WHERE id = ?', id);
add('GET', '/api/today', async ({ env, ctx, user }) => {
  const fam = await famRow(env, user.family_id);
  const day = pickSchoolDay(fam, TZ(env));
  const sched = schedule(fam);
  return json({ day, schedule: sched, weather: await walkWeather(env, ctx, fam, day, sched), location: fam.location_name, school_name: fam.school_name });
});
add('PATCH', '/api/family/schedule', async ({ env, user, body }) => {
  const fam = await famRow(env, user.family_id);
  const next = { ...fam };
  for (const k of ['school_arrive', 'school_start', 'school_end']) if (body[k] !== undefined) { if (!TIME_RE.test(body[k])) fail(400, 'Times look like 08:40'); next[k] = body[k]; }
  if (toMin(next.school_arrive) > toMin(next.school_start)) fail(400, 'Arrive time should be before the first bell');
  if (toMin(next.school_end) <= toMin(next.school_start)) fail(400, 'Dismissal should be after school starts');
  if (body.walk_minutes !== undefined) { const w = toInt(body.walk_minutes); if (w === null || w < 0 || w > 120) fail(400, 'Walk time: 0–120 minutes'); next.walk_minutes = w; }
  if (body.walk_miles !== undefined) { const m = Number(body.walk_miles); if (!(m >= 0 && m <= 20)) fail(400, 'Distance: 0–20 miles'); next.walk_miles = Math.round(m * 10) / 10; }
  if (body.school_name !== undefined) next.school_name = str(body.school_name, 80) || null;
  const loc = str(body.location_name, 80);
  if (loc && loc !== fam.location_name) {
    const g = await geocode(loc.replace(/,.*$/, '').trim()).catch(() => null);
    if (!g) fail(400, `Couldn't find "${loc}" — try just the city name`);
    next.lat = g.lat; next.lon = g.lon; next.location_name = g.label;
  }
  await run(env, `UPDATE families SET school_name = ?, school_arrive = ?, school_start = ?, school_end = ?, walk_minutes = ?, walk_miles = ?, location_name = ?, lat = ?, lon = ? WHERE id = ?`,
    next.school_name, next.school_arrive, next.school_start, next.school_end, next.walk_minutes, next.walk_miles, next.location_name, next.lat, next.lon, fam.id);
  return json({ ok: true, location_name: next.location_name });
}, { role: 'parent' });
