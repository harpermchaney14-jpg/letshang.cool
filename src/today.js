// School-day schedule + walk-time weather (Open-Meteo: free, no API key).

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
export const fromMin = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function localNow(tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), dow: DOW.indexOf(p.weekday), hour: Number(p.hour) };
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return { date: d.toISOString().slice(0, 10), dow: d.getUTCDay() };
}

/** Today until the kids are home, otherwise the next weekday. */
export function pickSchoolDay(fam, tz) {
  const now = localNow(tz);
  const homeBy = toMin(fam.school_end) + fam.walk_minutes;
  let offset = 0;
  if (!(now.dow >= 1 && now.dow <= 5 && now.minutes <= homeBy)) {
    offset = 1;
    while (true) { const d = addDays(now.date, offset); if (d.dow >= 1 && d.dow <= 5) break; offset++; }
  }
  const day = addDays(now.date, offset);
  const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : ({ Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' })[DOW[day.dow]];
  return { ...day, label };
}

export function schedule(fam) {
  return {
    leave: fromMin(toMin(fam.school_arrive) - fam.walk_minutes), arrive: fam.school_arrive, start: fam.school_start,
    end: fam.school_end, home: fromMin(toMin(fam.school_end) + fam.walk_minutes),
    walk_minutes: fam.walk_minutes, walk_miles: fam.walk_miles,
  };
}

function describe(code) {
  if (code === 0) return ['☀️', 'Sunny'];
  if (code <= 2) return ['🌤️', 'Partly cloudy'];
  if (code === 3) return ['☁️', 'Cloudy'];
  if (code === 45 || code === 48) return ['🌫️', 'Foggy'];
  if (code >= 51 && code <= 57) return ['🌦️', 'Drizzle'];
  if (code >= 61 && code <= 67) return ['🌧️', 'Rain'];
  if (code >= 71 && code <= 77) return ['🌨️', 'Snow'];
  if (code >= 80 && code <= 82) return ['🌦️', 'Showers'];
  if (code === 85 || code === 86) return ['🌨️', 'Snow showers'];
  if (code >= 95) return ['⛈️', 'Thunderstorms'];
  return ['🌡️', ''];
}
function wearTip(w) {
  const t = [], f = w.feels;
  if (w.code >= 95) t.push('Storms — ask for a ride ⛈️');
  else if (f <= 0) t.push('Dangerously cold — get a ride if you can 🥶');
  else if (f < 15) t.push('Big coat, hat, gloves, scarf 🧣');
  else if (f < 32) t.push('Winter coat + gloves 🧤');
  else if (f < 50) t.push('Jacket weather 🧥');
  else if (f < 64) t.push('Hoodie weather');
  else if (f < 85) t.push('T-shirt weather 😎');
  else t.push('Hot! Bring water 💧');
  const snowy = (w.code >= 71 && w.code <= 77) || w.code === 85 || w.code === 86;
  if (snowy) t.push('Wear boots ❄️'); else if (w.pop >= 50) t.push('Bring an umbrella ☔'); else if (w.pop >= 30) t.push('Maybe rain — hood up 🌂');
  if (w.wind >= 20) t.push(`Windy (${w.wind} mph) 💨`);
  return t.join(' · ');
}
/** 'snow' | 'rain' | 'storm' | 'cold' when walking is a bad idea and a ride makes sense, else null. */
export function rideReason(w) {
  if (!w) return null;
  const c = w.code;
  if (c >= 95) return 'storm';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || w.pop >= 50) return 'rain';
  if (w.feels <= 5) return 'cold';
  return null;
}
function hourAt(h, date, hhmm) {
  const m = toMin(hhmm) + 30;
  const i = h.time.indexOf(`${date}T${String(Math.min(23, Math.floor(m / 60))).padStart(2, '0')}:00`);
  if (i < 0) return null;
  const w = { temp: Math.round(h.temperature_2m[i]), feels: Math.round(h.apparent_temperature[i]), pop: h.precipitation_probability?.[i] ?? 0, wind: Math.round(h.wind_speed_10m[i]), code: h.weather_code[i] };
  const [emoji, text] = describe(w.code);
  return { ...w, emoji, text, tip: wearTip(w), ride: rideReason(w) };
}
const mk = (temp, feels, pop, wind, code) => { const w = { temp, feels, pop, wind, code }; const [emoji, text] = describe(code); return { ...w, emoji, text, tip: wearTip(w), ride: rideReason(w) }; };

export async function walkWeather(env, ctx, fam, day, sched) {
  if (env.WEATHER_MOCK) return { morning: mk(41, 35, 10, 12, 2), afternoon: mk(56, 56, 60, 22, 80) }; // local dev only
  const tz = env.TIMEZONE || 'America/Chicago';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${fam.lat}&longitude=${fam.lon}&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=5&timezone=${encodeURIComponent(tz)}`;
  try {
    const cache = caches.default, key = new Request(url);
    let res = await cache.match(key);
    if (!res) {
      const fresh = await fetch(url);
      if (!fresh.ok) return null;
      res = new Response(fresh.body, fresh); res.headers.set('cache-control', 'public, max-age=1800');
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    const data = await res.json();
    const morning = hourAt(data.hourly, day.date, sched.leave), afternoon = hourAt(data.hourly, day.date, sched.end);
    return morning || afternoon ? { morning, afternoon } : null;
  } catch (e) { console.error('weather failed', e); return null; }
}

export async function geocode(name) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&countryCode=US&name=${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const r = (await res.json()).results?.[0];
  return r ? { lat: r.latitude, lon: r.longitude, label: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}` } : null;
}
