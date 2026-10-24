/* Let's Hang — front end (vanilla JS, no build step).
   Visual layer: design.css (design system, source of truth) + app.css. The server enforces every permission. */
(() => {
  'use strict';

  // ================================================================ utilities
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const first = (n) => String(n || '').split(' ')[0];
  const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const sameDay = (a, b) => dayKey(a) === dayKey(b);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
  function dayLabel(d) {
    const t = new Date(), tm = new Date(); tm.setDate(t.getDate() + 1);
    if (sameDay(d, t)) return 'Today';
    if (sameDay(d, tm)) return 'Tomorrow';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    const d = new Date(iso);
    if (sameDay(d, new Date())) return time(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time(iso);
  }
  const whenText = (iso) => `${dayLabel(new Date(iso))} · ${time(iso)}`;
  const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hm = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`; };
  const defaultSession = () => (new Date().getHours() < 11 ? 'before' : 'after');

  const AVATAR = {
    star: ['⭐', '#ffd400'], fox: ['🦊', '#ff7a00'], cat: ['😺', '#ff16c7'], unicorn: ['🦄', '#8b00ff'],
    alien: ['👽', '#19f58a'], panda: ['🐼', '#00eaff'], frog: ['🐸', '#19f58a'], fire: ['🔥', '#ff7a00'],
    skate: ['🛹', '#1478ff'], music: ['🎧', '#00eaff'], gamer: ['🎮', '#8b00ff'], butterfly: ['🦋', '#1478ff'],
    crown: ['👑', '#ffd400'], rocket: ['🚀', '#ff16c7'], rainbow: ['🌈', '#ff16c7'], bolt: ['⚡', '#ffd400'],
  };
  const ava = (key, cls = '') => { const [e, c] = AVATAR[key] || AVATAR.star; return `<span class="ava ${cls}" style="--c:${c}" aria-hidden="true">${e}</span>`; };
  const HOUSE_COLORS = ['#00eaff', '#ff16c7', '#ffd400', '#19f58a', '#8b00ff', '#ff7a00', '#1478ff'];
  const HOUSE_EM = ['🏠', '🏡', '🏰', '🛖', '🏘️', '⛺'];
  const houseColor = (id) => HOUSE_COLORS[(Number(id) || 0) % HOUSE_COLORS.length];
  const houseEm = (id) => HOUSE_EM[(Number(id) || 0) % HOUSE_EM.length];

  const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const I = {
    home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/>'),
    friends: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.2a5 5 0 0 1 5.5 5.8"/>'),
    games: svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>'),
    profile: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    bell: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
    menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    cal: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
    back: svg('<path d="m15 5-7 7 7 7"/>'),
    send: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 'width="22" height="22"'),
    more: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    left: svg('<path d="m15 6-6 6 6 6"/>'), right: svg('<path d="m9 6 6 6-6 6"/>'),
    approve: svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  };

  // ================================================================ state + api
  const S = {
    me: null, family: [], badges: {}, smsLive: false,
    door: store.get('lh_door', 'kid'), authMode: 'login',
    tab: 'home', view: null,
    friends: null, chats: null, plans: null, dash: null, notes: null, conv: null, fam: null, kidView: null, kidChats: null,
    hang: null, today: null, eta: 10,
    calMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1), calDay: null,
    onboardStep: 0, game: null, busy: false,
  };

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch('/api' + path, {
      method, credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && S.me) { S.me = null; stopPolling(); render(); }
      throw new Error(data.error || 'Something went wrong. Try again.');
    }
    return data;
  }
  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg; t.className = 'show ' + kind;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = kind; }, 3400);
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const colors = theme() === 'pastel' ? ['#d9c8ff', '#ffc8de', '#c6e6ff', '#d6e4cb', '#ffd8c4', '#fff0b3', '#ffffff'] : ['#ffd400', '#ff16c7', '#00eaff', '#19f58a', '#8b00ff', '#ff7a00', '#1478ff'];
    for (let i = 0; i < 45; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw'; p.style.background = colors[i % colors.length];
      p.style.setProperty('--x', (Math.random() * 160 - 80) + 'px'); p.style.setProperty('--r', (Math.random() * 1080 - 540) + 'deg');
      p.style.setProperty('--d', (1.4 + Math.random() * 1.4) + 's'); p.style.animationDelay = Math.random() * .3 + 's';
      box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 3400);
  }
  function applyTheme(t) {
    const th = ['neon', 'pastel'].includes(t) ? t : 'neon';
    document.documentElement.dataset.theme = th;
    store.set('lh_theme', th);
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = th === 'pastel' ? '#f4ecff' : '#05070d';
  }
  function stylePicker() {
    const cur = theme();
    const opt = (k, name, desc, sw) => `<button class="style-opt ${cur === k ? 'on' : ''}" data-act="theme" data-t="${k}" aria-pressed="${cur === k}">
      <span class="sw">${sw.map((c) => `<i style="background:${c}"></i>`).join('')}</span><b>${name}</b><small>${desc}</small></button>`;
    return `<div class="panel stack"><h3>My style</h3><p class="small muted">Only changes how the app looks for you.</p>
      <div class="style-grid">${opt('neon', 'Neon', 'Graffiti + glow', ['#ff16c7', '#00eaff', '#ffd400', '#12002a'])}${opt('pastel', 'Pastel', 'Soft + dreamy', ['#d9c8ff', '#d6e4cb', '#ffc8de', '#c6e6ff'])}</div></div>`;
  }
  // ================================================================ sounds
  // Little synthesized tunes (no audio files). iPhones only allow sound after the first tap,
  // so the audio engine is unlocked on the first touch anywhere in the app.
  const Sound = (() => {
    let ctx = null;
    const on = () => store.get('lh_sound', true) !== false;
    function engine() {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    function unlock() {
      const c = engine(); if (!c) return;
      const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
    }
    ['touchend', 'pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));
    // note: [frequency Hz, start s, length s, voice, volume, slide-to Hz]
    // voices: any oscillator wave, plus 'pluck' (guitar-ish) and 'bell' (glassy, with an overtone)
    function osc(c, type, f, t, len, vol, toF) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (toF) o.frequency.exponentialRampToValueAtTime(toF, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + len + 0.05);
    }
    function tune(notes) {
      const c = engine(); if (!c) return;
      const t0 = c.currentTime + 0.02;
      for (const [f, at, len, voice = 'sine', vol = 0.25, toF] of notes) {
        const t = t0 + at;
        if (voice === 'pluck') { osc(c, 'triangle', f, t, len, vol); osc(c, 'sine', f * 2, t, len * 0.6, vol * 0.35); }
        else if (voice === 'bell') { osc(c, 'sine', f, t, len, vol); osc(c, 'sine', f * 2.76, t, len * 0.5, vol * 0.18); osc(c, 'sine', f * 5.4, t, len * 0.25, vol * 0.06); }
        else osc(c, voice, f, t, len, vol, toF);
      }
    }
    const sparkle = (at) => [[2637, at, 0.25, 'bell', 0.05], [3136, at + 0.06, 0.3, 'bell', 0.04], [3951, at + 0.12, 0.35, 'bell', 0.03]];
    const SQ = 'square', V = 0.2; // 8-bit squares are loud — keep them low
    const TUNES = {
      // NEON — 8-bit arcade
      neon: {
        message: [[988, 0, 0.06, SQ, V], [1319, 0.06, 0.1, SQ, V]],                                              // blip-blip
        ready:   [523, 659, 784, 1047, 1319, 1568, 2093].map((f, i) => [f, i * 0.045, 0.08, SQ, V]),           // power-up!
        pickup:  [[880, 0, 0.09, SQ, V], [880, 0.14, 0.09, SQ, V], [1175, 0.28, 0.22, SQ, V, 1760]],            // bleep bleep bwoop
        checkin: [[392, 0, 0.18, SQ, V, 1568], [1568, 0.17, 0.1, SQ, V]],                                      // zip-in
        approve: [[784, 0, 0.09, SQ, V], [1047, 0.1, 0.09, SQ, V], [1319, 0.2, 0.09, SQ, V], [1568, 0.3, 0.32, SQ, V], [784, 0.3, 0.32, 'triangle', 0.15]], // level clear
        safety:  [[330, 0, 0.18, 'sawtooth', 0.2], [247, 0.2, 0.18, 'sawtooth', 0.2], [330, 0.4, 0.18, 'sawtooth', 0.2], [247, 0.6, 0.3, 'sawtooth', 0.2]],
        chime:   [[1319, 0, 0.06, SQ, V], [1760, 0.07, 0.12, SQ, V]],
      },
      // PASTEL — sparkly pop: plucks, glassy bells, dreamy chords
      pastel: {
        message: [[659, 0, 0.35, 'pluck', 0.22], [988, 0.09, 0.5, 'pluck', 0.2], ...sparkle(0.12)],
        ready:   [[523, 0, 1.1, 'pluck', 0.16], [659, 0.05, 1.1, 'pluck', 0.15], [784, 0.1, 1.1, 'pluck', 0.15], [988, 0.15, 1.2, 'pluck', 0.14], [1319, 0.3, 0.9, 'bell', 0.12], ...sparkle(0.35)], // dreamy strum
        pickup:  [[1760, 0, 0.7, 'bell', 0.16], [1760, 0.32, 0.9, 'bell', 0.16], [1319, 0.32, 0.9, 'bell', 0.08]], // ding… ding
        checkin: [[392, 0, 0.6, 'pluck', 0.18], [494, 0.08, 0.6, 'pluck', 0.17], [587, 0.16, 0.6, 'pluck', 0.17], [784, 0.24, 0.8, 'pluck', 0.17], ...sparkle(0.3)],
        approve: [[698, 0, 0.9, 'bell', 0.15], [880, 0.1, 0.9, 'bell', 0.14], [1047, 0.2, 0.9, 'bell', 0.13], [1319, 0.3, 1.1, 'bell', 0.13], ...sparkle(0.4)],
        safety:  [[880, 0, 0.35, 'bell', 0.2], [698, 0.25, 0.45, 'bell', 0.2], [880, 0.6, 0.35, 'bell', 0.2], [698, 0.85, 0.5, 'bell', 0.2]],
        chime:   [[1319, 0, 0.6, 'bell', 0.15], [1976, 0.1, 0.7, 'bell', 0.1], ...sparkle(0.15)],
      },
    };
    const KIND = { message: 'message', parent_message: 'message', ready: 'ready', pickup: 'pickup', checkin: 'checkin', ride: 'pickup', ride_update: 'approve',
      friend_request: 'approve', friend_approval: 'approve', friend_accepted: 'approve', plan_approval: 'approve', plan_update: 'approve', safety: 'safety' };
    return {
      on, kindFor: (type) => KIND[type] || 'chime',
      play(kind, force) { if (!force && !on()) return; const set = TUNES[theme()] || TUNES.neon; try { tune(set[kind] || set.chime); } catch { /* audio blocked */ } },
      set(v) { store.set('lh_sound', !!v); },
    };
  })();
  // Compare fresh badge counts with what we've already heard; play one sound for anything new.
  let heard = null;
  function soundCheck(b) {
    if (!b) return;
    const now = { id: b.latest_id || 0, msgs: (b.messages || 0) + (b.family_messages || 0) };
    if (heard && S.me) {
      if (now.id > heard.id) Sound.play(Sound.kindFor(b.latest_type));
      else if (now.msgs > heard.msgs) Sound.play('message');
    }
    heard = now;
  }
  function soundPanel() {
    return `<div class="panel stack"><h3>🔊 Sounds</h3>
      <label class="switch-row"><span>Play a sound for new notifications</span><input type="checkbox" role="switch" data-act="sound-toggle" ${Sound.on() ? 'checked' : ''}></label>
      <div class="row wrap">${[['message', '💬'], ['pickup', '🚗'], ['ready', '🙋'], ['approve', '✅']].map(([k, e]) => `<button type="button" class="ghost-button sm" data-act="sound-test" data-k="${k}">${e} Test</button>`).join('')}</div>
      <p class="small muted">${theme() === 'pastel' ? 'Pastel = sparkly pop sounds ✨' : 'Neon = arcade sounds 🕹️'} — they switch with your style. Sounds play while Let's Hang is open. Turn your ringer on (the side switch) and turn the volume up.</p></div>`;
  }
  const isKid = () => S.me?.role === 'kid';
  const parents = () => S.family.filter((u) => u.role === 'parent');

  // ================================================================ navigation
  function go(tab) { S.tab = tab; S.view = null; S.game = null; render(); scrollTo(0, 0); loadForScreen(); return true; }
  function open(name, id) { S.view = { name, id }; render(); scrollTo(0, 0); loadForScreen(); return true; }
  function back() { S.view = null; render(); loadForScreen(); }
  function follow(link) {
    if (!link) return false;
    const [k, id] = link.split(':');
    if (k === 'chat') { S.tab = isKid() ? 'chat' : 'home'; return open('conv', Number(id)); }
    if (k === 'family') return open('family', Number(id));
    if (k === 'kid') return isKid() ? false : (S.tab = 'home', open('kid', Number(id)));
    if (k === 'friends') return go(isKid() ? 'friends' : 'approvals');
    if (k === 'rides') return open('rides');
    if (k === 'plans') return isKid() ? (S.tab = 'home', open('plans')) : go('calendar');
    if (k === 'approvals') return go('approvals');
    if (k === 'home') return go('home');
    return false;
  }

  async function loadForScreen() {
    const v = S.view?.name;
    try {
      if (v === 'conv') await loadConv(true);
      else if (v === 'family') S.fam = await api(`/family-chat/${S.view.id}`);
      else if (v === 'kid') { [S.kidView, S.kidChats] = await Promise.all([api(`/kids/${S.view.id}/safety`), api(`/chats?kid_id=${S.view.id}`).then((d) => d.chats)]); }
      else if (v === 'notifications') S.notes = (await api('/notifications')).notifications;
      else if (v === 'plans') [S.plans, S.friends] = await Promise.all([api('/plans').then((d) => d.plans), api('/friends')]);
      else if (v === 'walk') S.today = await api('/today');
      else if (v === 'rides') S.rides = (await api('/rides')).rides;
      else if (isKid()) {
        if (S.tab === 'home') [S.plans, S.hang, S.today, S.rides] = await Promise.all([api('/plans').then((d) => d.plans), api('/hangout'), api('/today'), api('/rides').then((d) => d.rides)]);
        if (S.tab === 'chat') S.chats = (await api('/chats')).chats;
        if (S.tab === 'friends') S.friends = await api('/friends');
      } else {
        if (S.tab === 'home') [S.dash, S.hang, S.today, S.rides] = await Promise.all([api('/dashboard'), api('/hangout'), api('/today'), api('/rides').then((d) => d.rides)]);
        if (S.tab === 'approvals' || S.tab === 'calendar') S.dash = await api('/dashboard');
        if (S.tab === 'alerts') S.notes = (await api('/notifications')).notifications;
        if (S.tab === 'account') [S.hang, S.today] = await Promise.all([api('/hangout'), api('/today')]);
      }
    } catch (e) { toast(e.message, 'warn'); }
    paint();
    scrollChat(true);
  }

  // ================================================================ polling
  let pollTimer, convTimer;
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      if (document.hidden || !S.me) return;
      try {
        const b = await api('/badges');
        soundCheck(b);
        const changed = JSON.stringify(b) !== JSON.stringify(S.badges);
        S.badges = b; paintBadges();
        if (changed && !document.activeElement?.matches('input, textarea, select') && !$('#modal-root').innerHTML && S.view?.name !== 'conv') loadForScreen();
      } catch { /* offline blip */ }
    }, 8000);
    convTimer = setInterval(() => { if (!document.hidden && (S.view?.name === 'conv' || S.view?.name === 'family')) loadConv(false); }, 4000);
  }
  function stopPolling() { clearInterval(pollTimer); clearInterval(convTimer); }

  // ================================================================ shell
  function render() {
    const app = $('#app');
    if (!S.me) { app.innerHTML = renderAuth(); return; }
    if (isKid() && !S.me.onboarded) { app.innerHTML = `<main class="view onboarding">${renderOnboarding()}</main>`; return; }
    app.innerHTML = `
      <header class="topbar">
        <button class="profile-chip" data-act="tab" data-tab="${isKid() ? 'profile' : 'account'}" aria-label="Your profile">
          ${ava(S.me.avatar, 'profile-avatar')}
          <span class="greeting">${hiWord()},<strong>${esc(first(S.me.display_name))}</strong></span>
        </button>
        <div class="topbar-actions" id="top-actions">${renderTopActions()}</div>
      </header>
      <main class="view" id="view"></main>
      ${renderNav()}`;
    paint();
  }
  function paint() {
    const v = $('#view');
    if (!v) return;
    v.innerHTML = screenHTML();
    paintBadges();
  }
  function paintBadges() {
    const nav = $('#nav'); if (nav) nav.outerHTML = renderNav();
    const ta = $('#top-actions'); if (ta) ta.innerHTML = renderTopActions();
  }
  const hiWord = () => { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 17 ? 'Hey' : 'Evening'; };
  const badge = (n) => n ? `<span class="notification-badge" aria-label="${n} new">${n > 9 ? '9+' : n}</span>` : '';
  function renderTopActions() {
    const n = S.badges.notifications || 0;
    return `<button class="icon-button" data-act="open" data-view="notifications" aria-label="Notifications${n ? `, ${n} new` : ''}">${I.bell}${badge(n)}</button>
      <button class="icon-button" data-act="${isKid() ? 'open' : 'tab'}" data-view="settings" data-tab="account" aria-label="Menu and settings">${I.menu}</button>`;
  }
  function renderNav() {
    const b = S.badges;
    const tabs = isKid()
      ? [['home', 'Home', I.home, b.family_messages], ['chat', 'Chat', I.chat, b.messages], ['friends', 'Friends', I.friends, 0], ['games', 'Games', I.games, 0], ['profile', 'Profile', I.profile, 0]]
      : [['home', 'Home', I.home, b.family_messages], ['approvals', 'Approvals', I.approve, b.approvals], ['calendar', 'Calendar', I.cal, 0], ['alerts', 'Alerts', I.bell, b.notifications], ['account', 'Account', I.gear, 0]];
    const cur = S.view?.name === 'conv' && isKid() ? 'chat' : S.tab;
    return `<nav class="bottom-nav" id="nav" aria-label="Main">${tabs.map(([k, l, ic, n]) => `
      <button class="nav-item ${cur === k ? 'active' : ''}" data-act="tab" data-tab="${k}" ${cur === k ? 'aria-current="page"' : ''}>
        <span class="nav-icon">${ic}</span><span>${l}</span>${badge(n)}
      </button>`).join('')}</nav>`;
  }
  function screenHTML() {
    const v = S.view?.name;
    if (v === 'conv') return viewConversation();
    if (v === 'family') return viewFamilyChat();
    if (v === 'notifications') return viewNotifications();
    if (v === 'settings') return viewKidSettings();
    if (v === 'plans') return viewPlans();
    if (v === 'kid') return viewParentKid();
    if (v === 'walk') return viewWalk();
    if (v === 'rides') return viewRides();
    if (isKid()) return ({ home: kidHome, chat: kidChats, friends: kidFriends, games: kidGames, profile: kidProfile })[S.tab]();
    return ({ home: parentHome, approvals: parentApprovals, calendar: parentCalendar, alerts: viewNotifications, account: parentAccount })[S.tab]();
  }
  const subHeader = (title, extra = '') => `<div class="subhead"><button class="icon-button" data-act="back" aria-label="Back">${I.back}</button><h2>${title}</h2>${extra}</div>`;
  const sectionTitle = (t, extra = '') => `<div class="section-title"><h2>${t}</h2>${extra}</div>`;
  const DOODLES = `<svg class="doodles" viewBox="0 0 400 320" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
      <path d="M26 86 34 42l20 20 14-30 14 30 20-20 8 44z" stroke="#ffd400"/>
      <circle cx="350" cy="62" r="34" stroke="#ffd400"/><path d="M332 50l10 10m0-10-10 10M358 50l10 10m0-10-10 10M332 76q18 16 36 0" stroke="#ffd400" stroke-width="4"/>
      <path d="M20 182c0-12 9-19 19-19h30c10 0 19 7 19 19 0 14-7 26-17 26-7 0-10-9-17-9s-10 9-17 9c-10 0-17-12-17-26z" stroke="#00eaff" stroke-width="4"/>
      <path d="M372 150l-22 40h17l-10 34 27-46h-17l12-28z" stroke="#ff16c7" stroke-width="4"/>
      <path d="M40 262l6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2z" stroke="#ffd400" stroke-width="4"/>
      <path d="M354 266l6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2z" stroke="#19f58a" stroke-width="4"/>
    </g></svg>`;
  const theme = () => document.documentElement.dataset.theme || 'neon';
  const STICKERS = { neon: ['⭐', '🎮', '⚡', '🛹'], pastel: ['✨', '🫧', '🌸', '💿'] };
  const stickers = () => (STICKERS[theme()] || STICKERS.neon).map((e, i) => `<span class="stk s${i + 1}" aria-hidden="true">${e}</span>`).join('');
  const heroHTML = (tag) => `<section class="hero">${DOODLES}${stickers()}<h1 class="hero-logo"><span class="lets">Let's</span><span class="hang">Hang</span></h1><p class="hero-tagline">${tag}</p></section>`;
  const card = (cls, act, icon, label, extra = '', n = 0) => `<button class="action-card ${cls}" data-act="${act}" ${extra}>
      ${n ? `<span class="notification-badge card-badge">${n > 9 ? '9+' : n}</span>` : ''}
      <span class="action-icon" aria-hidden="true">${icon}</span>
      <span class="action-label">${label}<span class="action-arrow" aria-hidden="true">→</span></span></button>`;
  const empty = (e, text, btn = '') => `<div class="panel empty"><div class="e" aria-hidden="true">${e}</div><p>${text}</p>${btn}</div>`;
  const statusPill = (s) => `<span class="pill st-${s}">${{ waiting: '⏳ Waiting', approved: '✅ Approved', declined: '✖ Declined', cancelled: 'Cancelled' }[s]}</span>`;

  // ================================================================ sign in
  function renderAuth() {
    const parent = S.door === 'parent';
    let form;
    if (parent && S.authMode === 'signup') form = renderSignup();
    else if (parent && S.authMode === 'recover') form = renderRecover();
    else form = `
      <form class="panel stack" data-form="login" autocomplete="on">
        <h2>${parent ? 'Parent sign in' : "What's up! Sign in"}</h2>
        <label class="fld"><span>Username</span><input class="field" name="username" autocomplete="username" autocapitalize="none" required></label>
        <label class="fld"><span>${parent ? 'Password' : 'PIN or password'}</span><input class="field" name="password" type="password" autocomplete="current-password" required></label>
        <p class="form-error" data-err role="alert"></p>
        <button class="primary-button block big" type="submit">${parent ? 'Sign in' : "Let's go!"}</button>
        ${parent
          ? `<p class="center small muted">New family? <button type="button" class="linkish" data-act="auth-mode" data-mode="signup">Create a parent account</button><br>
             <button type="button" class="linkish" data-act="auth-mode" data-mode="recover">Forgot password?</button></p>`
          : `<p class="center small muted">No account yet? Your parent creates it for you in their Let's Hang account.</p>`}
      </form>`;
    return `<div class="auth">
      ${heroHTML('Real friends. Good vibes. Your space.')}
      <div class="dashboard-grid doors" role="group" aria-label="Who's signing in?">
        <button class="action-card friends door" data-act="door" data-door="parent" aria-pressed="${parent}">
          <span class="action-icon" aria-hidden="true">👨‍👩‍👧</span><span class="action-label">I'm a parent<span class="action-arrow" aria-hidden="true">→</span></span></button>
        <button class="action-card chat door" data-act="door" data-door="kid" aria-pressed="${!parent}">
          <span class="action-icon" aria-hidden="true">🧢</span><span class="action-label">I'm a kid<span class="action-arrow" aria-hidden="true">→</span></span></button>
      </div>
      ${form}
      <div class="auth-style">${stylePicker()}</div>
    </div>`;
  }
  function renderSignup() {
    return `<form class="panel stack" data-form="signup" autocomplete="on">
      <h2>Create a parent account</h2>
      <p class="small muted">You'll create your kid's account next — kids can't sign up on their own.</p>
      <label class="fld"><span>Your name</span><input class="field" name="name" autocomplete="name" required></label>
      <label class="fld"><span>Username</span><input class="field" name="username" autocomplete="username" autocapitalize="none" required></label>
      <label class="fld"><span>Password (8+ characters)</span><input class="field" name="password" type="password" autocomplete="new-password" minlength="8" required></label>
      <label class="fld"><span>Mobile number (optional, for text alerts)</span><input class="field" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(605) 555-0123"></label>
      <label class="check"><input type="checkbox" name="sms_opt_in"><span>Text me approvals, check-ins, pickups and "I'm Ready!" alerts. Msg &amp; data rates may apply. Reply STOP to opt out.</span></label>
      <p class="form-error" data-err role="alert"></p>
      <button class="primary-button block big" type="submit">Create account</button>
      <p class="center small"><button type="button" class="linkish" data-act="auth-mode" data-mode="login">Back to sign in</button></p>
    </form>`;
  }
  function renderRecover() {
    return `<form class="panel stack" data-form="recover">
      <h2>Reset your password</h2>
      <p class="small muted">Use the recovery code you saved when you created your account.</p>
      <label class="fld"><span>Username</span><input class="field" name="username" autocapitalize="none" required></label>
      <label class="fld"><span>Recovery code</span><input class="field" name="recovery_code" autocapitalize="characters" placeholder="ABCD-EFGH-JKLM" required></label>
      <label class="fld"><span>New password</span><input class="field" name="new_password" type="password" minlength="8" autocomplete="new-password" required></label>
      <p class="form-error" data-err role="alert"></p>
      <button class="primary-button block big" type="submit">Reset password</button>
      <p class="center small"><button type="button" class="linkish" data-act="auth-mode" data-mode="login">Back to sign in</button></p>
    </form>`;
  }

  // ================================================================ kid onboarding
  function renderOnboarding() {
    const st = S.onboardStep;
    const dots = `<div class="ob-dots" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<i class="${i === st ? 'on' : ''}"></i>`).join('')}</div>`;
    if (st === 0) return `${heroHTML(`Welcome, ${esc(first(S.me.display_name))}!`)}
      <div class="panel stack">${dots}
        <h2>Your space to hang 🙌</h2>
        <p>Chat with friends you know, make plans, check in at the hang house, play games, and tap <b>I'm Ready!</b> when you need your parent.</p>
        <button class="primary-button block big" data-act="ob-next">Let's set you up</button></div>`;
    if (st === 1) return `<div class="panel stack ob-top">${dots}
        <h2>Pick your look</h2>
        <div class="ava-grid" role="radiogroup" aria-label="Avatar">${Object.keys(AVATAR).map((k) => `<button class="ava-pick" role="radio" data-act="ob-ava" data-k="${k}" aria-checked="${S.me.avatar === k}" aria-label="${k}">${ava(k)}</button>`).join('')}</div>
        <label class="fld"><span>Display name (what friends see)</span><input class="field" id="ob-name" maxlength="24" value="${esc(S.me.display_name)}"></label>
        <p class="small muted">Use a first name or nickname — never your last name, school, or address.</p>
        ${stylePicker()}
        <button class="primary-button block big" data-act="ob-save">Next</button></div>`;
    if (st === 2) return `<div class="panel stack ob-top">${dots}
        <h2>Stay safe 🛡️</h2>
        <ul class="rules">
          <li><b>Only add friends you know in real life.</b></li>
          <li><b>Keep it private:</b> no phone numbers, addresses, school names or passwords in chat.</li>
          <li><b>Be kind.</b> Mean words get blocked.</li>
          <li><b>Something feels off?</b> Tap <i>Block</i> or <i>Report</i> and tell a parent.</li>
          <li>Your parent approves new friends and plans, and can see your chats.</li>
        </ul>
        <label class="check"><input type="checkbox" id="ob-agree"><span>I got it!</span></label>
        <button class="primary-button block big" data-act="ob-rules">Next</button></div>`;
    return `<div class="panel stack ob-top center">${dots}
        <h2>Your friend code</h2>
        <p>Share it with friends <b>in person</b> so they can add you.</p>
        <div class="code-box">${esc(S.me.friend_code || '')}</div>
        <button class="primary-button block big" data-act="ob-done">Let's hang!</button></div>`;
  }

  // ================================================================ hangouts (check-in, pickups, walk)
  function pickupBanners(list, forParentHost = false) {
    return (list || []).filter((p) => !p.ack_at && (!forParentHost || p.house_family_id === S.me.family_id && p.from_user !== S.me.id)).map((p) => {
      const mine = isKid() && p.kid_id === S.me.id;
      const eta = p.eta_minutes ? `about ${p.eta_minutes} min away` : 'outside now';
      return `<div class="alert-banner" role="alert"><span class="big-emoji" aria-hidden="true">🚗</span>
        <div class="grow stack-sm">
          <h3>${mine ? `${esc(first(p.from_name))} is coming!` : `Pickup for ${esc(first(p.kid_name))}`}</h3>
          <p>${mine ? `${esc(p.from_name)} is ${eta}. Start packing up!` : `${esc(p.from_name)} is ${eta}${p.house_name ? ` at ${esc(p.house_name)}` : ''}.`}</p>
          ${p.message ? `<p class="muted">"${esc(p.message)}"</p>` : ''}
          <button class="warm-button block" data-act="pickup-ack" data-id="${p.id}">👍 ${mine ? 'Got it!' : `I'll tell ${esc(first(p.kid_name))}`}</button>
        </div></div>`;
    }).join('');
  }
  function kidStayPanel() {
    const h = S.hang;
    if (!h) return '';
    if (h.stay) {
      return `<div class="panel stay-panel in">
        <span class="stay-em" aria-hidden="true">${houseEm(h.stay.house_id)}</span>
        <span class="pill st-approved">📍 Checked in</span>
        <h2>${esc(h.stay.house_name)}</h2>
        <p class="small">Since ${time(h.stay.in_at)}${h.stay.session !== 'other' ? ` · ${h.stay.session} school` : ''}${h.here.length ? ` · with ${h.here.map((k) => esc(first(k.display_name))).join(', ')} 🙌` : ''}</p>
        <button class="ghost-button block" data-act="checkout">Check out ✌️</button></div>`;
    }
    return `<button class="motivation-banner tone-green" data-act="checkin-sheet" data-id="${S.me.id}">
      <p class="motivation-copy">Check in<span class="mb-sub">${h.houses.length ? 'At home or a friend\'s house' : 'Ask a parent to add your house'}</span></p>
      <span class="mb-emoji" aria-hidden="true">📍</span></button>`;
  }
  function walkBanner() {
    const t = S.today;
    if (!t) return '';
    const s = t.schedule, w = t.weather?.morning;
    const line = w ? `Leave ${hm(s.leave)} · ${w.temp}° · ${esc(w.tip.split(' · ')[0])}` : `Leave ${hm(s.leave)} · bell ${hm(s.start)} · out ${hm(s.end)}`;
    return `<button class="motivation-banner" data-act="open" data-view="walk">
      <p class="motivation-copy">${esc(t.day.label)}'s walk<span class="mb-sub">${line}</span></p>
      <span class="mb-emoji" aria-hidden="true">${w ? w.emoji : '🚶'}</span></button>`;
  }
  function wxTile(w, cls, title, when, sub) {
    const band = `<div class="wx-band"><b>${title}</b><span>${when}</span></div>`;
    if (!w) return `<div class="wx ${cls}">${band}<div class="wx-empty">Forecast not available yet</div></div>`;
    return `<div class="wx ${cls}">${band}<div class="wx-body">
        <div class="wx-main"><span class="wx-emoji" aria-hidden="true">${w.emoji}</span><span><b class="wx-temp">${w.temp}°</b><span class="wx-desc">${esc(w.text)}${w.feels !== w.temp ? `<br>feels ${w.feels}°` : ''}</span></span></div>
        <div class="wx-meta">${w.pop >= 10 ? `💧 ${w.pop}%` : '💧 dry'} · 💨 ${w.wind} mph</div>
        <div class="wx-tip">${esc(w.tip)}</div>${sub ? `<div class="wx-sub">${sub}</div>` : ''}</div></div>`;
  }
  function viewWalk() {
    const t = S.today;
    if (!t) return subHeader('Walk') + empty('⏳', 'Loading…');
    const s = t.schedule, w = t.weather || {};
    return `${subHeader(`${esc(t.day.label)}'s walk`)}
      <p class="note">📍 ${esc(t.location)}${t.school_name ? ` · ${esc(t.school_name)}` : ''}</p>
      <div class="wx-grid">
        ${wxTile(w.morning, 'am', 'Walk to school', `Leave ${hm(s.leave)}`, `Be there ${hm(s.arrive)} · bell ${hm(s.start)}`)}
        ${wxTile(w.afternoon, 'pm', 'Walk home', `Out ${hm(s.end)}`, `Home by ~${hm(s.home)}`)}
      </div>
      <div class="subway panel" aria-label="School day timeline"><span class="line" aria-hidden="true"></span>
        ${[[s.leave, 'Leave'], [s.arrive, 'Arrive'], [s.start, 'Bell'], [s.end, 'Out'], [s.home, 'Home']].map(([x, l]) => `<div class="stop"><b>${hm(x)}</b><i></i><span>${l}</span></div>`).join('')}
      </div>
      <p class="walk-note">${s.walk_miles} mi walk ≈ ${s.walk_minutes} min${isKid() ? '' : ' · change times in Account → School day'}</p>
      ${isKid() ? '<button class="warm-button block big" data-act="ride-sheet">🚗 Ask for a ride</button>' : '<button class="ghost-button block" data-act="open" data-view="rides">🚗 Ride requests</button>'}`;
  }

  // ================================================================ KID: home
  function kidHome() {
    const upcoming = (S.plans || []).filter((p) => p.status === 'approved' && new Date(p.starts_at) > new Date(Date.now() - 3600e3));
    const next = upcoming[0];
    const lastReady = S.me.last_ready_at && (Date.now() - new Date(S.me.last_ready_at) < 3 * 60e3);
    const b = S.badges;
    const p0 = parents()[0];
    return `${heroHTML(S.hang?.stay ? `You're at ${esc(S.hang.stay.house_name)}` : 'Real friends. Good vibes. Your space.')}
      ${pickupBanners(S.hang?.pickups)}
      ${rideBanners()}
      ${b.family_messages && p0 ? `<button class="motivation-banner tone-pink" data-act="open" data-view="family" data-id="${p0.id}"><p class="motivation-copy">Message from ${esc(first(p0.display_name))}<span class="mb-sub">Tap to read</span></p><span class="mb-emoji" aria-hidden="true">💌</span></button>` : ''}
      <button class="ready-button ${lastReady ? 'sent' : ''}" data-act="ready" ${lastReady ? 'aria-disabled="true"' : ''}>
        <span class="rb-main">${lastReady ? 'Parent notified ✓' : "I'm Ready!"}</span>
        <span class="rb-sub">${lastReady ? `Sent ${ago(S.me.last_ready_at)} — they know you're ready` : 'Tap to tell your parent'}</span>
      </button>
      ${kidStayPanel()}
      <div class="dashboard-grid">
        ${card('chat', 'tab', '💬', 'Chat', 'data-tab="chat"', b.messages)}
        ${card('friends', 'tab', '🫶', 'Friends', 'data-tab="friends"')}
        ${card('games', 'tab', '🎮', 'Games', 'data-tab="games"')}
        ${card('plan', 'open', '📅', 'Made a Plan', 'data-view="plans"')}
        ${card('profile', 'tab', '😎', 'Profile', 'data-tab="profile"')}
        ${card('settings', 'open', '⚙️', 'Settings', 'data-view="settings"')}
      </div>
      ${walkBanner()}
      ${next ? `<button class="motivation-banner tone-yellow" data-act="open" data-view="plans">
        <p class="motivation-copy">Next hang: ${esc(next.title)}<span class="mb-sub">${whenText(next.starts_at)} · with ${esc(next.members.filter((m) => m.id !== S.me.id).map((m) => first(m.display_name)).join(', '))}</span></p>
        <span class="mb-emoji" aria-hidden="true">🎉</span></button>` : ''}`;
  }

  // ================================================================ KID: chat
  function kidChats() {
    const list = S.chats;
    return `${sectionTitle('Chat', `<button class="warm-button sm" data-act="plan-new">📅 Made a Plan</button>`)}
      <p class="note">🔒 Only approved friends can message you. Your parent can see your chats.</p>
      ${!list ? empty('⏳', 'Loading…') : !list.length ? empty('💬', 'No chats yet. Add a friend to start talking!', '<button class="primary-button" data-act="tab" data-tab="friends" style="margin-top:12px">Add friends</button>')
        : `<div class="panel list">${list.map((c) => `<button class="row-btn" data-act="open" data-view="conv" data-id="${c.friendship_id}">
            ${ava(c.avatar)}<span class="grow"><b>${esc(c.display_name)}</b><span class="sub">${c.last_body ? (c.last_sender === S.me.id ? 'You: ' : '') + esc(c.last_body) : 'Say hi! 👋'}</span></span>
            <span class="meta">${c.last_at ? `<span class="tiny">${ago(c.last_at)}</span>` : ''}${c.unread ? `<span class="unread" aria-label="${c.unread} unread">${c.unread}</span>` : ''}</span></button>`).join('')}</div>`}`;
  }
  async function loadConv(full) {
    const v = S.view;
    if (!v) return;
    if (v.name === 'family') {
      const d = await api(`/family-chat/${v.id}`).catch(() => null);
      if (d && JSON.stringify(d.messages) !== JSON.stringify(S.fam?.messages)) {
        if (!full && S.fam?.messages && d.messages.length > S.fam.messages.length && d.messages[d.messages.length - 1].from_id !== S.me.id) Sound.play('message');
        S.fam = d; if (!full) { const m = $('#msgs'); if (m) { m.innerHTML = famMsgs(); scrollChat(); } } }
      return;
    }
    const lastId = !full && S.conv?.id === v.id && S.conv.messages.length ? S.conv.messages[S.conv.messages.length - 1].id : 0;
    const d = await api(`/chats/${v.id}/messages${lastId ? `?after=${lastId}` : ''}`).catch((e) => { toast(e.message, 'warn'); return null; });
    if (!d) return;
    if (lastId) {
      if (!d.messages.length) return;
      if (d.messages.some((m) => m.sender_id !== S.me.id)) Sound.play('message');
      S.conv.messages = S.conv.messages.concat(d.messages);
      const m = $('#msgs'); if (m) { m.innerHTML = convMsgs(); scrollChat(); }
    } else S.conv = { id: v.id, ...d };
  }
  function convMsgs() {
    const c = S.conv;
    if (!c.messages.length) return `<div class="empty"><div class="e">👋</div><p>Start the conversation!</p></div>`;
    let prevDay = null;
    return c.messages.map((m) => {
      const d = new Date(m.created_at);
      const hdr = !prevDay || !sameDay(prevDay, d) ? `<div class="day-sep">${dayLabel(d)}</div>` : '';
      prevDay = d;
      const mine = isKid() && m.sender_id === S.me.id;
      const who = c.people[m.sender_id];
      return `${hdr}<div class="msg ${mine ? 'mine' : ''}">${!isKid() ? `<div class="who">${esc(who?.display_name || '')}</div>` : ''}
        <div class="bubble">${esc(m.body)}</div><div class="time">${time(m.created_at)}</div></div>`;
    }).join('');
  }
  function viewConversation() {
    const c = S.conv && S.conv.id === S.view.id ? S.conv : null;
    if (!c) return subHeader('Chat') + empty('⏳', 'Loading…');
    const other = isKid() ? Object.values(c.people).find((p) => p.id !== S.me.id) : null;
    const title = isKid() ? esc(other?.display_name) : Object.values(c.people).map((p) => esc(p.display_name)).join(' + ');
    return `${subHeader(`${isKid() ? ava(other?.avatar, 'sm') : ''}<span>${title}</span>`, isKid() && !c.read_only ? `<button class="icon-button" data-act="conv-menu" data-id="${other.id}" aria-label="Block or report">${I.more}</button>` : '')}
      ${isKid() && !c.read_only ? `<button class="plan-cta" data-act="plan-new" data-friend="${other.id}"><span aria-hidden="true">📅</span> Made a Plan with ${esc(first(other.display_name))}</button>` : ''}
      ${!isKid() ? '<p class="note">👀 Read-only view of your kid\'s chat.</p>' : c.read_only ? '<p class="note">This chat is closed.</p>' : ''}
      <div class="msgs" id="msgs" aria-live="polite">${convMsgs()}</div>
      ${isKid() && !c.read_only ? `<div class="chat-pad"></div>
      <form class="composer" data-form="msg">
        <label class="sr" for="msg-input">Message</label>
        <textarea id="msg-input" class="field" name="body" rows="1" maxlength="500" placeholder="Message ${esc(first(other.display_name))}…" enterkeyhint="send"></textarea>
        <button class="primary-button" type="submit" aria-label="Send">${I.send}</button>
      </form>` : ''}`;
  }
  function scrollChat(force) {
    if (!$('#msgs')) return;
    const near = innerHeight + scrollY > document.body.scrollHeight - 260;
    if (force || near) requestAnimationFrame(() => scrollTo(0, document.body.scrollHeight));
  }
  function famMsgs() {
    const f = S.fam;
    if (!f?.messages.length) return `<div class="empty"><div class="e">💌</div><p>No messages yet.</p></div>`;
    return f.messages.map((m) => `<div class="msg ${m.from_id === S.me.id ? 'mine' : 'parent'}"><div class="bubble">${esc(m.body)}</div><div class="time">${ago(m.created_at)}</div></div>`).join('');
  }
  function viewFamilyChat() {
    const f = S.fam && S.fam.other?.id === S.view.id ? S.fam : null;
    if (!f) return subHeader('Messages') + empty('⏳', 'Loading…');
    const phone = f.other.phone;
    return `${subHeader(`${ava(f.other.avatar, 'sm')}<span>${esc(f.other.display_name)}</span>`, phone ? `<a class="icon-button" href="sms:${esc(phone)}" aria-label="Text ${esc(first(f.other.display_name))} from your phone">📱</a>` : '')}
      ${isKid() ? `<div class="quick-row">${["I'm ready!", 'Can you pick me up?', 'On my way 🚶', 'Can I stay longer?'].map((t) => `<button class="chip" data-act="fam-quick" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="msgs" id="msgs" aria-live="polite">${famMsgs()}</div>
      <div class="chat-pad"></div>
      <form class="composer" data-form="fam">
        <label class="sr" for="msg-input">Message</label>
        <textarea id="msg-input" class="field" name="body" rows="1" maxlength="500" placeholder="Message ${esc(first(f.other.display_name))}…"></textarea>
        <button class="primary-button" type="submit" aria-label="Send">${I.send}</button>
      </form>`;
  }

  // ================================================================ KID: friends
  function kidFriends() {
    const f = S.friends;
    if (!f) return sectionTitle('Friends') + empty('⏳', 'Loading…');
    const row = (it, actions) => `<div class="row-btn static">${ava(it.kid.avatar)}<span class="grow"><b>${esc(it.kid.display_name)}</b></span>${actions}</div>`;
    return `${sectionTitle('Friends')}
      <div class="panel stack tone-yellow">
        <h3>Your friend code</h3>
        <div class="code-row"><div class="code-box">${esc(S.me.friend_code)}</div><button class="ghost-button sm" data-act="share-code">Share</button></div>
        <p class="small muted">Only share your code with friends you know in real life.</p>
      </div>
      <form class="panel stack" data-form="add-friend">
        <h3>Add a friend</h3>
        <label class="fld"><span>Their friend code</span><input class="field code-input" name="code" placeholder="HANG-1234" autocapitalize="characters" autocomplete="off" required></label>
        <p class="form-error" data-err role="alert"></p>
        <button class="primary-button block" type="submit">Send friend request</button>
      </form>
      ${f.incoming.length ? `${sectionTitle('Requests')}<div class="panel list">${f.incoming.map((it) => row(it, `<span class="row-actions">
          <button class="primary-button sm" data-act="friend-respond" data-id="${it.friendship_id}" data-v="1">Accept</button>
          <button class="ghost-button sm" data-act="friend-respond" data-id="${it.friendship_id}" data-v="0">Decline</button></span>`)).join('')}</div>` : ''}
      ${f.awaiting_parent.length || f.outgoing.length ? `${sectionTitle('Waiting')}<div class="panel list">
          ${f.awaiting_parent.map((it) => row(it, '<span class="pill st-waiting">Parents approving</span>')).join('')}
          ${f.outgoing.map((it) => row(it, `<span class="pill">Request sent</span><button class="ghost-button sm" data-act="friend-remove" data-id="${it.friendship_id}" aria-label="Cancel request">✕</button>`)).join('')}
        </div>` : ''}
      ${sectionTitle(`My friends${f.friends.length ? ` (${f.friends.length})` : ''}`)}
      ${f.friends.length ? `<div class="panel list">${f.friends.map((it) => row(it, `<span class="row-actions">
          <button class="ghost-button sm" data-act="open" data-view="conv" data-id="${it.friendship_id}" aria-label="Message ${esc(it.kid.display_name)}">💬</button>
          <button class="ghost-button sm" data-act="friend-menu" data-id="${it.friendship_id}" data-kid="${it.kid.id}" data-name="${esc(it.kid.display_name)}" aria-label="More for ${esc(it.kid.display_name)}">${I.more}</button></span>`)).join('')}</div>`
        : empty('🫶', 'No friends yet. Trade codes with someone you know!')}`;
  }

  // ================================================================ KID: games
  const WYR = [
    ['Have a pet dragon 🐉', 'Have a pet unicorn 🦄'], ['Only eat pizza 🍕', 'Only eat tacos 🌮'], ['Fly ✈️', 'Be invisible 👻'],
    ['Live at the beach 🏖️', 'Live in the mountains 🏔️'], ['Talk to animals 🐶', 'Speak every language 🌍'], ['Have no homework ever 📚', 'Have summer all year ☀️'],
    ['Be a famous singer 🎤', 'Be a pro athlete 🏀'], ['Time travel to the past ⏳', 'Time travel to the future 🚀'], ['Ice cream for breakfast 🍦', 'Pancakes for dinner 🥞'],
    ['Have a robot best friend 🤖', 'Have a secret treehouse 🌳'],
  ];
  const IDEAS = ['Bake cookies together 🍪', 'Make up a dance routine 💃', 'Build a blanket fort 🏰', 'Have a board game tournament 🎲', 'Bike to the park 🚲',
    'Paint rocks and hide them 🎨', 'Movie marathon + popcorn 🍿', 'Have a backyard picnic 🧺', 'Learn a new card game 🃏', 'Make friendship bracelets 💜', 'Shoot hoops 🏀', 'Have a karaoke night 🎤'];
  const MEMO = ['🦄', '🍕', '🎮', '🌈', '⚡', '🐸'];
  function kidGames() {
    if (S.game === 'memory') return gameMemory();
    if (S.game === 'ttt') return gameTTT();
    if (S.game === 'wyr') return gameWYR();
    if (S.game === 'ideas') return gameIdeas();
    return `${sectionTitle('Games')}
      <div class="dashboard-grid">
        ${card('games', 'game', '🧠', 'Memory Match', 'data-g="memory"')}
        ${card('chat', 'game', '❌', 'Tic-Tac-Toe', 'data-g="ttt"')}
        ${card('profile', 'game', '🤔', 'Would You Rather', 'data-g="wyr"')}
        ${card('plan', 'game', '💡', 'Hang Ideas', 'data-g="ideas"')}
      </div>
      <p class="note">Games are just for you — no chatting with strangers here. 🎮</p>`;
  }
  const gameShell = (title, inner) => `<div class="subhead"><button class="icon-button" data-act="game" data-g="" aria-label="Back to games">${I.back}</button><h2>${title}</h2></div>${inner}`;
  function newMemory() { S.mem = { deck: [...MEMO, ...MEMO].map((e, i) => ({ e, id: i })).sort(() => Math.random() - .5), open: [], done: new Set(), moves: 0, best: store.get('lh_mem_best', null), lock: false }; }
  function gameMemory() {
    if (!S.mem) newMemory();
    const m = S.mem, won = m.done.size === m.deck.length;
    return gameShell('Memory Match', `<div class="panel stack">
      <div class="row spread"><span class="pill">Moves: ${m.moves}</span>${m.best ? `<span class="pill st-approved">Best: ${m.best}</span>` : ''}</div>
      <div class="memo-grid">${m.deck.map((c, i) => { const up = m.open.includes(i) || m.done.has(i); return `<button class="memo ${up ? 'up' : ''} ${m.done.has(i) ? 'done' : ''}" data-act="memo" data-i="${i}" aria-label="${up ? c.e : 'Hidden card'}" ${m.done.has(i) ? 'disabled' : ''}>${up ? c.e : '?'}</button>`; }).join('')}</div>
      ${won ? `<p class="center big-win">You won in ${m.moves} moves! 🎉</p>` : ''}
      <button class="ghost-button block" data-act="memo-reset">${won ? 'Play again' : 'Restart'}</button></div>`);
  }
  function tttWinner(b) {
    for (const [a, c, d] of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    return b.every(Boolean) ? 'draw' : null;
  }
  function tttCpu(b) {
    const free = b.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    for (const who of ['O', 'X']) for (const i of free) { const t = [...b]; t[i] = who; if (tttWinner(t) === who) return i; }
    if (!b[4]) return 4;
    const corners = [0, 2, 6, 8].filter((i) => !b[i]);
    return corners.length ? pick(corners) : pick(free);
  }
  function gameTTT() {
    if (!S.ttt) S.ttt = { b: Array(9).fill(null), score: store.get('lh_ttt', { w: 0, l: 0, d: 0 }) };
    const t = S.ttt, w = tttWinner(t.b);
    const msg = w === 'X' ? 'You win! 🎉' : w === 'O' ? 'Computer wins 🤖' : w === 'draw' ? "It's a tie!" : 'Your turn — you are ❌';
    return gameShell('Tic-Tac-Toe', `<div class="panel stack">
      <div class="row spread"><span class="pill st-approved">W ${t.score.w}</span><span class="pill">T ${t.score.d}</span><span class="pill st-declined">L ${t.score.l}</span></div>
      <p class="center" aria-live="polite"><b>${msg}</b></p>
      <div class="ttt-grid">${t.b.map((v, i) => `<button class="ttt ${v ? 'v' + v : ''}" data-act="ttt" data-i="${i}" ${v || w ? 'disabled' : ''} aria-label="${v || 'Empty square ' + (i + 1)}">${v === 'X' ? '❌' : v === 'O' ? '⭕' : ''}</button>`).join('')}</div>
      <button class="ghost-button block" data-act="ttt-reset">New game</button></div>`);
  }
  function gameWYR() {
    if (S.wyr == null) S.wyr = { i: Math.floor(Math.random() * WYR.length), choice: null };
    const [a, b] = WYR[S.wyr.i];
    return gameShell('Would You Rather', `<div class="panel stack center">
      <h3>Would you rather…</h3>
      <button class="wyr ${S.wyr.choice === 0 ? 'on' : ''}" data-act="wyr" data-c="0">${esc(a)}</button>
      <span class="or">OR</span>
      <button class="wyr alt ${S.wyr.choice === 1 ? 'on' : ''}" data-act="wyr" data-c="1">${esc(b)}</button>
      ${S.wyr.choice !== null ? `<p aria-live="polite">${pick(['Great pick! 🔥', 'Same! 🙌', 'Ooh, bold choice 😎', 'Love that 💜'])}</p>` : ''}
      <button class="primary-button block" data-act="wyr-next">Next question</button></div>`);
  }
  function gameIdeas() {
    if (!S.idea) S.idea = pick(IDEAS);
    return gameShell('Hang Ideas', `<div class="panel stack center">
      <p class="idea">${esc(S.idea)}</p>
      <button class="ghost-button block" data-act="idea-next">🎲 Another idea</button>
      <button class="warm-button block" data-act="plan-new" data-title="${esc(S.idea.replace(/\s\S+$/u, ''))}">📅 Make it a plan</button></div>`);
  }

  // ================================================================ KID: profile + settings
  function kidProfile() {
    const ps = parents();
    return `${sectionTitle('Profile')}
      <div class="panel stack center tone-pink">
        <div class="ava-xl-wrap">${ava(S.me.avatar, 'xl')}</div>
        <h2>${esc(S.me.display_name)}</h2>
        <p class="small muted">@${esc(S.me.username)}</p>
        <div class="row center-row"><button class="ghost-button sm" data-act="edit-profile">✏️ Edit profile</button></div>
      </div>
      ${stylePicker()}
      <div class="panel stack tone-yellow">
        <h3>Friend code</h3>
        <div class="code-row"><div class="code-box">${esc(S.me.friend_code)}</div><button class="ghost-button sm" data-act="new-code">New code</button></div>
        <p class="small muted">Getting a new code means old copies stop working.</p>
      </div>
      <div class="panel stack">
        <h3>My parent${ps.length > 1 ? 's' : ''}</h3>
        ${ps.map((p) => `<div class="row-btn static">${ava(p.avatar)}<span class="grow"><b>${esc(p.display_name)}</b><span class="sub">Connected</span></span>
          <span class="row-actions"><button class="ghost-button sm" data-act="open" data-view="family" data-id="${p.id}">💬 Message</button>
          ${p.phone ? `<a class="ghost-button sm" href="sms:${esc(p.phone)}">📱 Text</a>` : ''}</span></div>`).join('')}
      </div>
      <div class="dashboard-grid">
        ${card('plan', 'open', '📅', 'My plans', 'data-view="plans"')}
        ${card('settings', 'open', '⚙️', 'Settings', 'data-view="settings"')}
      </div>`;
  }
  function viewKidSettings() {
    const p = S.me.notify_prefs || {};
    const tog = (k, label) => `<label class="switch-row"><span>${label}</span><input type="checkbox" role="switch" data-act="pref" data-k="${k}" ${p[k] !== false ? 'checked' : ''}></label>`;
    return `${subHeader('Settings')}
      ${stylePicker()}
      ${soundPanel()}
      <div class="panel stack"><h3>Notifications</h3>${tog('messages', 'New messages')}${tog('friends', 'Friend requests')}${tog('plans', 'Plan updates')}</div>
      <div class="panel stack tone-pink"><h3>Safety</h3>
        <p class="small">If anyone makes you feel uncomfortable: <b>Block</b> or <b>Report</b> them from the chat ⋯ menu, and tell a parent.</p>
        <div id="blocked-list" class="list"></div>
        <button class="ghost-button block" data-act="load-blocked">Show blocked people</button>
      </div>
      <form class="panel stack" data-form="kid-pin"><h3>Change PIN</h3>
        <label class="fld"><span>Current PIN</span><input class="field" name="current_password" type="password" required autocomplete="current-password"></label>
        <label class="fld"><span>New PIN (4+)</span><input class="field" name="new_password" type="password" minlength="4" required autocomplete="new-password"></label>
        <p class="form-error" data-err role="alert"></p>
        <button class="primary-button block" type="submit">Save PIN</button></form>
      <button class="danger-button block" data-act="logout">Log out</button>`;
  }

  // ================================================================ plans + calendar
  function calendarHTML(plans) {
    const m = S.calMonth, start = new Date(m); start.setDate(1 - m.getDay());
    const byDay = {};
    plans.filter((p) => p.status === 'approved').forEach((p) => { const k = dayKey(new Date(p.starts_at)); byDay[k] = (byDay[k] || 0) + 1; });
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (i === 35 && d.getMonth() !== m.getMonth()) break;
      const n = byDay[dayKey(d)] || 0;
      cells += `<button class="cal-day ${d.getMonth() !== m.getMonth() ? 'other' : ''} ${sameDay(d, new Date()) ? 'today' : ''}" data-act="cal-day" data-d="${d.toISOString()}"
        aria-pressed="${S.calDay && sameDay(S.calDay, d) ? 'true' : 'false'}" aria-label="${d.toDateString()}${n ? `, ${n} plan${n > 1 ? 's' : ''}` : ''}">${d.getDate()}${n ? '<span class="marks"><i></i></span>' : ''}</button>`;
    }
    return `<div class="panel"><div class="cal-head">
        <button class="icon-button" data-act="cal-prev" aria-label="Previous month">${I.left}</button>
        <h2>${m.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
        <button class="icon-button" data-act="cal-next" aria-label="Next month">${I.right}</button></div>
      <div class="cal-grid">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('')}${cells}</div></div>`;
  }
  function planCard(p, { approve = false } = {}) {
    const others = p.members.filter((m) => !(isKid() && m.id === S.me.id));
    const mine = isKid() && p.proposer_id === S.me.id;
    const canCancel = (mine || (!isKid() && p.members.some((m) => m.my_family && m.id === p.proposer_id))) && ['waiting', 'approved'].includes(p.status);
    const myKidsWaiting = approve ? p.members.filter((m) => m.my_family && m.parent_status === 'waiting') : [];
    const d = new Date(p.starts_at);
    return `<div class="panel plan-card st-${p.status}">
      <div class="row" style="align-items:flex-start">
        <div class="date-badge"><span>${d.toLocaleDateString([], { month: 'short' })}</span><b>${d.getDate()}</b></div>
        <div class="grow stack-sm">
          <div class="row spread wrap"><span class="when">${whenText(p.starts_at)}</span>${statusPill(p.status)}</div>
          <h3>${esc(p.title)}</h3>
          <p class="small">With ${others.map((m) => `${esc(first(m.display_name))}${!isKid() || p.status === 'waiting' ? ` <span class="ps ps-${m.parent_status}" title="Parent ${m.parent_status}">${m.parent_status === 'approved' ? '✓' : m.parent_status === 'declined' ? '✖' : '…'}</span>` : ''}`).join(', ')}</p>
          ${p.location ? `<p class="small muted">📍 ${esc(p.location)}</p>` : ''}
          ${p.details ? `<p class="small muted">${esc(p.details)}</p>` : ''}
        </div>
      </div>
      ${myKidsWaiting.map((k) => `<div class="approve-row"><span class="small">For <b>${esc(first(k.display_name))}</b>:</span>
        <button class="primary-button go sm" data-act="plan-decide" data-id="${p.id}" data-kid="${k.id}" data-v="1">Approve</button>
        <button class="danger-button sm" data-act="plan-decide" data-id="${p.id}" data-kid="${k.id}" data-v="0">Decline</button></div>`).join('')}
      ${canCancel && !approve ? `<button class="linkish small danger-link" data-act="plan-cancel" data-id="${p.id}">Cancel plan</button>` : ''}
    </div>`;
  }
  function plansLists(plans) {
    const upcoming = plans.filter((p) => new Date(p.starts_at) > new Date(Date.now() - 3600e3));
    let approved = upcoming.filter((p) => p.status === 'approved');
    if (S.calDay) approved = plans.filter((p) => p.status === 'approved' && sameDay(new Date(p.starts_at), S.calDay));
    const waiting = upcoming.filter((p) => p.status === 'waiting');
    const closed = upcoming.filter((p) => p.status === 'declined' || p.status === 'cancelled');
    return `${sectionTitle(S.calDay ? dayLabel(S.calDay) : 'Confirmed', S.calDay ? '<button class="linkish small" data-act="cal-clear">Show all</button>' : '')}
      ${approved.length ? approved.map((p) => planCard(p)).join('') : empty('📅', S.calDay ? 'No confirmed plans this day.' : 'No confirmed plans yet.')}
      ${waiting.length ? sectionTitle('Waiting for parents') + waiting.map((p) => planCard(p, { approve: !isKid() })).join('') : ''}
      ${closed.length ? sectionTitle('Not happening') + closed.map((p) => planCard(p)).join('') : ''}`;
  }
  function viewPlans() {
    if (!S.plans) return subHeader('Made a Plan') + empty('⏳', 'Loading…');
    return `${subHeader('Made a Plan')}
      <button class="warm-button block big" data-act="plan-new">📅 Make a new plan</button>
      <p class="note">Plans are confirmed only after every kid's parent approves.</p>
      ${calendarHTML(S.plans)}${plansLists(S.plans)}`;
  }
  function sheetPlan(friendId, title = '') {
    const fr = S.friends?.friends || [];
    if (!fr.length) { toast('Add a friend first — then you can make plans!'); go('friends'); return; }
    const tomorrow = new Date(Date.now() + 864e5);
    openSheet(`<form data-form="plan" class="stack">
      <h2>Made a Plan 📅</h2>
      <fieldset class="stack-sm"><span>Who? (required)</span>
        <div class="chips" role="group">${fr.map((f) => `<button type="button" class="chip" data-act="toggle-chip" data-v="${f.kid.id}" aria-pressed="${f.kid.id === friendId}">${AVATAR[f.kid.avatar]?.[0] || ''} ${esc(f.kid.display_name)}</button>`).join('')}</div>
      </fieldset>
      <div class="row">
        <label class="fld grow"><span>Date (required)</span><input class="field" type="date" name="date" min="${localDate()}" value="${localDate(tomorrow)}" required></label>
        <label class="fld grow"><span>Time (required)</span><input class="field" type="time" name="time" value="15:30" required></label>
      </div>
      <label class="fld"><span>What are you doing?</span><input class="field" name="title" maxlength="60" placeholder="Hang out" value="${esc(title)}"></label>
      <label class="fld"><span>Where? (optional)</span><input class="field" name="location" maxlength="80" placeholder="Maya's house, the park…"></label>
      <label class="fld"><span>Details (optional)</span><textarea class="field" name="details" maxlength="300" placeholder="Bring snacks!"></textarea></label>
      <p class="small muted">Your parent (and your friend's parent) will get a notification to approve.</p>
      <p class="form-error" data-err role="alert"></p>
      <button class="warm-button block big" type="submit">Send for approval</button>
      <button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button>
    </form>`);
  }

  // ================================================================ rides (rain/snow pickup + drop-off)
  const RIDE_EM = { rain: '🌧️', snow: '🌨️', storm: '⛈️', cold: '🥶', other: '🚗' };
  const RIDE_WORD = { rain: 'Rain', snow: 'Snow', storm: 'Storms', cold: 'Freezing cold', other: '' };
  const rideKindTxt = (k) => (k === 'dropoff' ? 'Drop-off' : 'Pickup');
  /** What today's forecast suggests: { kind, reason, when } or null. */
  function rideHint() {
    const t = S.today; if (!t?.weather) return null;
    const now = new Date(), today = t.day.date === localDate(now);
    const mins = now.getHours() * 60 + now.getMinutes(), toM = (x) => { const [h, m] = x.split(':').map(Number); return h * 60 + m; };
    const am = t.weather.morning, pm = t.weather.afternoon;
    if (am?.ride && (!today || mins < toM(t.schedule.leave))) return { kind: 'dropoff', reason: am.ride, w: am, time: t.schedule.leave };
    if (pm?.ride && (!today || mins < toM(t.schedule.end) + 30)) return { kind: 'pickup', reason: pm.ride, w: pm, time: t.schedule.end };
    return null;
  }
  function rideCard(r) {
    const mine = isKid() && r.requested_by === S.me.id, myKids = !isKid() && r.my_kids.length;
    const driving = r.status === 'claimed' && r.claimed_by === S.me.id;
    const pill = r.status === 'claimed' ? `<span class="pill st-approved">🚗 ${driving ? "You're driving" : `${esc(first(r.claimed_by_name))} is driving`}</span>`
      : r.status === 'cancelled' ? '<span class="pill st-declined">Cancelled</span>' : '<span class="pill st-waiting">⏳ Needs a driver</span>';
    return `<div class="panel ride-card stack-sm ${r.status === 'open' ? 'tone-yellow' : ''}">
      <div class="row"><span class="ride-em" aria-hidden="true">${RIDE_EM[r.reason] || '🚗'}</span><div class="grow">
        <h3>${rideKindTxt(r.kind)} · ${whenText(r.starts_at)}</h3>
        <p class="small">${esc(r.from_place)} → ${esc(r.to_place)}</p></div></div>
      <div class="row wrap small-gap">${pill}${RIDE_WORD[r.reason] ? `<span class="pill">${RIDE_EM[r.reason]} ${RIDE_WORD[r.reason]}</span>` : ''}</div>
      <p class="small">Riders: ${r.riders.map((k) => `${AVATAR[k.avatar]?.[0] || ''} ${esc(first(k.display_name))}`).join(', ')} <span class="muted">· asked by ${esc(first(r.requested_by_name))}</span></p>
      ${r.note ? `<p class="small muted">“${esc(r.note)}”</p>` : ''}
      ${r.status === 'claimed' && !driving && r.claimed_by_phone && !isKid() ? `<a class="ghost-button sm" href="sms:${esc(r.claimed_by_phone)}">📱 Text ${esc(first(r.claimed_by_name))}</a>` : ''}
      ${r.status === 'cancelled' ? '' : `<div class="row wrap">
        ${myKids && r.status === 'open' ? `<button class="warm-button" data-act="ride-claim" data-id="${r.id}">🚗 I've got it!</button>` : ''}
        ${driving ? `<button class="ghost-button sm" data-act="ride-unclaim" data-id="${r.id}">Can't make it</button>` : ''}
        ${mine || myKids ? `<button class="ghost-button sm" data-act="ride-cancel" data-id="${r.id}">Cancel ride</button>` : ''}</div>`}
    </div>`;
  }
  /** Home-screen banners: rides in progress first, else a weather nudge (kids). */
  function rideBanners() {
    const rides = (S.rides || []).filter((r) => r.status !== 'cancelled');
    if (rides.length) {
      if (isKid()) return rides.slice(0, 2).map((r) => `<button class="motivation-banner ${r.status === 'claimed' ? 'tone-green' : 'tone-yellow'}" data-act="open" data-view="rides">
        <p class="motivation-copy">${r.status === 'claimed' ? `${esc(first(r.claimed_by_name))} is driving!` : 'Asking parents for a ride…'}<span class="mb-sub">${rideKindTxt(r.kind)} · ${whenText(r.starts_at)} · ${esc(r.from_place)} → ${esc(r.to_place)}</span></p>
        <span class="mb-emoji" aria-hidden="true">${r.status === 'claimed' ? '🚗' : '⏳'}</span></button>`).join('');
      const open = rides.filter((r) => r.status === 'open' && r.my_kids.length);
      return open.map(rideCard).join('') + rides.filter((r) => r.status === 'claimed').slice(0, 2).map((r) => `<button class="motivation-banner tone-green" data-act="open" data-view="rides">
        <p class="motivation-copy">${r.claimed_by === S.me.id ? "You're driving" : `${esc(first(r.claimed_by_name))} is driving`}<span class="mb-sub">${rideKindTxt(r.kind)} · ${whenText(r.starts_at)} · ${esc(r.riders.map((k) => first(k.display_name)).join(', '))}</span></p>
        <span class="mb-emoji" aria-hidden="true">🚗</span></button>`).join('');
    }
    const h = isKid() && rideHint();
    if (!h) return '';
    return `<button class="motivation-banner tone-blue ride-ask" data-act="ride-sheet" data-kind="${h.kind}" data-reason="${h.reason}">
      <p class="motivation-copy">${RIDE_WORD[h.reason]} at ${h.kind === 'pickup' ? 'pickup' : 'walk'} time<span class="mb-sub">${h.w.temp}° · ${esc(h.w.text)} · Tap to ask the parents for a ${h.kind === 'pickup' ? 'ride home' : 'ride to school'}</span></p>
      <span class="mb-emoji" aria-hidden="true">${RIDE_EM[h.reason]}</span></button>`;
  }
  function viewRides() {
    const list = S.rides;
    return `${subHeader('Rides 🚗', isKid() ? '<button class="warm-button sm" data-act="ride-sheet">+ Ask for a ride</button>' : '')}
      <p class="note">${isKid() ? "Rain, snow or just too cold? Ask for a pickup or drop-off — every rider's parents get asked, and the first one to say yes drives." : "When the kids ask for a ride, the first parent to tap “I've got it” drives — everyone else gets told."}</p>
      ${!list ? empty('⏳', 'Loading…') : !list.length ? empty('🚗', 'No rides coming up.', isKid() ? '<button class="primary-button" data-act="ride-sheet" style="margin-top:12px">Ask for a ride</button>' : '') : list.map(rideCard).join('')}`;
  }
  async function sheetRide(kind, reason) {
    if (!S.friends) S.friends = await api('/friends').catch(() => null);
    if (!S.today) S.today = await api('/today').catch(() => null);
    const h = rideHint();
    kind = kind || h?.kind || 'pickup'; reason = reason || h?.reason || 'other';
    const t = S.today, s = t?.schedule || { end: '15:50', leave: '08:20' };
    const school = t?.school_name || 'School';
    const here = S.hang?.stay?.house_name;
    const date = t?.day?.date || localDate();
    const fr = S.friends?.friends || [];
    const pre = (S.hang?.here || []).map((k) => k.id);
    openSheet(`<form data-form="ride" class="stack"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="reason" value="${reason}">
      <h2>Ask for a ride ${RIDE_EM[reason] || '🚗'}</h2>
      ${h ? `<p class="note">${h.w.emoji} ${esc(h.w.text)} · ${h.w.temp}° (feels ${h.w.feels}°) · 💧 ${h.w.pop}%</p>` : ''}
      <div class="chips seg" role="radiogroup" aria-label="Pickup or drop-off">
        <button type="button" class="chip" data-act="ride-kind" data-k="pickup" aria-pressed="${kind === 'pickup'}">🏫→🏠 Pickup</button>
        <button type="button" class="chip" data-act="ride-kind" data-k="dropoff" aria-pressed="${kind === 'dropoff'}">🏠→🏫 Drop-off</button></div>
      <div class="row">
        <label class="fld grow"><span>Day</span><input class="field" type="date" name="date" min="${localDate()}" value="${date}" required></label>
        <label class="fld grow"><span>Time</span><input class="field" type="time" name="time" value="${kind === 'pickup' ? s.end : s.leave}" required></label></div>
      <label class="fld"><span>From</span><input class="field" name="from_place" maxlength="80" value="${esc(kind === 'pickup' ? school : here || 'Home')}" required></label>
      <label class="fld"><span>To</span><input class="field" name="to_place" maxlength="80" value="${esc(kind === 'pickup' ? here || 'Home' : school)}" required></label>
      ${fr.length ? `<fieldset class="stack-sm"><span>Who else needs the ride?</span>
        <div class="chips" role="group">${fr.map((f) => `<button type="button" class="chip" data-act="toggle-chip" data-v="${f.kid.id}" aria-pressed="${pre.includes(f.kid.id)}">${AVATAR[f.kid.avatar]?.[0] || ''} ${esc(f.kid.display_name)}</button>`).join('')}</div></fieldset>` : ''}
      <label class="fld"><span>Note (optional)</span><input class="field" name="note" maxlength="160" placeholder="We'll wait by the front doors"></label>
      <p class="small muted">Every rider's parents get asked. The first one to say yes drives, and everyone gets told who's coming.</p>
      <p class="form-error" data-err role="alert"></p>
      <button class="warm-button block big" type="submit">Ask the parents 🚗</button>
      <button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }

  // ================================================================ notifications
  function viewNotifications() {
    const list = S.notes;
    const head = S.view ? subHeader('Notifications', '<button class="linkish small" data-act="read-all">Mark all read</button>')
      : sectionTitle('Alerts', '<button class="linkish small" data-act="read-all">Mark all read</button>');
    const icon = { friend_request: '🫶', friend_accepted: '🤝', friend_approval: '✅', message: '💬', plan_approval: '📅', plan_update: '📅', ready: '🙌', parent_message: '💌', safety: '🛡️', checkin: '📍', pickup: '🚗', ride: '🌧️', ride_update: '🚗' };
    if (!list) return head + empty('⏳', 'Loading…');
    if (!list.length) return head + empty('🔔', "You're all caught up!");
    return head + `<div class="panel list">${list.map((n) => `<button class="row-btn ${n.read_at ? '' : 'unread-row'}" data-act="note" data-id="${n.id}" data-link="${esc(n.link || '')}">
        <span class="feed-icon type-${n.type}" aria-hidden="true">${icon[n.type] || '🔔'}</span>
        <span class="grow"><b>${esc(n.title)}</b>${n.body ? `<span class="sub">${esc(n.body)}</span>` : ''}<span class="tiny">${ago(n.created_at)}</span></span>
        ${n.read_at ? '' : '<span class="dot-new" aria-label="New"></span>'}</button>`).join('')}</div>`;
  }

  // ================================================================ PARENT
  function parentHome() {
    const d = S.dash, h = S.hang;
    const nAppr = d ? d.approvals.friends.length + d.approvals.plans.length : 0;
    const upcoming = d ? d.plans.filter((p) => p.status === 'approved' && new Date(p.starts_at) > new Date()).slice(0, 3) : [];
    const stayOf = (id) => h?.kids.find((k) => k.id === id)?.stay;
    const pendingPickup = (id) => h?.pickups.find((p) => p.kid_id === id && !p.ack_at && p.from_user === S.me.id);
    const ackedPickup = (id) => h?.pickups.find((p) => p.kid_id === id && p.ack_at && Date.now() - new Date(p.ack_at) < 30 * 60e3);
    return `${heroHTML('Parent dashboard')}
      ${pickupBanners(h?.pickups, true)}
      ${rideBanners()}
      ${nAppr ? `<button class="motivation-banner tone-yellow" data-act="tab" data-tab="approvals"><p class="motivation-copy">${nAppr} thing${nAppr > 1 ? 's' : ''} need${nAppr > 1 ? '' : 's'} your OK<span class="mb-sub">Friend requests and plans</span></p><span class="mb-emoji" aria-hidden="true">✋</span></button>` : ''}
      <div class="dashboard-grid">
        ${card('plan', 'tab', '✅', 'Approvals', 'data-tab="approvals"', nAppr)}
        ${card('friends', 'tab', '📅', 'Calendar', 'data-tab="calendar"')}
        ${card('games', 'tab', '🔔', 'Alerts', 'data-tab="alerts"', S.badges.notifications)}
        ${card('settings', 'tab', '⚙️', 'Account', 'data-tab="account"')}
      </div>
      ${walkBanner()}
      ${sectionTitle('Your kids', '<button class="ghost-button sm" data-act="add-kid">+ Add kid</button>')}
      ${!d ? empty('⏳', 'Loading…') : !d.kids.length ? empty('🧢', "Create your kid's account to get started.", '<button class="primary-button" data-act="add-kid" style="margin-top:12px">Add your kid</button>')
        : d.kids.map((k) => {
          const stay = stayOf(k.id), pp = pendingPickup(k.id), ap = ackedPickup(k.id);
          return `<div class="panel kid-panel">
          <div class="row">${ava(k.avatar, 'lg')}<div class="grow"><h3>${esc(k.display_name)}</h3>
            <div class="row wrap small-gap">${stay ? `<span class="pill st-approved">📍 ${esc(stay.house_name)} · ${time(stay.in_at)}</span>` : '<span class="pill">Not checked in</span>'}${k.chat_enabled ? '' : '<span class="pill st-declined">Chat paused</span>'}</div></div></div>
          ${k.last_ready_at && Date.now() - new Date(k.last_ready_at) < 2 * 3600e3 ? `<p class="ready-flag">🙌 Ready! <span class="small">${ago(k.last_ready_at)}</span></p>` : ''}
          ${pp ? `<p class="small"><span class="pill st-waiting">🚗 Heads-up sent ${ago(pp.created_at)} · waiting</span></p>` : ap ? `<p class="small"><span class="pill st-approved">👍 ${esc(first(ap.ack_name || ''))} got your heads-up</span></p>` : ''}
          <div class="kid-actions">
            <button class="warm-button sm" data-act="headsup" data-id="${k.id}">🚗 Heads-up</button>
            ${stay ? `<button class="ghost-button sm" data-act="checkout" data-id="${k.id}">Check out</button>` : `<button class="ghost-button sm" data-act="checkin-sheet" data-id="${k.id}">📍 Check in</button>`}
            <button class="primary-button sm" data-act="open" data-view="family" data-id="${k.id}">💬 Message${k.unread_from ? ` (${k.unread_from})` : ''}</button>
            <button class="ghost-button sm" data-act="open" data-view="kid" data-id="${k.id}">🛡️ Friends &amp; safety</button>
          </div></div>`;
        }).join('')}
      ${h?.at_my_houses?.length ? `${sectionTitle('At our house')}<div class="panel list">${h.at_my_houses.map((c) => `<div class="row-btn static">${ava(c.avatar)}<span class="grow"><b>${esc(c.display_name)}</b><span class="sub">${esc(c.house_name)} · since ${time(c.in_at)}</span></span></div>`).join('')}</div>` : ''}
      ${upcoming.length ? sectionTitle('Coming up') + upcoming.map((p) => planCard(p)).join('') : ''}`;
  }
  function parentApprovals() {
    const d = S.dash;
    if (!d) return sectionTitle('Approvals') + empty('⏳', 'Loading…');
    const fr = d.approvals.friends, pl = d.approvals.plans;
    return `${sectionTitle('Approvals')}
      ${!fr.length && !pl.length ? empty('✅', 'Nothing waiting. Nice!') : ''}
      ${fr.length ? `<h3 class="sub-h">Friend requests</h3>${fr.map((f) => `<div class="panel stack">
          <div class="pair">${ava(f.kid.avatar)}<span class="pair-plus">+</span>${ava(f.friend.avatar)}
            <p class="grow"><b>${esc(f.kid.display_name)}</b> wants to be friends with <b>${esc(f.friend.display_name)}</b></p></div>
          <p class="small muted">${f.other_parent_ok ? "✓ The other kid's parent already approved." : "The other kid's parent also needs to approve."} Make sure your kid knows them in real life.</p>
          <div class="approve-row"><button class="primary-button go sm" data-act="friend-approve" data-id="${f.friendship_id}" data-v="1">Approve</button>
            <button class="danger-button sm" data-act="friend-approve" data-id="${f.friendship_id}" data-v="0">Decline</button></div></div>`).join('')}` : ''}
      ${pl.length ? `<h3 class="sub-h">Plans</h3>${pl.map((p) => planCard(p, { approve: true })).join('')}` : ''}`;
  }
  function parentCalendar() {
    if (!S.dash) return sectionTitle('Calendar') + empty('⏳', 'Loading…');
    return `${sectionTitle('Calendar')}${calendarHTML(S.dash.plans)}${plansLists(S.dash.plans)}`;
  }
  function viewParentKid() {
    const v = S.kidView;
    if (!v || v.kid.id !== S.view.id) return subHeader('Kid') + empty('⏳', 'Loading…');
    const k = v.kid;
    const reasons = { mean: 'Being mean', bullying: 'Bullying', inappropriate: 'Inappropriate', personal_info: 'Asked for personal info', stranger: "Didn't know them", other: 'Other' };
    return `${subHeader(`${ava(k.avatar, 'sm')}<span>${esc(k.display_name)}</span>`)}
      <div class="panel stack"><h3>Controls</h3>
        <label class="switch-row"><span>Chat on</span><input type="checkbox" role="switch" data-act="kid-chat" data-id="${k.id}" ${k.chat_enabled ? 'checked' : ''}></label>
        <div class="row wrap"><button class="ghost-button sm" data-act="kid-edit" data-id="${k.id}">✏️ Name / avatar / PIN</button>
          <button class="ghost-button sm" data-act="open" data-view="family" data-id="${k.id}">💬 Message</button>
          <button class="ghost-button sm" data-act="history" data-id="${k.id}">📍 Check-in history</button></div></div>
      ${sectionTitle('Chats (read-only)')}
      ${S.kidChats?.length ? `<div class="panel list">${S.kidChats.map((c) => `<button class="row-btn" data-act="open" data-view="conv" data-id="${c.friendship_id}">${ava(c.avatar)}<span class="grow"><b>${esc(c.display_name)}</b><span class="sub">${esc(c.last_body || 'No messages yet')}</span></span>${c.last_at ? `<span class="tiny">${ago(c.last_at)}</span>` : ''}</button>`).join('')}</div>` : empty('💬', 'No chats yet.')}
      ${sectionTitle('Friends')}
      ${v.friends.length ? `<div class="panel list">${v.friends.map((f) => `<div class="row-btn static">${ava(f.kid.avatar)}<span class="grow"><b>${esc(f.kid.display_name)}</b><span class="sub">Friends since ${new Date(f.since).toLocaleDateString()}</span></span>
          <button class="ghost-button sm" data-act="friend-remove" data-id="${f.friendship_id}" data-confirm="Remove ${esc(f.kid.display_name)} as a friend?">Remove</button></div>`).join('')}</div>` : empty('🫶', 'No friends yet.')}
      ${v.awaiting_parent.length || v.incoming.length || v.outgoing.length ? `<p class="small muted pad">Pending: ${[...v.awaiting_parent, ...v.incoming, ...v.outgoing].map((f) => esc(f.kid.display_name)).join(', ')}</p>` : ''}
      ${v.blocked.length ? `<p class="small muted pad">Blocked: ${v.blocked.map((b) => esc(b.display_name)).join(', ')}</p>` : ''}
      ${sectionTitle('Safety reports')}
      ${v.reports.length ? `<div class="panel list">${v.reports.map((r) => `<div class="row-btn static"><span class="feed-icon type-safety">🛡️</span><span class="grow"><b>${r.reporter_id === k.id ? `${esc(first(k.display_name))} reported ${esc(r.reported_name)}` : `${esc(r.reporter_name)} reported ${esc(first(k.display_name))}`}</b>
          <span class="sub">${reasons[r.reason] || r.reason}${r.details ? ' — ' + esc(r.details) : ''}</span><span class="tiny">${ago(r.created_at)}</span></span></div>`).join('')}</div>` : empty('🛡️', 'No reports. 👍')}
      <button class="danger-button block" data-act="kid-delete" data-id="${k.id}" data-name="${esc(k.display_name)}">Delete ${esc(first(k.display_name))}'s account &amp; data</button>`;
  }
  function parentAccount() {
    const me = S.family.find((u) => u.id === S.me.id) || S.me;
    const p = S.me.notify_prefs || {};
    const houses = S.hang?.houses || [];
    const t = S.today;
    return `${sectionTitle('Account')}
      <form class="panel stack" data-form="parent-profile"><h3>Your details</h3>
        <label class="fld"><span>Name</span><input class="field" name="display_name" value="${esc(me.display_name)}" maxlength="40" required></label>
        <label class="fld"><span>Mobile number</span><input class="field" name="phone" type="tel" value="${esc(me.phone || '')}" placeholder="(605) 555-0123"></label>
        <label class="check"><input type="checkbox" name="sms_opt_in" ${me.sms_opt_in ? 'checked' : ''}><span>Text me approvals, safety alerts, pickups and "I'm Ready!". Reply STOP to opt out.</span></label>
        <label class="switch-row"><span>Alerts for every check-in / check-out</span><input type="checkbox" role="switch" data-act="pref" data-k="checkins" ${p.checkins !== false ? 'checked' : ''}></label>
        <p class="small muted">${S.smsLive ? '📱 Texting is live.' : '📝 Texting is in practice mode until Twilio is set up — alerts still show in the app.'}</p>
        <p class="form-error" data-err role="alert"></p>
        <div class="row wrap"><button class="primary-button sm" type="submit">Save</button><button type="button" class="ghost-button sm" data-act="sms-test">Send test text</button></div>
      </form>
      ${stylePicker()}
      ${soundPanel()}
      ${sectionTitle('Our hang house', '<button class="ghost-button sm" data-act="house-edit">+ Add</button>')}
      <div class="panel list">${houses.length ? houses.map((hh) => `<div class="row-btn static"><span class="house-em" style="--house:${houseColor(hh.id)}" aria-hidden="true">${houseEm(hh.id)}</span><span class="grow"><b>${esc(hh.name)}</b><span class="sub">${esc(hh.address || 'No address')}</span></span>
          <button class="ghost-button sm" data-act="house-edit" data-id="${hh.id}">Edit</button></div>`).join('') : '<p class="small muted">Add your home so your kids (and their approved friends) can check in when they hang out there.</p>'}</div>
      ${sectionTitle('School day', '<button class="ghost-button sm" data-act="schedule-edit">Edit</button>')}
      <div class="panel stack-sm">${t ? `<p>🚶 Leave ${hm(t.schedule.leave)} · be there ${hm(t.schedule.arrive)} · bell ${hm(t.schedule.start)}</p>
        <p>🎒 Out ${hm(t.schedule.end)} · home ~${hm(t.schedule.home)}</p>
        <p class="small muted">${t.schedule.walk_miles} mi ≈ ${t.schedule.walk_minutes} min walk · weather for ${esc(t.location)}</p>` : '<p class="muted">Loading…</p>'}</div>
      ${sectionTitle('Family', '<button class="ghost-button sm" data-act="add-kid">+ Kid</button>')}
      <div class="panel list">${S.family.map((u) => `<div class="row-btn static">${ava(u.avatar)}<span class="grow"><b>${esc(u.display_name)}</b><span class="sub">${u.role === 'parent' ? 'Parent' : 'Kid'} · @${esc(u.username)}</span></span>
        ${u.role === 'kid' ? `<button class="ghost-button sm" data-act="open" data-view="kid" data-id="${u.id}">Manage</button>` : ''}</div>`).join('')}
        <button class="linkish small" data-act="add-parent">+ Add another parent / guardian</button></div>
      <form class="panel stack" data-form="parent-pw"><h3>Change password</h3>
        <label class="fld"><span>Current password</span><input class="field" name="current_password" type="password" required autocomplete="current-password"></label>
        <label class="fld"><span>New password (8+)</span><input class="field" name="new_password" type="password" minlength="8" required autocomplete="new-password"></label>
        <p class="form-error" data-err role="alert"></p><button class="primary-button sm" type="submit">Update password</button></form>
      <div class="panel stack tone-pink"><h3>Privacy</h3>
        <p class="small">Kids' profiles are private: other kids only see a display name and avatar. No photos, birthdays or locations are stored. House addresses are only shown to your family and your kids' approved friends' families. Chats are deleted after a year, notifications after 60 days.</p>
        <button class="danger-button sm" data-act="delete-family">Delete our family account</button></div>
      <button class="ghost-button block" data-act="logout">Log out</button>`;
  }

  // ================================================================ sheets
  function openSheet(html) {
    $('#modal-root').innerHTML = `<div class="sheet-backdrop" data-act="close-sheet-bg"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
    document.body.style.overflow = 'hidden';
    $('#modal-root .sheet button, #modal-root .sheet input')?.focus({ preventScroll: true });
  }
  function closeSheet() { $('#modal-root').innerHTML = ''; document.body.style.overflow = ''; }
  const avatarPicker = (current) => `<div class="ava-grid" role="radiogroup" aria-label="Avatar">${Object.keys(AVATAR).map((k) => `<button type="button" class="ava-pick" role="radio" data-act="sheet-ava" data-k="${k}" aria-checked="${current === k}" aria-label="${k}">${ava(k)}</button>`).join('')}</div><input type="hidden" name="avatar" value="${current}">`;

  async function sheetCheckin(kidId) {
    const self = isKid() && kidId === S.me.id;
    const kid = self ? S.me : S.family.find((u) => u.id === kidId);
    let houses = [];
    try { houses = (await api(self ? '/houses' : `/houses?kid_id=${kidId}`)).houses; } catch (e) { toast(e.message, 'warn'); return; }
    const sess = defaultSession();
    openSheet(`<form data-form="checkin" class="stack">
      <input type="hidden" name="kid_id" value="${kidId}"><input type="hidden" name="house_id" value=""><input type="hidden" name="session" value="${sess}">
      <h2>${self ? "Where you hangin'?" : `Check in ${esc(first(kid?.display_name))}`}</h2>
      ${houses.length ? `<div class="house-picker" role="radiogroup" aria-label="House">${houses.map((h) => `<button type="button" class="house-opt" role="radio" data-act="pick-house" data-id="${h.id}" aria-checked="false" aria-pressed="false" style="--house:${houseColor(h.id)}">
          <span class="em" aria-hidden="true">${houseEm(h.id)}</span><span><strong>${esc(h.name)}</strong><br><small>${esc(h.family_name)}</small></span></button>`).join('')}</div>
        <div class="chips seg" role="radiogroup" aria-label="When">${[['before', '🌅 Before school'], ['after', '🎒 After school'], ['other', '✨ Other']].map(([k, l]) => `<button type="button" class="chip" data-act="pick-session" data-s="${k}" aria-pressed="${sess === k}">${l}</button>`).join('')}</div>
        <p class="form-error" data-err role="alert"></p>
        <button class="primary-button go block big" type="submit" disabled>Pick a house ☝️</button>`
        : `<p class="muted">No houses yet. A parent can add your home under Account → Our hang house. Friends' houses show up once you're approved friends.</p>`}
      <button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }
  function sheetHeadsUp(kidId) {
    const kid = S.family.find((u) => u.id === kidId);
    const stay = S.hang?.kids.find((k) => k.id === kidId)?.stay;
    const host = stay && stay.house_family_id !== S.me.family_id;
    openSheet(`<form data-form="pickup" class="stack"><input type="hidden" name="kid_id" value="${kidId}">
      <h2>🚗 Heads-up for ${esc(first(kid?.display_name))}</h2>
      <p class="muted">${stay ? `${esc(first(kid.display_name))} is at <b>${esc(stay.house_name)}</b>.` : `${esc(first(kid?.display_name))} isn't checked in anywhere.`}</p>
      <fieldset class="stack-sm"><span>How far away are you?</span>
        <div class="chips" role="radiogroup">${[[0, "I'm outside"], [5, '5 min'], [10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min']].map(([v, l]) => `<button type="button" class="chip" data-act="eta" data-v="${v}" aria-pressed="${S.eta === v}">${l}</button>`).join('')}</div></fieldset>
      <label class="fld"><span>Add a note (optional)</span><input class="field" name="message" maxlength="160" placeholder="Bring your soccer bag!"></label>
      <p class="small muted">Goes to ${esc(first(kid?.display_name))}${host ? ' and the host family (kid + parents)' : ''} in the app${S.smsLive ? ', and by text to anyone with texts on' : ''}.</p>
      <p class="form-error" data-err role="alert"></p>
      <button class="warm-button block big" type="submit">Send heads-up</button>
      <button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }
  async function sheetHistory(kidId) {
    openSheet(`<h2>Check-in history</h2><div id="hist" class="muted">Loading…</div><button type="button" class="ghost-button block" data-act="close-sheet" style="margin-top:16px">Close</button>`);
    try {
      const d = await api(`/checkins?kid_id=${kidId}`);
      $('#hist').innerHTML = d.history.length ? `<div class="list">${d.history.map((h) => `<div class="row-btn static"><span aria-hidden="true">📍</span><span class="grow"><b>${esc(h.house_name)}</b>
        <span class="sub">${dayLabel(new Date(h.in_at))} · ${time(h.in_at)} → ${h.out_at ? time(h.out_at) : 'still there'}</span></span></div>`).join('')}</div>` : '<p>No check-ins yet.</p>';
    } catch (e) { $('#hist').textContent = e.message; }
  }
  function sheetHouse(id) {
    const h = id ? (S.hang?.houses || []).find((x) => x.id === id) : {};
    openSheet(`<form data-form="house" class="stack"><input type="hidden" name="id" value="${id || ''}">
      <h2>${id ? 'Edit house' : 'Add your hang house'}</h2>
      <label class="fld"><span>Name</span><input class="field" name="name" value="${esc(h.name || '')}" placeholder="The Lee House" required></label>
      <label class="fld"><span>Address (optional)</span><input class="field" name="address" value="${esc(h.address || '')}" autocomplete="street-address"></label>
      <label class="fld"><span>House rules / notes</span><textarea class="field" name="notes" maxlength="300" placeholder="Shoes off, snacks in the pantry, homework first!">${esc(h.notes || '')}</textarea></label>
      <p class="small muted">Visible to your family and to families of your kids' approved friends.</p>
      <p class="form-error" data-err role="alert"></p>
      <button class="primary-button block big" type="submit">${id ? 'Save' : 'Add house'}</button>
      ${id ? `<button type="button" class="danger-button block" data-act="house-delete" data-id="${id}">Remove house</button>` : ''}
      <button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }
  function sheetSchedule() {
    const t = S.today;
    if (!t) return;
    const s = t.schedule;
    openSheet(`<form data-form="schedule" class="stack"><h2>School day 🏫</h2>
      <label class="fld"><span>School name (optional)</span><input class="field" name="school_name" value="${esc(t.school_name || '')}"></label>
      <div class="row"><label class="fld grow"><span>Be there by</span><input class="field" type="time" name="school_arrive" value="${s.arrive}" required></label>
        <label class="fld grow"><span>First bell</span><input class="field" type="time" name="school_start" value="${s.start}" required></label></div>
      <label class="fld"><span>Dismissal</span><input class="field" type="time" name="school_end" value="${s.end}" required></label>
      <div class="row"><label class="fld grow"><span>Distance (mi)</span><input class="field" type="number" step="0.1" min="0" name="walk_miles" value="${s.walk_miles}"></label>
        <label class="fld grow"><span>Walk (min)</span><input class="field" type="number" min="0" max="120" name="walk_minutes" value="${s.walk_minutes}"></label></div>
      <label class="fld"><span>Town (for weather)</span><input class="field" name="location_name" value="${esc(t.location)}"></label>
      <p class="form-error" data-err role="alert"></p>
      <button class="primary-button block big" type="submit">Save</button>
      <button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }
  function sheetEditProfile() {
    openSheet(`<form data-form="edit-profile" class="stack"><h2>Edit profile</h2>${avatarPicker(S.me.avatar)}
      <label class="fld"><span>Display name</span><input class="field" name="display_name" maxlength="24" value="${esc(S.me.display_name)}" required></label>
      <p class="small muted">First name or nickname only.</p><p class="form-error" data-err role="alert"></p>
      <button class="primary-button block big" type="submit">Save</button><button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }
  function sheetAddKid() {
    openSheet(`<form data-form="add-kid" class="stack"><h2>Add your kid</h2>${avatarPicker('star')}
      <label class="fld"><span>Display name (first name or nickname)</span><input class="field" name="display_name" maxlength="24" required></label>
      <label class="fld"><span>Username (they sign in with this)</span><input class="field" name="username" autocapitalize="none" required></label>
      <label class="fld"><span>PIN or password (4+)</span><input class="field" name="pin" type="text" autocomplete="off" minlength="4" required></label>
      <label class="check"><input type="checkbox" name="consent" required><span>I'm this child's parent or legal guardian and I agree to them using Let's Hang. I understand I approve their friends and plans and can see their chats.</span></label>
      <p class="form-error" data-err role="alert"></p>
      <button class="primary-button block big" type="submit">Create account</button><button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }
  function sheetEditKid(id) {
    const k = S.family.find((u) => u.id === id) || S.kidView?.kid;
    openSheet(`<form data-form="edit-kid" class="stack"><input type="hidden" name="id" value="${id}"><h2>Edit ${esc(first(k.display_name))}</h2>${avatarPicker(k.avatar)}
      <label class="fld"><span>Display name</span><input class="field" name="display_name" maxlength="24" value="${esc(k.display_name)}" required></label>
      <label class="fld"><span>New PIN (leave blank to keep)</span><input class="field" name="pin" type="text" autocomplete="off" minlength="4"></label>
      <p class="form-error" data-err role="alert"></p>
      <button class="primary-button block big" type="submit">Save</button><button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }
  function sheetAddParent() {
    openSheet(`<form data-form="add-parent" class="stack"><h2>Add a parent / guardian</h2>
      <label class="fld"><span>Name</span><input class="field" name="display_name" required></label>
      <label class="fld"><span>Username</span><input class="field" name="username" autocapitalize="none" required></label>
      <label class="fld"><span>Password (8+)</span><input class="field" name="password" type="text" autocomplete="off" minlength="8" required></label>
      <p class="form-error" data-err role="alert"></p>
      <button class="primary-button block big" type="submit">Add</button><button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }
  function sheetRecovery(code, title = 'Save your recovery code') {
    openSheet(`<div class="stack"><h2>${title}</h2>
      <p>If you ever forget your password, this code lets you reset it. <b>Write it down or screenshot it now</b> — we won't show it again.</p>
      <div class="code-box">${esc(code)}</div><button class="primary-button block big" data-act="close-sheet">I saved it</button></div>`);
  }
  function sheetSafety(kidId, name, friendshipId) {
    openSheet(`<div class="stack"><h2>${esc(name)}</h2>
      ${friendshipId ? `<button class="warm-button block" data-act="plan-new" data-friend="${kidId}">📅 Made a Plan</button>
      <button class="ghost-button block" data-act="friend-remove" data-id="${friendshipId}" data-confirm="Remove ${esc(name)} as a friend?">Remove friend</button>` : ''}
      <button class="ghost-button block" data-act="block" data-id="${kidId}" data-name="${esc(name)}">🚫 Block</button>
      <button class="danger-button block" data-act="report-start" data-id="${kidId}" data-name="${esc(name)}">🛡️ Report</button>
      <button class="ghost-button block" data-act="close-sheet">Close</button></div>`);
  }
  function sheetReport(kidId, name) {
    const reasons = [['mean', 'Being mean'], ['bullying', 'Bullying me'], ['inappropriate', 'Inappropriate stuff'], ['personal_info', 'Asking for personal info'], ['stranger', "I don't know them"], ['other', 'Something else']];
    openSheet(`<form data-form="report" class="stack"><input type="hidden" name="user_id" value="${kidId}"><input type="hidden" name="reason" value="">
      <h2>Report ${esc(name)}</h2><p class="small">Your parent will be told so they can help. You did the right thing. 💜</p>
      <div class="chips" role="radiogroup">${reasons.map(([k, l]) => `<button type="button" class="chip" role="radio" data-act="radio-chip" data-v="${k}" aria-checked="false" aria-pressed="false">${l}</button>`).join('')}</div>
      <label class="fld"><span>Tell us more (optional)</span><textarea class="field" name="details" maxlength="500"></textarea></label>
      <label class="check"><input type="checkbox" name="also_block" checked><span>Also block ${esc(name)}</span></label>
      <p class="form-error" data-err role="alert"></p>
      <button class="danger-button block big" type="submit">Send report</button><button type="button" class="ghost-button block" data-act="close-sheet">Cancel</button></form>`);
  }

  // ================================================================ actions
  async function withBusy(el, fn) {
    if (S.busy) return;
    S.busy = true; el?.setAttribute('aria-busy', 'true'); el?.classList.add('is-loading');
    try { await fn(); } catch (e) { toast(e.message, 'warn'); }
    finally { S.busy = false; if (el?.isConnected) { el.removeAttribute('aria-busy'); el.classList.remove('is-loading'); } }
  }
  async function refreshMe() { const d = await api('/me'); S.me = d.user; S.family = d.family; S.badges = d.badges; soundCheck(d.badges); S.smsLive = d.sms_live; if (S.me.theme && S.me.theme !== theme()) applyTheme(S.me.theme); }
  const setPressed = (el, sel, attr = 'aria-pressed') => $$(sel, el.closest('form') || document).forEach((b) => { b.setAttribute(attr, String(b === el)); if (attr !== 'aria-pressed') b.setAttribute('aria-pressed', String(b === el)); });

  const A = {
    door: (el) => { S.door = el.dataset.door; S.authMode = 'login'; store.set('lh_door', S.door); render(); },
    'auth-mode': (el) => { S.authMode = el.dataset.mode; render(); },
    tab: (el) => go(el.dataset.tab),
    open: (el) => { closeSheet(); open(el.dataset.view, el.dataset.id ? Number(el.dataset.id) : undefined); },
    back: () => back(),
    note: (el) => { api('/notifications/read', { method: 'POST', body: { id: Number(el.dataset.id) } }).catch(() => {}); S.badges.notifications = Math.max(0, (S.badges.notifications || 1) - 1); if (!follow(el.dataset.link)) paintBadges(); },
    'read-all': async () => { await api('/notifications/read', { method: 'POST', body: { all: true } }); S.badges.notifications = 0; loadForScreen(); },

    'ob-next': () => { S.onboardStep = 1; render(); },
    'ob-ava': (el) => { S.me.avatar = el.dataset.k; $$('.ava-pick').forEach((b) => b.setAttribute('aria-checked', String(b === el))); },
    'ob-save': (el) => withBusy(el, async () => {
      const name = $('#ob-name').value.trim();
      await api('/me', { method: 'PATCH', body: { avatar: S.me.avatar, display_name: name } });
      S.me.display_name = name || S.me.display_name; S.onboardStep = 2; render();
    }),
    'ob-rules': () => { if (!$('#ob-agree').checked) { toast('Check "I got it!" to keep going', 'warn'); return; } S.onboardStep = 3; render(); },
    'ob-done': (el) => withBusy(el, async () => { await api('/me', { method: 'PATCH', body: { onboarded: true } }); S.me.onboarded = 1; confetti(); render(); loadForScreen(); }),

    ready: async (el) => {
      if (el.getAttribute('aria-disabled') === 'true') { toast('Already sent — your parent knows! ✓'); return; }
      await withBusy(el, async () => {
        const r = await api('/ready', { method: 'POST', body: {} });
        S.me.last_ready_at = r.at;
        if (!r.already) { confetti(); try { navigator.vibrate?.(80); } catch { } toast(r.told > 1 ? "🙌 Sent! Your parents know you're ready." : "🙌 Sent! Your parent knows you're ready."); }
        else toast('Already sent — your parent knows! ✓');
        paint();
      });
    },

    // hangouts
    'checkin-sheet': (el) => sheetCheckin(Number(el.dataset.id)),
    'pick-house': (el) => { const f = el.closest('form'); setPressed(el, '.house-opt', 'aria-checked'); f.house_id.value = el.dataset.id; const b = f.querySelector('[type=submit]'); b.disabled = false; b.textContent = 'Check in! 🎉'; },
    'pick-session': (el) => { setPressed(el, '[data-act=pick-session]'); el.closest('form').session.value = el.dataset.s; },
    checkout: (el) => withBusy(el, async () => {
      await api('/checkout', { method: 'POST', body: { kid_id: el.dataset.id ? Number(el.dataset.id) : undefined } });
      toast('👋 Checked out'); loadForScreen();
    }),
    headsup: (el) => sheetHeadsUp(Number(el.dataset.id)),
    eta: (el) => { S.eta = Number(el.dataset.v); setPressed(el, '[data-act=eta]'); },
    'pickup-ack': (el) => withBusy(el, async () => { await api(`/pickups/${el.dataset.id}/ack`, { method: 'POST' }); toast("👍 Sent! They know you got it."); loadForScreen(); }),
    history: (el) => sheetHistory(Number(el.dataset.id)),
    'house-edit': (el) => sheetHouse(el.dataset.id ? Number(el.dataset.id) : null),
    'house-delete': async (el) => { if (!confirm('Remove this house?')) return; await withBusy(el, async () => { await api(`/houses/${el.dataset.id}`, { method: 'DELETE' }); closeSheet(); toast('House removed'); loadForScreen(); }); },
    'schedule-edit': () => sheetSchedule(),

    // friends + safety
    'share-code': async () => {
      const text = `Add me on Let's Hang! My friend code is ${S.me.friend_code}`;
      if (navigator.share) { try { await navigator.share({ text }); } catch { } } else { try { await navigator.clipboard.writeText(S.me.friend_code); toast('Code copied!'); } catch { toast(S.me.friend_code); } }
    },
    'new-code': async (el) => { if (!confirm('Get a new friend code? Your old one will stop working.')) return; await withBusy(el, async () => { const r = await api('/me/friend-code', { method: 'POST' }); S.me.friend_code = r.friend_code; paint(); toast('New code: ' + r.friend_code); }); },
    'friend-respond': (el) => withBusy(el, async () => {
      const r = await api(`/friends/${el.dataset.id}/respond`, { method: 'POST', body: { accept: el.dataset.v === '1' } });
      toast(r.status === 'awaiting_parent' ? '🎉 Accepted! Now your parents approve.' : 'Request declined'); loadForScreen();
    }),
    'friend-remove': async (el) => { if (el.dataset.confirm && !confirm(el.dataset.confirm)) return; await withBusy(el, async () => { await api(`/friends/${el.dataset.id}`, { method: 'DELETE' }); closeSheet(); toast('Removed'); loadForScreen(); }); },
    'friend-menu': (el) => sheetSafety(Number(el.dataset.kid), el.dataset.name, Number(el.dataset.id)),
    'conv-menu': (el) => { const p = S.conv.people[el.dataset.id]; sheetSafety(p.id, p.display_name, S.conv.id); },
    block: async (el) => { if (!confirm(`Block ${el.dataset.name}? They won't be able to message you or find your code.`)) return; await withBusy(el, async () => { await api('/blocks', { method: 'POST', body: { user_id: Number(el.dataset.id) } }); closeSheet(); toast('Blocked'); if (S.view?.name === 'conv') back(); else loadForScreen(); }); },
    'report-start': (el) => sheetReport(Number(el.dataset.id), el.dataset.name),
    'radio-chip': (el) => { setPressed(el, '[data-act=radio-chip]', 'aria-checked'); el.closest('form').reason.value = el.dataset.v; },
    'toggle-chip': (el) => el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'),
    'load-blocked': async () => {
      const f = await api('/friends');
      $('#blocked-list').innerHTML = f.blocked.length ? f.blocked.map((b) => `<div class="row-btn static">${ava(b.avatar)}<span class="grow"><b>${esc(b.display_name)}</b></span><button class="ghost-button sm" data-act="unblock" data-id="${b.id}">Unblock</button></div>`).join('') : '<p class="small muted">Nobody blocked.</p>';
    },
    unblock: (el) => withBusy(el, async () => { await api(`/blocks/${el.dataset.id}`, { method: 'DELETE' }); toast('Unblocked'); A['load-blocked'](); }),

    // plans
    'plan-new': async (el) => { closeSheet(); if (!S.friends) S.friends = await api('/friends').catch(() => null); sheetPlan(el.dataset.friend ? Number(el.dataset.friend) : null, el.dataset.title || ''); },
    'plan-decide': (el) => withBusy(el, async () => {
      const r = await api(`/plans/${el.dataset.id}/decision`, { method: 'POST', body: { kid_id: Number(el.dataset.kid), approve: el.dataset.v === '1' } });
      toast(r.status === 'approved' ? "✅ Approved — it's on the calendar" : el.dataset.v === '1' ? '✅ Approved — waiting on the other parent' : 'Declined'); await refreshMe(); loadForScreen();
    }),
    'plan-cancel': async (el) => { if (!confirm('Cancel this plan?')) return; await withBusy(el, async () => { await api(`/plans/${el.dataset.id}/cancel`, { method: 'POST' }); toast('Plan cancelled'); loadForScreen(); }); },
    'friend-approve': (el) => withBusy(el, async () => {
      const r = await api(`/friends/${el.dataset.id}/approve`, { method: 'POST', body: { approve: el.dataset.v === '1' } });
      toast(r.status === 'active' ? '🎉 Approved — they can chat now' : r.status === 'declined' ? 'Declined' : '✅ Approved — waiting on the other parent'); await refreshMe(); loadForScreen();
    }),
    'cal-prev': () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() - 1, 1); paint(); },
    'cal-next': () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + 1, 1); paint(); },
    'cal-day': (el) => { const d = new Date(el.dataset.d); S.calDay = S.calDay && sameDay(S.calDay, d) ? null : d; paint(); },
    'cal-clear': () => { S.calDay = null; paint(); },

    // games
    game: (el) => { S.game = el.dataset.g || null; if (S.game === 'memory') newMemory(); paint(); scrollTo(0, 0); },
    memo: (el) => {
      const m = S.mem, i = Number(el.dataset.i);
      if (m.lock || m.open.includes(i) || m.done.has(i)) return;
      m.open.push(i);
      if (m.open.length === 2) {
        m.moves++;
        const [a, b] = m.open;
        if (m.deck[a].e === m.deck[b].e) { m.done.add(a); m.done.add(b); m.open = []; if (m.done.size === m.deck.length) { if (!m.best || m.moves < m.best) { m.best = m.moves; store.set('lh_mem_best', m.moves); } confetti(); } }
        else { m.lock = true; setTimeout(() => { m.open = []; m.lock = false; paint(); }, 750); }
      }
      paint();
    },
    'memo-reset': () => { newMemory(); paint(); },
    ttt: (el) => {
      const t = S.ttt, i = Number(el.dataset.i);
      if (t.b[i] || tttWinner(t.b)) return;
      t.b[i] = 'X';
      if (!tttWinner(t.b)) t.b[tttCpu(t.b)] = 'O';
      const w = tttWinner(t.b);
      if (w) { t.score[w === 'X' ? 'w' : w === 'O' ? 'l' : 'd']++; store.set('lh_ttt', t.score); if (w === 'X') confetti(); }
      paint();
    },
    'ttt-reset': () => { S.ttt.b = Array(9).fill(null); paint(); },
    wyr: (el) => { S.wyr.choice = Number(el.dataset.c); paint(); },
    'wyr-next': () => { let i; do { i = Math.floor(Math.random() * WYR.length); } while (i === S.wyr.i); S.wyr = { i, choice: null }; paint(); },
    'idea-next': () => { let n; do { n = pick(IDEAS); } while (n === S.idea); S.idea = n; paint(); },

    // profile / settings
    theme: async (el) => {
      applyTheme(el.dataset.t);
      if (S.me) { S.me.theme = el.dataset.t; api('/me', { method: 'PATCH', body: { theme: el.dataset.t } }).catch((e) => toast(e.message, 'warn')); }
      if (S.me && isKid() && !S.me.onboarded) { const name = $('#ob-name')?.value; $('#app').innerHTML = `<main class="view onboarding">${renderOnboarding()}</main>`; if (name && $('#ob-name')) $('#ob-name').value = name; } else render();
      toast(el.dataset.t === 'pastel' ? '🌸 Pastel on' : '⚡ Neon on');
    },
    'edit-profile': () => sheetEditProfile(),
    'sheet-ava': (el) => { setPressed(el, '.ava-pick', 'aria-checked'); el.closest('form').avatar.value = el.dataset.k; },
    'ride-sheet': (el) => { closeSheet(); sheetRide(el.dataset.kind, el.dataset.reason); },
    'ride-kind': (el) => {
      const f = el.closest('form'), k = el.dataset.k, s = S.today?.schedule || { end: '15:50', leave: '08:20' };
      if (f.kind.value === k) return;
      setPressed(el, '[data-act=ride-kind]');
      f.kind.value = k; f.time.value = k === 'pickup' ? s.end : s.leave;
      [f.from_place.value, f.to_place.value] = [f.to_place.value, f.from_place.value];
    },
    'ride-claim': (el) => withBusy(el, async () => { try { await api(`/rides/${el.dataset.id}/claim`, { method: 'POST' }); confetti(); toast("🚗 You're driving — everyone's been told"); } finally { loadForScreen(); } }),
    'ride-unclaim': (el) => { if (!confirm("Let the other parents know you can't drive?")) return; withBusy(el, async () => { await api(`/rides/${el.dataset.id}/unclaim`, { method: 'POST' }); toast('Other parents asked again'); loadForScreen(); }); },
    'ride-cancel': (el) => { if (!confirm('Cancel this ride for everyone?')) return; withBusy(el, async () => { await api(`/rides/${el.dataset.id}/cancel`, { method: 'POST' }); toast('Ride cancelled'); loadForScreen(); }); },
    'sound-test': (el) => Sound.play(el.dataset.k, true),
    'sound-toggle': (el) => { Sound.set(el.checked); if (el.checked) Sound.play('chime', true); toast(el.checked ? '🔊 Sounds on' : '🔇 Sounds off'); },
    pref: async (el) => { const p = { ...(S.me.notify_prefs || {}), [el.dataset.k]: el.checked }; S.me.notify_prefs = p; await api('/me', { method: 'PATCH', body: { notify_prefs: p } }).catch((e) => toast(e.message, 'warn')); toast('Saved'); },
    'fam-quick': (el) => { const t = $('#msg-input'); t.value = el.dataset.t; t.form.requestSubmit(); },

    // parent
    'add-kid': () => sheetAddKid(),
    'add-parent': () => sheetAddParent(),
    'kid-edit': (el) => sheetEditKid(Number(el.dataset.id)),
    'kid-chat': async (el) => { await api(`/kids/${el.dataset.id}`, { method: 'PATCH', body: { chat_enabled: el.checked } }).catch((e) => toast(e.message, 'warn')); toast(el.checked ? 'Chat turned on' : 'Chat paused'); },
    'kid-delete': async (el) => {
      if (prompt(`This permanently deletes ${el.dataset.name}'s account, friends, chats, plans and check-ins. Type DELETE to confirm.`) !== 'DELETE') return;
      await withBusy(el, async () => { await api(`/kids/${el.dataset.id}`, { method: 'DELETE' }); await refreshMe(); toast('Deleted'); go('home'); });
    },
    'delete-family': async (el) => {
      if (prompt('This permanently deletes your whole family: every account, chat, plan, house and friend. Type DELETE to confirm.') !== 'DELETE') return;
      await withBusy(el, async () => { await api('/family', { method: 'DELETE', body: { confirm: 'DELETE' } }); S.me = null; stopPolling(); render(); toast('Your family account was deleted.'); });
    },
    'sms-test': (el) => withBusy(el, async () => { const r = await api('/sms/test', { method: 'POST' }); toast(r.status === 'simulated' ? '📝 Logged (practice mode — not actually sent)' : '📱 Test text sent!'); }),
    logout: async () => { await api('/logout', { method: 'POST' }).catch(() => {}); stopPolling(); heard = null; S.me = null; S.tab = 'home'; S.view = null; render(); },
    'close-sheet': () => closeSheet(),
    'close-sheet-bg': (el, e) => { if (e.target === el) closeSheet(); },
  };

  // ================================================================ forms
  const F = {
    login: async (f, d) => { await api('/login', { method: 'POST', body: { username: d.get('username'), password: d.get('password'), role: S.door } }); await boot(); },
    signup: async (f, d) => {
      const r = await api('/signup', { method: 'POST', body: { name: d.get('name'), username: d.get('username'), password: d.get('password'), phone: d.get('phone'), sms_opt_in: d.get('sms_opt_in') === 'on' } });
      await boot(); sheetRecovery(r.recovery_code, 'Welcome! Save your recovery code');
    },
    recover: async (f, d) => { const r = await api('/recover', { method: 'POST', body: Object.fromEntries(d) }); await boot(); sheetRecovery(r.recovery_code, 'Password reset! Here is your new recovery code'); },
    msg: async (f, d) => {
      const body = String(d.get('body') || '').trim(); if (!body) return;
      await api(`/chats/${S.view.id}/messages`, { method: 'POST', body: { body } });
      f.reset(); await loadConv(false); $('#msg-input')?.focus();
    },
    fam: async (f, d) => {
      const body = String(d.get('body') || '').trim(); if (!body) return;
      await api(`/family-chat/${S.view.id}`, { method: 'POST', body: { body } });
      f.reset(); S.fam = await api(`/family-chat/${S.view.id}`); $('#msgs').innerHTML = famMsgs(); scrollChat(true);
    },
    'add-friend': async (f, d) => { const r = await api('/friends/request', { method: 'POST', body: { code: d.get('code') } }); f.reset(); toast(`🫶 Request sent to ${r.to.display_name}!`); loadForScreen(); },
    plan: async (f, d) => {
      const friend_ids = $$('[data-act=toggle-chip][aria-pressed=true]', f).map((b) => Number(b.dataset.v));
      if (!friend_ids.length) throw new Error('Pick at least one friend');
      const date = d.get('date'), tm = d.get('time');
      await api('/plans', { method: 'POST', body: { friend_ids, date, time: tm, starts_at: new Date(`${date}T${tm}`).toISOString(), title: d.get('title'), location: d.get('location'), details: d.get('details') } });
      closeSheet(); toast('📅 Sent to parents for approval ⏳');
      if (S.view?.name !== 'plans') open('plans'); else loadForScreen();
    },
    ride: async (f, d) => {
      const friend_ids = $$('[data-act=toggle-chip][aria-pressed=true]', f).map((b) => Number(b.dataset.v));
      const r = await api('/rides', { method: 'POST', body: { kind: d.get('kind'), reason: d.get('reason'), starts_at: new Date(`${d.get('date')}T${d.get('time')}`).toISOString(),
        from_place: d.get('from_place'), to_place: d.get('to_place'), note: d.get('note'), friend_ids } });
      closeSheet(); toast(`🚗 Asked ${r.parents_asked} parent${r.parents_asked === 1 ? '' : 's'} — you'll hear when someone says yes`);
      loadForScreen();
    },
    checkin: async (f, d) => {
      const kidId = Number(d.get('kid_id'));
      const r = await api('/checkin', { method: 'POST', body: { kid_id: kidId, house_id: Number(d.get('house_id')), session: d.get('session') } });
      closeSheet();
      if (isKid()) { confetti(); toast(pick(['🎉 You made it!', '🙌 Checked in!', "🔥 Let's gooo!"])); } else toast(`📍 Checked in at ${r.house}`);
      loadForScreen();
    },
    pickup: async (f, d) => {
      const r = await api('/pickups', { method: 'POST', body: { kid_id: Number(d.get('kid_id')), eta_minutes: S.eta, message: d.get('message') } });
      closeSheet(); toast(r.hosts ? `🚗 Heads-up sent to your kid + host family` : '🚗 Heads-up sent'); loadForScreen();
    },
    house: async (f, d) => {
      const id = Number(d.get('id')) || null;
      const body = { name: d.get('name'), address: d.get('address'), notes: d.get('notes') };
      if (id) await api(`/houses/${id}`, { method: 'PATCH', body }); else await api('/houses', { method: 'POST', body });
      closeSheet(); toast('🏠 House saved'); loadForScreen();
    },
    schedule: async (f, d) => { const r = await api('/family/schedule', { method: 'PATCH', body: Object.fromEntries(d) }); closeSheet(); toast(`🏫 Saved · weather for ${r.location_name}`); loadForScreen(); },
    report: async (f, d) => {
      if (!d.get('reason')) throw new Error('Pick a reason');
      await api('/reports', { method: 'POST', body: { user_id: Number(d.get('user_id')), reason: d.get('reason'), details: d.get('details') } });
      if (d.get('also_block') === 'on') await api('/blocks', { method: 'POST', body: { user_id: Number(d.get('user_id')) } });
      closeSheet(); toast('🛡️ Report sent. Your parent will check in.'); if (S.view?.name === 'conv' && d.get('also_block') === 'on') back(); else loadForScreen();
    },
    'edit-profile': async (f, d) => { await api('/me', { method: 'PATCH', body: { display_name: d.get('display_name'), avatar: d.get('avatar') } }); await refreshMe(); closeSheet(); render(); toast('Saved ✨'); },
    'kid-pin': async (f, d) => { await api('/me', { method: 'PATCH', body: Object.fromEntries(d) }); f.reset(); toast('PIN changed'); },
    'add-kid': async (f, d) => {
      const r = await api('/kids', { method: 'POST', body: { display_name: d.get('display_name'), username: d.get('username'), pin: d.get('pin'), avatar: d.get('avatar'), consent: d.get('consent') === 'on' } });
      await refreshMe(); closeSheet(); toast(`🎉 Account created! Friend code ${r.friend_code}`); loadForScreen();
    },
    'edit-kid': async (f, d) => {
      const body = { display_name: d.get('display_name'), avatar: d.get('avatar') };
      if (d.get('pin')) body.pin = d.get('pin');
      await api(`/kids/${d.get('id')}`, { method: 'PATCH', body }); await refreshMe(); closeSheet(); toast('Saved'); loadForScreen();
    },
    'add-parent': async (f, d) => { const r = await api('/parents', { method: 'POST', body: Object.fromEntries(d) }); await refreshMe(); closeSheet(); paint(); sheetRecovery(r.recovery_code, 'Their recovery code'); },
    'parent-profile': async (f, d) => { await api('/me', { method: 'PATCH', body: { display_name: d.get('display_name'), phone: d.get('phone'), sms_opt_in: d.get('sms_opt_in') === 'on' } }); await refreshMe(); render(); loadForScreen(); toast('Saved'); },
    'parent-pw': async (f, d) => { await api('/me', { method: 'PATCH', body: Object.fromEntries(d) }); f.reset(); toast('Password updated'); },
  };

  // ================================================================ events
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    // The sheet backdrop only reacts to taps on itself — taps inside the sheet (submit buttons,
    // checkboxes, links) must keep their normal behaviour.
    if (el.dataset.act === 'close-sheet-bg' && e.target !== el) return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.tagName === 'INPUT' && el.type === 'checkbox' && el.dataset.act && A[el.dataset.act]) A[el.dataset.act](el, e);
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target, fn = F[f.dataset.form];
    if (!fn) return;
    e.preventDefault();
    const btn = f.querySelector('[type=submit]'), err = f.querySelector('[data-err]');
    if (err) err.textContent = '';
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.classList.add('is-loading'); }
    try { await fn(f, new FormData(f)); }
    catch (ex) { if (err) err.textContent = ex.message; else toast(ex.message, 'warn'); }
    finally { if (btn?.isConnected) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.classList.remove('is-loading'); } }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'msg-input' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); }
    if (e.key === 'Escape' && $('#modal-root').innerHTML) closeSheet();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me) loadForScreen(); });

  // ================================================================ boot
  applyTheme(store.get('lh_theme', 'neon'));
  async function boot() {
    try { await refreshMe(); } catch { S.me = null; render(); return; }
    S.tab = 'home'; S.view = null; S.onboardStep = 0;
    render(); loadForScreen(); startPolling();
  }
  boot();
})();
