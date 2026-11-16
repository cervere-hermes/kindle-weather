#!/usr/bin/env node
// Fetch Open-Meteo, build the dashboard HTML, screenshot it with headless Chrome
// at every Kindle resolution in config.json.  Usage:
//   node src/render.mjs            -> dist/weather-<W>x<H>.png
//   node src/render.mjs --demo     -> dist/outfits.png (every outfit side by side)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { icon, iconKind, conditionText } from './icons.mjs';
import { decideOutfit } from './outfit.mjs';
import { avatarSVG } from './avatar.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf8'));
const DIST = join(ROOT, 'dist');
mkdirSync(DIST, { recursive: true });

const CHROME = process.env.CHROME_BIN || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => existsSync(p));

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const dateOf = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const hhmm = (s) => s.slice(11, 16);
const r = Math.round;

async function fetchWeather() {
  const q = new URLSearchParams({
    latitude: cfg.latitude, longitude: cfg.longitude, timezone: cfg.timezone, forecast_days: 6, wind_speed_unit: 'kmh',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

// Summarise a run of hourly indices into what the outfit logic needs.
function windowStats(h, idx) {
  const avg = (k) => idx.reduce((a, i) => a + h[k][i], 0) / idx.length;
  const max = (k) => Math.max(...idx.map((i) => h[k][i] ?? 0));
  const codes = idx.map((i) => h.weather_code[i]);
  const wet = idx.find((i) => (h.precipitation_probability[i] ?? 0) >= 50 || h.precipitation[i] >= 0.3);
  const sunnyHours = codes.filter((c) => c <= 1).length;
  return {
    feels: avg('apparent_temperature'),
    tmin: Math.min(...idx.map((i) => h.temperature_2m[i])), tmax: max('temperature_2m'),
    rainProb: max('precipitation_probability'), rainMm: idx.reduce((a, i) => a + h.precipitation[i], 0),
    rainFrom: wet !== undefined ? hhmm(h.time[wet]) : null,
    snow: codes.some((c) => (c >= 71 && c <= 77) || c === 85 || c === 86),
    wind: Math.max(max('wind_speed_10m'), max('wind_gusts_10m') * 0.7),
    sunny: sunnyHours >= idx.length / 2, uv: max('uv_index'),
    isDay: idx.some((i) => h.is_day[i]),
  };
}

function buildModel(d) {
  const h = d.hourly, c = d.current;
  const nowStr = c.time; // local time string, e.g. 2026-11-16T18:45
  const today = nowStr.slice(0, 10);
  const nowHour = Number(nowStr.slice(11, 13));
  const iNow = h.time.findIndex((t) => t.slice(0, 13) === nowStr.slice(0, 13));
  const evening = nowHour >= cfg.switchToTomorrowAt;
  const targetDay = evening ? d.daily.time[1] : today;
  const from = evening ? 7 : Math.max(nowHour, 7), to = 21;
  let idx = h.time.map((t, i) => i).filter((i) => h.time[i].startsWith(targetDay) && +h.time[i].slice(11, 13) >= from && +h.time[i].slice(11, 13) <= to);
  if (!idx.length) idx = [iNow];
  const w = windowStats(h, idx);
  const seed = Number(targetDay.replaceAll('-', '')) + (w.rainFrom ? 1 : 0);
  const outfit = decideOutfit(w, seed);

  const hourly = [];
  for (let k = 1; hourly.length < 8 && iNow + k < h.time.length; k += 3) {
    const i = iNow + k;
    hourly.push({ t: hhmm(h.time[i]), kind: iconKind(h.weather_code[i], h.is_day[i]), temp: r(h.temperature_2m[i]), pop: h.precipitation_probability[i] ?? 0 });
  }
  const days = d.daily.time.slice(1, 5).map((t, j) => {
    const k = j + 1, D = d.daily;
    return { name: DAYS[dateOf(t).getUTCDay()].slice(0, 3), kind: iconKind(D.weather_code[k], 1), hi: r(D.temperature_2m_max[k]), lo: r(D.temperature_2m_min[k]), pop: D.precipitation_probability_max[k] ?? 0, text: conditionText(D.weather_code[k]) };
  });

  // today's rain outlook (from now until midnight)
  const restOfDay = h.time.map((t, i) => i).filter((i) => i >= iNow && h.time[i].startsWith(today));
  const wetIdx = restOfDay.find((i) => (h.precipitation_probability[i] ?? 0) >= 50 || h.precipitation[i] >= 0.3);
  const rainLine = wetIdx === undefined ? 'Dry for the rest of today'
    : wetIdx === iNow ? `Wet right now · ${h.precipitation_probability[wetIdx]}% chance`
    : `Rain likely from ${hhmm(h.time[wetIdx])} · ${h.precipitation_probability[wetIdx]}%`;

  const dt = dateOf(today);
  const sr = d.daily.sunrise[0], ss = d.daily.sunset[0];
  const dayMin = (Date.parse(ss + 'Z') - Date.parse(sr + 'Z')) / 60000;
  return {
    city: cfg.name, dateLine: `${DAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`,
    updated: hhmm(nowStr),
    temp: r(c.temperature_2m), feels: r(c.apparent_temperature), humidity: c.relative_humidity_2m,
    wind: r(c.wind_speed_10m), windDir: COMPASS[Math.round(c.wind_direction_10m / 45) % 8],
    cond: conditionText(c.weather_code, c.is_day), hi: r(d.daily.temperature_2m_max[0]), lo: r(d.daily.temperature_2m_min[0]),
    rainLine, hourly, days, outfit,
    dressedFor: evening ? `Dressed for ${DAYS[dateOf(targetDay).getUTCDay()]}` : 'Dressed for today',
    fitLabel: evening ? `Tomorrow's fit` : `Today's fit`,
    fitRange: `${evening ? DAYS[dateOf(targetDay).getUTCDay()] : 'Today'} · feels ${r(w.feels)}° · ${r(w.tmin)}–${r(w.tmax)}°`,
    sunrise: hhmm(sr), sunset: hhmm(ss), daylight: `${Math.floor(dayMin / 60)}h ${String(r(dayMin % 60)).padStart(2, '0')}m`,
    uv: r(d.daily.uv_index_max[0] ?? 0),
  };
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100vw;height:100vh;background:#fff;color:#000;overflow:hidden;-webkit-font-smoothing:antialiased}
body{font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;padding:3.4vw 4.6vw 2.6vw}
.cap{font-size:2.55vw;letter-spacing:.32em;text-transform:uppercase;font-weight:700}
header{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:2vw;border-bottom:.5vw solid #000}
header .sub{font-size:2.9vw;font-weight:500}
.hero{display:grid;grid-template-columns:42% 58%;height:52vw;border-bottom:.25vw solid #000}
.now{padding-top:3vw;display:flex;flex-direction:column}
.big{font-family:'DM Serif Display',serif;font-size:23vw;line-height:.9;letter-spacing:-.04em;margin-left:-1vw}
.big sup{font-size:.45em;vertical-align:.95em;margin-left:.2vw}
.cond{font-size:4.8vw;font-weight:700;margin:1vw 0 1vw;line-height:1.05}
.meta{font-size:2.8vw;line-height:1.5;color:#222}
.meta b{font-weight:700}
.rain{margin-top:auto;margin-bottom:2vw;font-size:2.7vw;font-weight:700;border:.35vw solid #000;border-radius:1.2vw;padding:1.1vw 1.6vw;align-self:flex-start}
.wim{position:relative;overflow:hidden}
.wim svg{position:absolute;right:-2vw;bottom:-.2vw;height:51vw;width:auto}
.wim .tag{position:absolute;right:0;top:2.2vw;font-size:2.1vw;letter-spacing:.2em;text-transform:uppercase;font-weight:700;background:#fff;padding:.4vw .8vw;z-index:2}
.bubble{position:absolute;left:0;top:7vw;max-width:21vw;background:#fff;border:.4vw solid #000;border-radius:2.4vw;padding:1.2vw 1.6vw;font-size:2.7vw;font-weight:700;line-height:1.2;z-index:2}
.bubble:after{content:'';position:absolute;right:-2.6vw;bottom:1.8vw;width:2.6vw;height:2.6vw;background:#fff;border-right:.4vw solid #000;border-bottom:.4vw solid #000;transform:skewX(35deg) rotate(-30deg)}
.fit{padding:2.2vw 0 2.2vw;border-bottom:.25vw solid #000}
.fit .row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.6vw}
.fit .range{font-size:2.7vw;color:#333;font-weight:500}
.chips{display:flex;flex-wrap:wrap;gap:1.2vw}
.chip{font-size:2.6vw;font-weight:700;padding:.6vw 1.6vw;border:.35vw solid #000;border-radius:5vw}
.chip.dark{background:#000;color:#fff}
.hours{display:grid;grid-template-columns:repeat(8,1fr);padding:2vw 0 1.8vw;border-bottom:.25vw solid #000;text-align:center}
.hours .t{font-size:2.6vw;font-weight:500;color:#333}
.hours svg{width:7vw;height:7vw;margin:.6vw auto .2vw;display:block}
.hours .v{font-size:3.6vw;font-weight:700}
.hours .p{font-size:2.4vw;color:#444;margin-top:.3vw}
.days{display:grid;grid-template-columns:repeat(4,1fr);padding:1.6vw 0 1.4vw;flex:1;align-items:center}
.day{display:flex;flex-direction:column;align-items:center;border-right:.25vw solid #bbb}
.day:last-child{border-right:none}
.day .n{font-size:2.7vw}
.day svg{width:8vw;height:8vw;margin:.2vw 0}
.day .hl{font-size:3.6vw;font-weight:700}.day .hl span{font-weight:400;color:#555}
.day .p{font-size:2.4vw;color:#444;margin-top:.3vw}
footer{display:flex;gap:3.2vw;font-size:2.6vw;color:#222;padding-top:1.6vw;border-top:.25vw solid #000;padding-right:16vw}
footer b{font-weight:700}
`;

function html(m) {
  const chips = m.outfit.items.map((it, i) => `<span class="chip${i === 0 ? ' dark' : ''}">${it}</span>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display&display=block" rel="stylesheet">
<style>${CSS}</style></head><body>
<header><span class="cap">${m.city}</span><span class="sub">${m.dateLine} · updated ${m.updated}</span></header>
<section class="hero">
  <div class="now">
    <div class="big">${m.temp}<sup>°</sup></div>
    <div class="cond">${m.cond}</div>
    <div class="meta">Feels like <b>${m.feels}°</b> · Humidity <b>${m.humidity}%</b><br>Wind <b>${m.wind} km/h ${m.windDir}</b><br>Today <b>${m.hi}°</b> / ${m.lo}°</div>
    <div class="rain">${m.rainLine}</div>
  </div>
  <div class="wim"><div class="tag">${m.dressedFor}</div><div class="bubble">${m.outfit.line}</div>${avatarSVG(m.outfit)}</div>
</section>
<section class="fit"><div class="row"><span class="cap">${m.fitLabel}</span><span class="range">${m.fitRange}</span></div><div class="chips">${chips}</div></section>
<section class="hours">${m.hourly.map((x) => `<div><div class="t">${x.t}</div>${icon(x.kind)}<div class="v">${x.temp}°</div><div class="p">${x.pop}%</div></div>`).join('')}</section>
<section class="days">${m.days.map((x) => `<div class="day"><div class="n cap">${x.name}</div>${icon(x.kind)}<div class="hl">${x.hi}° <span>${x.lo}°</span></div><div class="p">${x.pop}% rain</div></div>`).join('')}</section>
<footer><span>Sunrise <b>${m.sunrise}</b></span><span>Sunset <b>${m.sunset}</b></span><span>Daylight <b>${m.daylight}</b></span><span>UV <b>${m.uv}</b></span></footer>
</body></html>`;
}

function shoot(htmlStr, name, w, h) {
  const file = join(DIST, `${name}.html`);
  writeFileSync(file, htmlStr);
  if (!CHROME) throw new Error('Chrome not found; set CHROME_BIN');
  const out = join(DIST, `${name}.png`);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, '--virtual-time-budget=8000', `--screenshot=${out}`, `file://${file}`,
  ], { stdio: 'ignore' });
  return out;
}

function demo() {
  const base = { tmin: 0, tmax: 0, rainProb: 0, rainMm: 0, rainFrom: null, snow: false, wind: 10, sunny: false, uv: 1, isDay: 1 };
  const cases = [
    ['31° sunny', { feels: 31, sunny: true, uv: 8 }], ['23° sunny', { feels: 23, sunny: true, uv: 5 }],
    ['17° cloudy', { feels: 17 }], ['12° rain', { feels: 12, rainProb: 80, rainFrom: '14:00' }],
    ['7° windy', { feels: 7, wind: 35 }], ['6° rain', { feels: 6, rainProb: 90, rainFrom: '09:00' }],
    ['8° storm', { feels: 8, rainProb: 90, wind: 55 }], ['-2° snow', { feels: -2, snow: true, rainProb: 70 }],
    ['1° clear night', { feels: 1, sunny: true, isDay: 0 }],
  ];
  const cells = cases.map(([label, c], i) => {
    const o = decideOutfit({ ...base, ...c }, i);
    return `<div style="border:2px solid #000;padding:8px;text-align:center;font:700 15px 'DM Sans',sans-serif">${avatarSVG(o)}<div>${label}</div><div style="font-weight:400;font-size:12px">${o.items.join(' · ')}</div><div style="font-style:italic;font-size:13px">“${o.line}”</div></div>`;
  }).join('');
  const page = `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=block" rel="stylesheet"></head><body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px">${cells}</body></html>`;
  console.log(shoot(page, 'outfits', 1080, 1520));
}

if (process.argv.includes('--demo')) demo();
else {
  const data = process.argv.includes('--fixture') ? JSON.parse(readFileSync(process.argv[process.argv.indexOf('--fixture') + 1], 'utf8')) : await fetchWeather();
  const model = buildModel(data);
  for (const [w, h] of cfg.sizes) console.log(shoot(html(model), `weather-${w}x${h}`, w, h));
  writeFileSync(join(DIST, 'model.json'), JSON.stringify({ renderedAt: new Date().toISOString(), ...model }, null, 2));
}
