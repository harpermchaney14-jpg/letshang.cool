# Let's Hang 🏠✨

A mobile-first app for middle schoolers and their parents: approved friends, one-to-one chat, plans that parents approve, "I'm Ready!", games — plus host-house check-in/out, pickup heads-ups, and walk-to-school weather. Runs entirely on **Cloudflare Workers + D1**, styled with the **Let's Hang neon graffiti design system** (`public/design.css`).

## What's in it

**Kids**
- Splash → "I'M A KID" → sign in (accounts are created by a parent).
- First-run onboarding: pick an avatar, display name, safety rules, your friend code.
- Home: profile + greeting, notifications, menu, hero, **I'M READY!**, check-in card, action cards (Chat · Friends · Games · Made a Plan · Profile · Settings), walk-weather banner, next confirmed plan.
- Bottom nav: Home · Chat · Friends · Games · Profile.
- **Friends** by private code (e.g. `HANG-7KQ2`): send / accept / decline, remove, block, report.
- **Chat** one-to-one with approved friends only: conversation list, unread counts, timestamps, block/report, a big **Made a Plan** button.
- **Made a Plan**: pick friend(s), date, time (+ optional details) → every kid's parent approves → appears on the calendar. Statuses: waiting · approved · declined · cancelled.
- **Check in / out** at their own home or an approved friend's family's house.
- **Games**: Memory Match, Tic-Tac-Toe, Would You Rather, Hang Ideas (→ "make it a plan"). Single-player; no public chat.
- Profile: avatar, display name, friend code (can regenerate), connected parents with Message / Text.

**Parents**
- Parent sign-up (with a one-time **recovery code**), add kids with a consent checkbox, add a co-parent.
- Dashboard: approvals banner, kids with check-in status, "Ready!" flag, **🚗 Heads-up** (pickup ETA to kid + host family), check in/out for them, message, friends & safety.
- **Approvals**: friend requests (both kids' parents must approve) and plans (each kid's parent approves their own kid).
- **Calendar** of approved plans; waiting and declined plans are listed separately, never as confirmed.
- **Alerts** for everything: friend requests, plans, "I'm Ready!", check-ins, pickups, safety reports, messages from kids.
- Per kid: read-only chats, friends (remove), blocks, safety reports, pause chat, reset PIN, check-in history, delete account & data.
- Account: phone + text alerts, our hang house(s), school schedule (default 8:40 arrive · 9:00 bell · 3:50 out · 1 mi ≈ 20 min walk · Sioux Falls), password, delete family.

## Safety & privacy built in
- Every permission is checked on the server (Cloudflare Worker), never only in the app.
- Kids can't sign up alone; a parent creates the account and records consent.
- Friendships need the friend to accept **and** each kid's parent to approve before chat opens.
- Chat blocks phone numbers, emails, street addresses, links and mean words. Messages that suggest a kid may need support alert their parent.
- Block (also removes the friendship and hides your code from them) and Report (alerts the reporter's and the reported kid's parents).
- Private-by-default profiles: other kids only see a display name + preset avatar. **No photos, birthdays or locations stored.**
- Friend codes come from crypto randomness; code lookups, logins, messages, plans and recovery are rate-limited.
- Passwords: PBKDF2-SHA256. Sessions: HttpOnly cookies. Data retention job runs daily (chats deleted after a year, notifications after 60 days). Parents can delete a kid or the whole family.
- HTTPS everywhere via Cloudflare; D1 is encrypted at rest by Cloudflare.

> **Before launching publicly:** do a child-privacy review (e.g. COPPA in the US), add human moderation for reports, and test with real families. The built-in filters are a first layer, not a complete moderation system.

## Deploy (one command)
You need Node.js 18+ and a free Cloudflare account.
```bash
npm install
npm run setup
```
The script logs into Cloudflare, creates the D1 database, writes its ID into `wrangler.toml`, applies all migrations, deploys, saves your app URL, and optionally stores Twilio keys for text alerts. Safe to re-run. Then commit `wrangler.toml`.

**Auto-deploy from GitHub:** add repository secrets `CLOUDFLARE_API_TOKEN` (Workers + D1 edit) and `CLOUDFLARE_ACCOUNT_ID`. Every push to `main` runs `.github/workflows/deploy.yml` (migrations + deploy).

### Text alerts (optional)
Uses Twilio. Until keys are added, alerts appear in the app and texts are logged in practice mode. US texting requires A2P 10DLC (or toll-free) registration in Twilio. Webhook for STOP handling: `https://YOUR-APP/api/sms/inbound` (HTTP POST).

### Weather
Free from [Open-Meteo](https://open-meteo.com), no key, cached 30 minutes. Set `WEATHER_MOCK=1` in `.dev.vars` for offline sample data.

## Local development
```bash
npm install
npm run db:migrate:local
npm run dev        # http://localhost:8787
```

## Project layout
```
public/design.css   Let's Hang design system (visual source of truth)
public/app.css      App components built on the design-system tokens
public/app.js       Front end (vanilla JS, no build step)
src/index.js        API + authorization + moderation + notifications
src/today.js        School schedule + walk weather
src/auth.js         Password hashing, cookie sessions
src/sms.js          Twilio texts
migrations/         D1 schema (0003 = v2 social model, 0004 = hang houses/check-in/weather)
scripts/setup.mjs   One-command Cloudflare setup
```
