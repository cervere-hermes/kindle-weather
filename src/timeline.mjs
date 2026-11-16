// "When?" logic: turns hourly forecast rows into time windows (rain, dry spells,
// gusts, frost, sun), short phrases, and an hour-by-hour chart for e-ink.
// An hour row: { t:'2026-11-17T08:00', hour:8, temp, feels, pop, mm, code, gust, isDay }
import { icon, iconKind } from './icons.mjs';

const hh = (row) => String(row.hour).padStart(2, '0');
const endHH = (row) => String((row.hour + 1) % 24).padStart(2, '0');
const isSnow = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;
const isStorm = (c) => c >= 95;
export const isWet = (r) => r.pop >= 50 || r.mm >= 0.2;

// Runs of consecutive rows matching pred; gaps of <= `bridge` non-matching hours are merged.
export function runs(rows, pred, bridge = 0) {
  const out = [];
  let cur = null, gap = 0;
  rows.forEach((r, i) => {
    if (pred(r)) {
      if (cur && gap <= bridge) cur.e = i; else { cur = { s: i, e: i }; out.push(cur); }
      gap = 0;
    } else if (cur) gap++;
  });
  return out;
}

const span = (rows, w, long = true) =>
  long ? `${hh(rows[w.s])}:00–${endHH(rows[w.e])}:00` : `${hh(rows[w.s])}–${endHH(rows[w.e])}`;

function precipWord(rows, w) {
  const seg = rows.slice(w.s, w.e + 1);
  if (seg.some((r) => isSnow(r.code))) return 'Snow';
  if (seg.some((r) => isStorm(r.code))) return 'Storms';
  if (seg.every((r) => r.mm < 0.3)) return 'Drizzle';
  return 'Rain';
}

// Precipitation windows of a stretch of hours.
export function rainWindows(rows) {
  return runs(rows, isWet, 1).map((w) => {
    const seg = rows.slice(w.s, w.e + 1);
    const peak = seg.reduce((a, r) => (r.mm > a.mm ? r : a), seg[0]);
    return { ...w, word: precipWord(rows, w), peak: peak.mm >= 0.5 ? peak : null, hours: w.e - w.s + 1 };
  });
}

// Short "when" for a whole day (forecast cards): "Rain 08–13", "Rain all day", "Showers from 15", "Dry".
export function dayWhen(rows) {
  const wins = rainWindows(rows);
  if (!wins.length) {
    const maybe = rows.filter((r) => r.pop >= 30);
    return maybe.length ? `Chance ${Math.max(...maybe.map((r) => r.pop))}%` : 'Dry';
  }
  const wet = wins.reduce((a, w) => a + w.hours, 0);
  const word = wins[0].word;
  if (wet >= rows.length * 0.7) return `${word} all day`;
  if (wins.length === 1) return `${word} ${span(rows, wins[0], false)}`;
  return `${word === 'Rain' ? 'Showers' : word} from ${hh(rows[wins[0].s])}`;
}

// Window string for Wim's bubble, e.g. "08–13" (first window only).
export function firstWindowShort(rows) {
  const w = rainWindows(rows)[0];
  return w ? span(rows, w, false) : null;
}

// Summary items for a stretch of hours: [{ b:'Rain', t:'08:00–13:00, heaviest ~10:00' }, ...]
// night = true for an overnight stretch: no sun or warmest, "Low" instead of "Coldest".
export function whenSummary(rows, { night = false, max = 5 } = {}) {
  if (!rows.length) return [];
  if (night) return nightSummary(rows).slice(0, max);
  const items = [];
  const wins = rainWindows(rows);
  if (wins.length) {
    const seq = wins.slice(0, 2).map((w) => ({ s: w.s, b: w.word, t: span(rows, w) + (w.peak && w.hours > 2 ? `, heaviest ~${hh(w.peak)}:00` : '') }));
    // the longest dry spell during waking hours (07–22), at least 2 h
    const awake = (r) => r.hour >= 7 && r.hour <= 22;
    const dry = runs(rows, (r) => !isWet(r) && awake(r)).filter((d) => d.e - d.s >= 1)
      .sort((a, b) => (b.e - b.s) - (a.e - a.s))[0];
    if (dry) seq.push({ s: dry.s, b: 'Dry', t: span(rows, dry) });
    seq.sort((x, y) => x.s - y.s).forEach(({ b, t }) => items.push({ b, t }));
  } else {
    const maybe = rows.filter((r) => r.pop >= 30).sort((a, b) => b.pop - a.pop)[0];
    items.push(maybe ? { b: 'Mostly dry', t: `small chance of a shower ~${hh(maybe)}:00` } : { b: 'Dry', t: 'all day' });
    const sun = runs(rows, (r) => r.code <= 1 && r.isDay).filter((s) => s.e - s.s >= 1)
      .sort((a, b) => (b.e - b.s) - (a.e - a.s))[0];
    if (sun) items.push({ b: 'Sunny', t: span(rows, sun) });
  }
  const gusts = runs(rows, (r) => r.gust >= 45, 1)[0];
  if (gusts) {
    const top = Math.max(...rows.slice(gusts.s, gusts.e + 1).map((r) => r.gust));
    items.push({ b: 'Gusts', t: `up to ${Math.round(top)} km/h ${span(rows, gusts, false)}` });
  }
  const frost = runs(rows, (r) => r.temp <= 0)[0];
  if (frost) {
    items.push({ b: 'Below 0°', t: frost.s === 0 ? `until ${endHH(rows[frost.e])}:00, icy` : `from ${hh(rows[frost.s])}:00` });
  }
  const awake = rows.filter((r) => r.hour >= 6);
  const pool = awake.length ? awake : rows;
  const cold = pool.reduce((a, r) => (r.temp < a.temp ? r : a), pool[0]);
  const warm = pool.reduce((a, r) => (r.temp > a.temp ? r : a), pool[0]);
  const feel = Math.round(cold.feels) <= Math.round(cold.temp) - 3 ? `, feels ${Math.round(cold.feels)}°` : '';
  items.push({ b: 'Coldest', t: `${hh(cold)}:00 (${Math.round(cold.temp)}°${feel})` });
  if (warm !== cold && Math.round(warm.temp) > Math.round(cold.temp)) items.push({ b: 'Warmest', t: `${hh(warm)}:00 (${Math.round(warm.temp)}°)` });
  return items.slice(0, max);
}

function nightSummary(rows) {
  const items = [];
  const wins = rainWindows(rows);
  if (wins.length) {
    for (const w of wins.slice(0, 2)) items.push({ b: w.word, t: span(rows, w) + (w.peak && w.hours > 2 ? `, heaviest ~${hh(w.peak)}:00` : '') });
    const last = wins[wins.length - 1];
    if (last.e < rows.length - 1) items.push({ b: 'Dry', t: `from ${endHH(rows[last.e])}:00` });
  } else {
    const maybe = rows.filter((r) => r.pop >= 30).sort((a, b) => b.pop - a.pop)[0];
    items.push(maybe ? { b: 'Mostly dry', t: `chance of a shower ~${hh(maybe)}:00` } : { b: 'Dry', t: 'all night' });
  }
  const gusts = runs(rows, (r) => r.gust >= 45, 1)[0];
  if (gusts) items.push({ b: 'Gusts', t: `up to ${Math.round(Math.max(...rows.slice(gusts.s, gusts.e + 1).map((r) => r.gust)))} km/h ${span(rows, gusts, false)}` });
  const low = rows.reduce((a, r) => (r.temp < a.temp ? r : a), rows[0]);
  const feel = Math.round(low.feels) <= Math.round(low.temp) - 3 ? `, feels ${Math.round(low.feels)}°` : '';
  items.push({ b: 'Low', t: `${Math.round(low.temp)}° at ${hh(low)}:00${feel}` });
  const frost = runs(rows, (r) => r.temp <= 0)[0];
  if (frost) items.push({ b: 'Frost', t: `from ${hh(rows[frost.s])}:00` });
  return items;
}

// Hour-by-hour chart: icons + temperatures every 3 h, a rain-chance bar per hour
// (darker = actually wet), hour labels. dayBreak labels midnight with the day name.
export function chartSVG(rows, dayNameAt) {
  const W = 1000, H = 205, n = rows.length, cw = W / n;
  const barTop = 108, barBottom = 168, barMax = barBottom - barTop;
  let s = '';
  // rain windows: a light band behind the bars
  for (const w of rainWindows(rows)) {
    s += `<rect x="${(w.s * cw).toFixed(1)}" y="${barTop - 6}" width="${((w.e - w.s + 1) * cw).toFixed(1)}" height="${barMax + 6}" fill="#ececec"/>`;
  }
  rows.forEach((r, i) => {
    const x = i * cw;
    if (r.pop >= 5) {
      const h = Math.max(4, (r.pop / 100) * barMax);
      const fill = r.mm >= 1 ? '#000' : r.mm >= 0.2 ? '#555' : '#b5b5b5';
      s += `<rect x="${(x + cw * 0.16).toFixed(1)}" y="${(barBottom - h).toFixed(1)}" width="${(cw * 0.68).toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"/>`;
    }
    if (r.hour % 3 === 0) {
      const cx = x + cw / 2;
      s += `<g transform="translate(${(cx - 19).toFixed(1)} 0)">${icon(iconKind(r.code, r.isDay), 38).replace('<svg ', '<svg x="0" y="0" ')}</g>`;
      s += `<text x="${cx.toFixed(1)}" y="80" text-anchor="middle" font-size="30" font-weight="700">${Math.round(r.temp)}°</text>`;
      const label = r.hour === 0 && dayNameAt ? dayNameAt(r) : hh(r);
      s += `<text x="${cx.toFixed(1)}" y="198" text-anchor="middle" font-size="25" fill="#333" ${r.hour === 0 ? 'font-weight="700"' : ''}>${label}</text>`;
      s += `<line x1="${cx.toFixed(1)}" y1="${barBottom}" x2="${cx.toFixed(1)}" y2="${barBottom + 6}" stroke="#000" stroke-width="2"/>`;
    }
    if (r.hour === 0 && i > 0) s += `<line x1="${x.toFixed(1)}" y1="90" x2="${x.toFixed(1)}" y2="${barBottom}" stroke="#000" stroke-width="2" stroke-dasharray="4 4"/>`;
  });
  s += `<line x1="0" y1="${barBottom}" x2="${W}" y2="${barBottom}" stroke="#000" stroke-width="2.5"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="DM Sans, sans-serif">${s}</svg>`;
}
