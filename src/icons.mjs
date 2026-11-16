// Line-art weather icons for e-ink. Every icon lives in a 64x64 box.
const S = 'stroke="#000" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"';

const cloudPath = (dx = 0, dy = 0, s = 1) =>
  `<path transform="translate(${dx} ${dy}) scale(${s})" d="M18 46h30a10 10 0 0 0 1-20 14 14 0 0 0-27-3 10 10 0 0 0-4 23z" fill="#fff" ${S}/>`;

const sun = (cx = 32, cy = 32, r = 10) => {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 5), y1 = cy + Math.sin(a) * (r + 5);
    const x2 = cx + Math.cos(a) * (r + 11), y2 = cy + Math.sin(a) * (r + 11);
    rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${S}/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" ${S}/>${rays}`;
};

const moon = (dx = 0, dy = 0, s = 1) =>
  `<path transform="translate(${dx} ${dy}) scale(${s})" d="M40 12a20 20 0 1 0 14 30 16 16 0 0 1-14-30z" fill="#fff" ${S}/>`;

const drops = (n, y = 50, slant = 3) => {
  const xs = n === 2 ? [26, 38] : [22, 32, 42];
  return xs.map((x) => `<line x1="${x}" y1="${y}" x2="${x - slant}" y2="${y + 9}" ${S}/>`).join('');
};

const flakes = (y = 54) =>
  [22, 32, 42].map((x, i) => {
    const yy = y + (i % 2) * 5;
    return `<g ${S}><line x1="${x - 3.5}" y1="${yy}" x2="${x + 3.5}" y2="${yy}"/><line x1="${x - 2}" y1="${yy - 3}" x2="${x + 2}" y2="${yy + 3}"/><line x1="${x + 2}" y1="${yy - 3}" x2="${x - 2}" y2="${yy + 3}"/></g>`;
  }).join('');

export function iconKind(code, isDay = 1) {
  if (code === 0 || code === 1) return isDay ? 'sun' : 'moon';
  if (code === 2) return isDay ? 'partly-day' : 'partly-night';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'cloud';
}

export function conditionText(code, isDay = 1) {
  const m = {
    0: isDay ? 'Clear sky' : 'Clear night', 1: isDay ? 'Mostly sunny' : 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
    85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunder & hail', 99: 'Thunder & hail',
  };
  return m[code] ?? 'Cloudy';
}

export function icon(kind, size = 64) {
  let body = '';
  switch (kind) {
    case 'sun': body = sun(); break;
    case 'moon': body = moon(-4, 2, 1.05); break;
    case 'partly-day': body = sun(24, 22, 8) + cloudPath(6, 6, 0.95); break;
    case 'partly-night': body = moon(-12, -6, 0.8) + cloudPath(6, 6, 0.95); break;
    case 'cloud': body = cloudPath(0, 2); break;
    case 'fog': body = cloudPath(0, -6) + `<line x1="12" y1="50" x2="52" y2="50" ${S}/><line x1="18" y1="57" x2="46" y2="57" ${S}/>`; break;
    case 'drizzle': body = cloudPath(0, -6) + drops(2, 47, 2); break;
    case 'rain': body = cloudPath(0, -6) + drops(3, 46, 3); break;
    case 'snow': body = cloudPath(0, -8) + flakes(50); break;
    case 'thunder': body = cloudPath(0, -6) + `<path d="M34 42l-7 10h8l-5 9" fill="none" ${S}/>`; break;
    default: body = cloudPath();
  }
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}
