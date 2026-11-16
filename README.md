# Kindle Weatherboard

An e-ink weather dashboard for a jailbroken Kindle, with **Wim**, a little avatar who dresses for the weather (coat, scarf, umbrella, shades, ...).

- `src/` renders the dashboard: Open-Meteo data -> HTML + SVG -> PNG (headless Chrome), at every Kindle resolution in `config.json`.
- `.github/workflows/render.yml` re-renders twice an hour and force-pushes the PNGs to the public repo `cervere-hermes/kindle-weather-artifacts` (this code repo stays private).
- `kindle/extensions/weatherboard` is a KUAL extension that fetches the right PNG for the screen and draws it with FBInk.

Local preview: `node src/render.mjs` (needs Google Chrome), `node src/render.mjs --demo` for the outfit sheet.

After 19:00 the avatar dresses for tomorrow. Change the city or that hour in `config.json`.

## One-time setup: deploy key for the artifacts repo

The workflow pushes to `kindle-weather-artifacts` with an SSH deploy key:

1. `ssh-keygen -t ed25519 -N "" -C weatherboard-artifacts -f artifacts_key`
2. Add `artifacts_key.pub` to **kindle-weather-artifacts** -> Settings -> Deploy keys, with **Allow write access** ticked.
3. Add the private key as secret `ARTIFACTS_DEPLOY_KEY` in **kindle-weather**: `gh secret set ARTIFACTS_DEPLOY_KEY -R cervere-hermes/kindle-weather < artifacts_key`
4. Delete both local key files.
