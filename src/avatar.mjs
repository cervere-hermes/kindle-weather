// "Wim", the dress-for-the-weather avatar. Pure SVG line art, tuned for e-ink:
// thick black outlines, flat greys and a few hatch patterns.
const K = 'stroke="#000" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';

const defs = `
<defs>
  <pattern id="stripes" width="8" height="9" patternUnits="userSpaceOnUse">
    <rect width="8" height="9" fill="#fff"/><rect y="5" width="8" height="4" fill="#3a3a3a"/>
  </pattern>
  <pattern id="denim" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
    <rect width="6" height="6" fill="#b4b4b4"/><line x1="0" y1="0" x2="0" y2="6" stroke="#7a7a7a" stroke-width="2"/>
  </pattern>
  <pattern id="knit" width="10" height="8" patternUnits="userSpaceOnUse">
    <rect width="10" height="8" fill="#8f8f8f"/><path d="M0 1l5 5 5-5" fill="none" stroke="#b9b9b9" stroke-width="1.6"/>
  </pattern>
  <pattern id="check" width="10" height="10" patternUnits="userSpaceOnUse">
    <rect width="10" height="10" fill="#e8e8e8"/><rect width="5" height="10" fill="#555"/><rect width="10" height="5" fill="#555" opacity=".55"/>
  </pattern>
  <pattern id="quilt" width="12" height="12" patternUnits="userSpaceOnUse">
    <rect width="12" height="12" fill="#d2d2d2"/><circle cx="6" cy="6" r="1" fill="#9a9a9a"/>
  </pattern>
</defs>`;

const limb = (d, fill, w = 13) =>
  `<path d="${d}" fill="none" stroke="#000" stroke-width="${w + 6}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// deterministic pseudo-random for scene particles
const rng = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

function scene(o) {
  let s = '';
  const S = 'stroke="#000" stroke-width="3" stroke-linecap="round" fill="none"';
  if (o.scene === 'sun') {
    let rays = '';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      rays += `<line x1="${(10 + Math.cos(a) * 30).toFixed(1)}" y1="${(42 + Math.sin(a) * 30).toFixed(1)}" x2="${(10 + Math.cos(a) * 42).toFixed(1)}" y2="${(42 + Math.sin(a) * 42).toFixed(1)}" ${S}/>`;
    }
    s += `<circle cx="10" cy="42" r="22" fill="#fff" ${K}/>${rays}`;
  }
  if (o.scene === 'moon') {
    s += `<path d="M14 18a26 26 0 1 0 22 40 21 21 0 0 1-22-40z" fill="#fff" ${K}/>`;
    for (const [x, y] of [[230, 30], [205, 70], [250, 110], [-10, 120]]) {
      s += `<path d="M${x} ${y - 7}v14M${x - 7} ${y}h14" ${S}/>`;
    }
  }
  if (o.scene === 'cloud' || o.scene === 'rain' || o.scene === 'snow') {
    const cloud = (x, y, k) => `<path transform="translate(${x} ${y}) scale(${k})" d="M18 46h30a10 10 0 0 0 1-20 14 14 0 0 0-27-3 10 10 0 0 0-4 23z" fill="${o.scene === 'cloud' ? '#fff' : '#cfcfcf'}" stroke="#000" stroke-width="${3 / k}" stroke-linejoin="round"/>`;
    s += cloud(-34, -2, 1.5);
    if (!o.umbrella) s += cloud(170, 6, 1.25);
  }
  const r = rng(7);
  if (o.scene === 'rain') {
    const slant = o.windy ? 9 : 3;
    for (let i = 0; i < 26; i++) {
      const x = -25 + r() * 290, y = 70 + r() * 200;
      if (o.umbrella && x > 60 && x < 240 && y > 40) continue; // dry under the umbrella
      if (!o.umbrella && x > 78 && x < 166 && y > 60) continue;
      s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - slant).toFixed(1)}" y2="${(y + 13).toFixed(1)}" ${S}/>`;
    }
    s += `<ellipse cx="20" cy="330" rx="34" ry="5" fill="#bbb" stroke="#000" stroke-width="2"/><ellipse cx="225" cy="331" rx="26" ry="4" fill="#bbb" stroke="#000" stroke-width="2"/>`;
  }
  if (o.scene === 'snow') {
    for (let i = 0; i < 20; i++) {
      const x = -25 + r() * 290, y = 70 + r() * 220;
      if (x > 78 && x < 166 && y > 60) continue;
      const k = 4 + r() * 3;
      s += `<path d="M${(x - k).toFixed(1)} ${y.toFixed(1)}h${(2 * k).toFixed(1)}M${(x - k / 2).toFixed(1)} ${(y - k * 0.86).toFixed(1)}l${k.toFixed(1)} ${(k * 1.72).toFixed(1)}M${(x + k / 2).toFixed(1)} ${(y - k * 0.86).toFixed(1)}l${(-k).toFixed(1)} ${(k * 1.72).toFixed(1)}" stroke="#000" stroke-width="2.4" stroke-linecap="round"/>`;
    }
  }
  if (o.windy) {
    s += `<path d="M-28 150h46a9 9 0 1 0-9-9M-24 182h62a10 10 0 1 1-10 10M196 214h50" ${S}/>`;
  }
  // ground
  if (o.scene === 'snow') s += `<path d="M-30 324q60-12 120-4t120 0 60-2v22h-300z" fill="#fff" ${K}/>`;
  else s += `<line x1="-26" y1="323" x2="266" y2="323" ${K}/>`;
  return s;
}

export function avatarSVG(o) {
  const parts = [defs, scene(o)];
  const p = (x) => parts.push(x);

  const outerFill = { jacket: '#5c5c5c', coat: '#333', puffer: 'url(#quilt)', raincoat: '#e2e2e2' }[o.outer];
  const topFill = o.top === 'tee' ? 'url(#stripes)' : 'url(#knit)';
  const sleeveFill = outerFill || topFill;
  const longSleeve = !!o.outer || o.top !== 'tee';

  // --- hood (behind head) ---
  if (o.hood) p(`<circle cx="120" cy="100" r="37" fill="${outerFill || '#e2e2e2'}" ${K}/>`);

  // --- legs / pants ---
  const legL = 'M90,222 L119,222 L117,306 L93,306 Z', legR = 'M121,222 L150,222 L147,306 L123,306 Z';
  if (o.pants === 'shorts') {
    p(`<path d="M93,240 L117,240 L116,306 L96,306 Z" fill="#fff" ${K}/><path d="M123,240 L147,240 L144,306 L124,306 Z" fill="#fff" ${K}/>`);
    p(`<path d="M88,222 L152,222 L153,266 L123,266 L120,246 L117,266 L87,266 Z" fill="#777" ${K}/>`);
  } else {
    const f = o.pants === 'jeans' ? 'url(#denim)' : '#4a4a4a';
    p(`<path d="${legL}" fill="${f}" ${K}/><path d="${legR}" fill="${f}" ${K}/>`);
  }

  // --- shoes ---
  const shoeL = { sneakers: 'M84,320 Q83,305 96,305 L117,305 L118,320 Z', tall: 'M90,280 L118,280 L118,320 L81,320 Q81,307 90,305 Z' };
  const shoeR = { sneakers: 'M156,320 Q157,305 144,305 L123,305 L122,320 Z', tall: 'M150,280 L122,280 L122,320 L159,320 Q159,307 150,305 Z' };
  if (o.shoes === 'sneakers') {
    p(`<path d="${shoeL.sneakers}" fill="#fff" ${K}/><path d="${shoeR.sneakers}" fill="#fff" ${K}/>`);
    p(`<path d="M85,315 L117,315 M155,315 L123,315" stroke="#000" stroke-width="2.4"/>`);
  } else {
    const f = { boots: '#6b6b6b', rainboots: '#262626', snowboots: '#f2f2f2' }[o.shoes];
    p(`<path d="${shoeL.tall}" fill="${f}" ${K}/><path d="${shoeR.tall}" fill="${f}" ${K}/>`);
    if (o.shoes === 'rainboots') p(`<path d="M97,286 L97,300 M145,286 L145,300" stroke="#9a9a9a" stroke-width="3" stroke-linecap="round"/>`);
    if (o.shoes === 'boots') p(`<path d="M104,286h8M104,293h8M128,286h8M128,293h8" stroke="#fff" stroke-width="2"/>`);
    if (o.shoes === 'snowboots') p(`<path d="M86,278 h34 v12 h-34z M120,278 h34 v12 h-34z" fill="#bdbdbd" ${K}/>`);
  }

  // --- neck + top ---
  p(`<path d="M113,120 L127,120 L127,138 L113,138 Z" fill="#fff" ${K}/>`);
  p(`<path d="M86,140 Q88,134 96,134 L144,134 Q152,134 154,140 L150,226 L90,226 Z" fill="${topFill}" ${K}/>`);
  if (o.top === 'tee') p(`<path d="M107,134 Q120,147 133,134 Z" fill="#fff" ${K}/>`);
  else p(`<path d="M106,134 Q120,145 134,134" fill="none" stroke="#000" stroke-width="6"/><path d="M92,218 L148,218" stroke="#000" stroke-width="2"/>`);

  // --- outer layer ---
  if (o.outer === 'jacket') {
    p(`<path d="M85,140 Q87,133 96,133 L111,133 L114,230 L88,230 Z" fill="${outerFill}" ${K}/>`);
    p(`<path d="M155,140 Q153,133 144,133 L129,133 L126,230 L152,230 Z" fill="${outerFill}" ${K}/>`);
    p(`<path d="M98,133 L111,133 L106,152 Z M142,133 L129,133 L134,152 Z" fill="#8a8a8a" ${K}/>`);
    p(`<path d="M93,190 h12 M135,190 h12" stroke="#fff" stroke-width="2.4"/>`);
  } else if (o.outer === 'coat') {
    p(`<path d="M84,140 Q86,133 96,133 L144,133 Q154,133 156,140 L162,270 L78,270 Z" fill="${outerFill}" ${K}/>`);
    p(`<path d="M104,133 L120,164 L136,133" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M120,164 L120,270" stroke="#777" stroke-width="2"/>`);
    for (const y of [180, 206, 232]) p(`<circle cx="126" cy="${y}" r="3.4" fill="#fff" stroke="#000" stroke-width="1.5"/>`);
    p(`<path d="M90,214 h16 M134,214 h16" stroke="#888" stroke-width="2.4"/>`);
  } else if (o.outer === 'puffer') {
    p(`<path d="M80,142 Q82,130 96,130 L144,130 Q158,130 160,142 L163,242 Q120,250 77,242 Z" fill="${outerFill}" ${K}/>`);
    for (const y of [160, 182, 204, 226]) p(`<path d="M80,${y} Q120,${y + 7} 160,${y}" fill="none" stroke="#000" stroke-width="2"/>`);
    p(`<path d="M120,132 L120,246" stroke="#000" stroke-width="2.4"/><path d="M98,128 Q120,140 142,128 L142,138 Q120,150 98,138 Z" fill="#bdbdbd" ${K}/>`);
  } else if (o.outer === 'raincoat') {
    p(`<path d="M82,140 Q84,132 96,132 L144,132 Q156,132 158,140 L165,258 L75,258 Z" fill="${outerFill}" ${K}/>`);
    p(`<path d="M120,140 L120,258" stroke="#000" stroke-width="2.4"/>`);
    for (const y of [160, 190, 220, 246]) p(`<circle cx="125" cy="${y}" r="2.6" fill="#000"/>`);
    p(`<path d="M88,200 h18 v14 h-18z M134,200 h18 v14 h-18z" fill="none" stroke="#000" stroke-width="2"/>`);
  }

  // --- scarf ---
  if (o.scarf) {
    p(`<path d="M99,128 Q120,142 141,128 L143,141 Q120,155 97,141 Z" fill="url(#check)" ${K}/>`);
    if (o.windy) p(`<path d="M138,136 Q172,124 206,136 L204,148 Q172,138 140,148 Z" fill="url(#check)" ${K}/><path d="M206,136 l7,-2 M205,142 l8,0 M204,148 l7,2" stroke="#000" stroke-width="2"/>`);
    else p(`<path d="M126,142 L137,194 L124,197 L116,145 Z" fill="url(#check)" ${K}/><path d="M125,197 l-1,7 M130,196 l0,7 M135,195 l1,7" stroke="#000" stroke-width="2"/>`);
  }

  // --- arms + hands ---
  const handFill = o.gloves ? '#444' : '#fff';
  const armL = 'M88,146 L80,182 L77,210';
  const armR = o.umbrella ? 'M152,146 L166,190 L182,178' : 'M152,146 L160,182 L163,210';
  if (o.umbrella) {
    // umbrella sits behind the hand but in front of the body
    const ribs = [], pts = [];
    for (let i = 0; i <= 6; i++) pts.push([95 + (i * 170) / 6, 80]);
    for (let i = 0; i < 6; i++) if (i % 2 === 0) ribs.push(`<path d="M180,37 L${pts[i][0]},80 L${pts[i + 1][0]},80 Z" fill="#9a9a9a"/>`);
    let scallop = '';
    for (let i = 6; i > 0; i--) scallop += ` Q${pts[i][0] - 14.2},68 ${pts[i - 1][0]},80`;
    p(`<g transform="rotate(-14 182 178)">
      <path d="M180,40 L180,198 Q180,210 171,210 Q163,210 163,202" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/>
      <path d="M95,80 Q180,-6 265,80 ${scallop} Z" fill="#fff"/>
      ${ribs.join('')}
      <path d="M95,80 Q180,-6 265,80 ${scallop} Z" fill="none" ${K}/>
      ${pts.slice(1, 6).map(([x]) => `<path d="M180,37 L${x},80" stroke="#000" stroke-width="2"/>`).join('')}
      <path d="M180,37 L180,26" stroke="#000" stroke-width="4" stroke-linecap="round"/>
    </g>`);
  }
  for (const a of [armL, armR]) {
    p(limb(a, '#fff', 12));
    if (longSleeve) p(limb(a.replace(/L(\d+),(\d+)$/, (m, x, y) => {
      // shorten the sleeve a little so the wrist shows
      const pts = a.match(/[\d.]+/g).map(Number);
      const [x1, y1, x2, y2] = pts.slice(-4);
      return `L${(x2 - (x2 - x1) * 0.22).toFixed(1)},${(y2 - (y2 - y1) * 0.22).toFixed(1)}`;
    }), sleeveFill, o.outer ? 16 : 14));
    else {
      const pts = a.match(/[\d.]+/g).map(Number);
      p(limb(`M${pts[0]},${pts[1]} L${(pts[0] + (pts[2] - pts[0]) * 0.45).toFixed(1)},${(pts[1] + (pts[3] - pts[1]) * 0.45).toFixed(1)}`, sleeveFill, 17));
    }
  }
  p(`<circle cx="77" cy="212" r="7.5" fill="${handFill}" ${K}/>`);
  p(o.umbrella ? `<circle cx="183" cy="178" r="7.5" fill="${handFill}" ${K}/>` : `<circle cx="163" cy="212" r="7.5" fill="${handFill}" ${K}/>`);

  // --- head ---
  p(`<circle cx="93" cy="103" r="5.5" fill="#fff" ${K}/><circle cx="147" cy="103" r="5.5" fill="#fff" ${K}/>`);
  p(`<circle cx="120" cy="100" r="27" fill="#fff" ${K}/>`);
  if (o.hood) p(`<path d="M84,110 Q80,56 120,56 Q160,56 156,110 Q152,78 120,77 Q88,78 84,110 Z" fill="${outerFill || '#e2e2e2'}" ${K}/>`);
  else if (!o.beanie && !o.cap) p(`<path d="M93,97 Q91,70 120,71 Q149,70 147,97 Q142,84 130,86 Q124,79 112,86 Q100,84 93,97 Z" fill="#222" ${K}/>`);

  // face
  if (o.shades) {
    p(`<rect x="100" y="94" width="17" height="11" rx="4" fill="#111"/><rect x="123" y="94" width="17" height="11" rx="4" fill="#111"/><path d="M117,98 L123,98 M100,97 L94,95 M140,97 L146,95" stroke="#000" stroke-width="2.4"/>`);
  } else if (o.mood === 'happy') {
    p(`<path d="M105,102 Q110,96 115,102 M125,102 Q130,96 135,102" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round"/>`);
  } else {
    p(`<circle cx="110" cy="101" r="2.8" fill="#000"/><circle cx="130" cy="101" r="2.8" fill="#000"/>`);
  }
  const mouth = {
    happy: 'M110,111 Q120,121 130,111', calm: 'M113,113 Q120,117 127,113', meh: 'M113,115 L127,113',
    cold: 'M110,114 q2.5,-3 5,0 t5,0 t5,0 t5,0', hot: 'M115,112 Q120,120 125,112 Z',
  }[o.mood];
  p(`<path d="${mouth}" fill="${o.mood === 'hot' ? '#000' : 'none'}" stroke="#000" stroke-width="2.6" stroke-linecap="round"/>`);
  if (o.mood === 'cold') {
    p(`<circle cx="103" cy="109" r="4" fill="#c4c4c4"/><circle cx="137" cy="109" r="4" fill="#c4c4c4"/>`);
    p(`<path d="M80,84 l-6,4 6,4 -6,4 M160,84 l6,4 -6,4 6,4" fill="none" stroke="#000" stroke-width="2.2"/>`);
  }
  if (o.mood === 'hot') p(`<path d="M150,80 q-6,9 0,12 q6,-3 0,-12z" fill="#fff" stroke="#000" stroke-width="2.2"/>`);

  // hats
  if (o.beanie && !o.hood) {
    p(`<path d="M92,94 Q92,62 120,62 Q148,62 148,94 Z" fill="#555" ${K}/>`);
    p(`<path d="M89,86 L151,86 L151,98 L89,98 Z" fill="#888" ${K}/>`);
    p(`<path d="M97,87v10M105,87v10M113,87v10M121,87v10M129,87v10M137,87v10M145,87v10" stroke="#333" stroke-width="1.6"/>`);
    p(`<circle cx="120" cy="58" r="8" fill="#fff" ${K}/>`);
  }
  if (o.cap) {
    p(`<path d="M93,92 Q94,66 120,66 Q146,66 147,92 Z" fill="#444" ${K}/>`);
    p(`<path d="M138,89 L176,90 Q177,97 146,97 Z" fill="#444" ${K}/><circle cx="120" cy="66" r="3" fill="#000"/>`);
  }

  return `<svg viewBox="-30 0 300 340" xmlns="http://www.w3.org/2000/svg">${parts.join('\n')}</svg>`;
}
