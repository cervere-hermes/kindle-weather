// Decide what the avatar wears from a window of forecast hours.
// w = { feels, tmin, tmax, rainProb, rainMm, rainFrom, snow, wind, sunny, uv, isDay, hot }

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

export function decideOutfit(w, seed = 0) {
  const T = w.feels;
  const rainy = w.rainProb >= 50 || w.rainMm >= 1;
  const stormy = w.wind >= 40;
  const o = {
    pants: 'jeans', shoes: 'sneakers', top: 'tee', outer: null,
    scarf: false, beanie: false, gloves: false, cap: false, shades: false,
    umbrella: false, hood: false, windy: w.wind >= 28, mood: 'happy',
    scene: w.snow ? 'snow' : rainy ? 'rain' : w.sunny ? (w.isDay ? 'sun' : 'moon') : 'cloud',
    items: [],
  };

  if (T >= 25) { o.top = 'tee'; o.pants = 'shorts'; }
  else if (T >= 20) { o.top = 'tee'; }
  else if (T >= 15) { o.top = 'sweater'; }
  else if (T >= 10) { o.top = 'sweater'; o.outer = 'jacket'; }
  else if (T >= 4) { o.top = 'sweater'; o.outer = 'coat'; o.scarf = true; o.pants = 'trousers'; }
  else { o.top = 'sweater'; o.outer = 'puffer'; o.scarf = true; o.beanie = true; o.gloves = true; o.pants = 'trousers'; o.shoes = 'boots'; }

  if (rainy) {
    if (stormy) { o.outer = T >= 4 ? 'raincoat' : o.outer; o.hood = true; }
    else o.umbrella = true;
    if (T >= 10 && T < 25 && !o.umbrella) o.outer = 'raincoat';
    if (o.shoes === 'sneakers') o.shoes = 'rainboots';
  }
  if (w.snow) { o.shoes = 'snowboots'; o.beanie = true; o.gloves = true; o.scarf = true; o.umbrella = false; }
  if (o.windy && T < 15) o.scarf = true;
  if (w.sunny && w.isDay && T >= 14 && !rainy) o.shades = true;
  if (w.sunny && w.isDay && T >= 22 && !rainy) o.cap = true;

  if (T >= 29) o.mood = 'hot';
  else if (T <= 2) o.mood = 'cold';
  else if (rainy && !o.umbrella) o.mood = 'meh';
  else if (w.sunny || T >= 18) o.mood = 'happy';
  else o.mood = 'calm';

  const name = {
    tee: T >= 25 ? 'T-shirt' : 'Striped tee', sweater: 'Knit sweater',
    jacket: 'Light jacket', coat: 'Wool coat', puffer: 'Puffer jacket', raincoat: 'Raincoat',
    shorts: 'Shorts', jeans: 'Jeans', trousers: 'Warm trousers',
    sneakers: 'Sneakers', boots: 'Boots', rainboots: 'Rain boots', snowboots: 'Snow boots',
  };
  if (o.outer) o.items.push(name[o.outer]);
  o.items.push(name[o.top], name[o.pants]);
  if (o.scarf) o.items.push('Scarf');
  if (o.beanie) o.items.push('Beanie');
  if (o.gloves) o.items.push('Gloves');
  o.items.push(name[o.shoes]);
  if (o.umbrella) o.items.push('Umbrella');
  if (o.cap) o.items.push('Cap');
  if (o.shades) o.items.push('Sunglasses');
  if (w.uv >= 5 && w.isDay) o.items.push('Sunscreen');

  const f = Math.round(w.feels);
  let lines;
  if (w.snow) lines = ['Snow day! Boots on.', 'Careful, it might be slippery.', 'Snowball weather.'];
  else if (rainy && stormy) lines = ['Too windy for an umbrella. Hood up!', 'Wild out there. Raincoat it is.'];
  else if (rainy) lines = w.rainFrom ? [`Umbrella from ${w.rainFrom}.`, `Rain rolls in around ${w.rainFrom}.`, `Dry until ${w.rainFrom}, then wet.`] : ['Bring the umbrella.', 'Wet one today.'];
  else if (T >= 29) lines = ['Hydrate. Shade. Repeat.', 'Way too hot. Ice cream?', 'Hot one. Keep it light.'];
  else if (T <= 2) lines = [`Feels like ${f}°. Wrap up!`, 'Brrr. All the layers.', 'Gloves on. No excuses.'];
  else if (o.windy) lines = ['Hold on to your hat!', 'Windy out. Zip up.', 'Breezy one today.'];
  else if (w.sunny && w.isDay && T >= 18) lines = ['Sunglasses weather!', 'Gorgeous out. Go outside!', 'Proper sunny day.'];
  else if (T >= 15) lines = ['Mild and easy.', 'Nice in a sweater.', 'Comfy out there.'];
  else if (T >= 8) lines = ['Jacket weather.', 'A bit crisp. Layer up.', 'Fresh out there.'];
  else lines = [`Feels like ${f}°. Coat on.`, 'Cold out. Scarf on.', 'Proper coat weather.'];
  o.line = pick(lines, seed);
  return o;
}
