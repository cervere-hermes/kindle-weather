# Kindle Weatherboard

An e-ink weather dashboard for a jailbroken Kindle, with **Wim**, a little avatar who dresses for the weather (coat, scarf, umbrella, shades, ...).

- `src/` renders the dashboard: Open-Meteo data -> HTML + SVG -> PNG (headless Chrome), at every Kindle resolution in `config.json`.
- `.github/workflows/render.yml` re-renders twice an hour and force-pushes the PNGs to the `images` branch.
- `kindle/extensions/weatherboard` is a KUAL extension that fetches the right PNG for the screen and draws it with FBInk.

Local preview: `node src/render.mjs` (needs Google Chrome), `node src/render.mjs --demo` for the outfit sheet.

After 19:00 the avatar dresses for tomorrow. Change the city or that hour in `config.json`.
