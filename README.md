# Kindle Weatherboard

An e-ink weather dashboard for a jailbroken Kindle, with **Wim**, a little avatar who dresses for the weather (coat, scarf, umbrella, shades, ...).

- `src/` renders the dashboard: Open-Meteo data -> HTML + SVG -> PNG (headless Chrome), at every Kindle resolution in `config.json`.
- `.github/workflows/render.yml` re-renders twice an hour and force-pushes the PNGs to the public repo `cervere-hermes/kindle-weather-artifacts` (this code repo stays private).
- `kindle/` holds the on-device part, for modern jailbreaks (SpiderCat, WinterBreak...) that run **scriptlets** (KUAL is obsolete there):
  - copy `kindle/weatherboard/` to the Kindle root (`/mnt/us/weatherboard`): the fetch/draw scripts and `weather.conf`;
  - copy `kindle/documents/*.sh` into the Kindle's `documents` folder: they show up as books, **Weatherboard - Start** and **Weatherboard - Show once**.
  - On macOS, run `dot_clean -m` on both folders afterwards, or the `._*.sh` files show up as broken books.
  - Start draws over the Kindle home screen and holds the touchscreen (via `bin/evgrab`), so taps reach the dashboard. Tap once for a fresh forecast; double-tap to go straight back to home. Plugging in USB hands over to the Kindle's USB screen.
  - Set `SCREEN=WxH` in `weather.conf` if the image does not fit (e.g. `600x800` on a basic Kindle).

Local preview: `node src/render.mjs` (needs Google Chrome), `node src/render.mjs --demo` for the outfit sheet.

After 19:00 the avatar dresses for tomorrow. Change the city or that hour in `config.json`.

## One-time setup: let the workflow push to the artifacts repo

Create a fine-grained personal access token (GitHub -> Settings -> Developer settings -> Fine-grained tokens):
- Resource owner: `cervere-hermes`
- Repository access: only `kindle-weather-artifacts`
- Permissions: Contents -> Read and write

Then store it in the code repo: `gh secret set ARTIFACTS_TOKEN -R cervere-hermes/kindle-weather` (paste the token when asked).

(An SSH deploy key with write access in secret `ARTIFACTS_DEPLOY_KEY` also works, if deploy keys are allowed.)

## Optional: tap for a fresh render

With a token on the Kindle, a single tap asks GitHub Actions to render right now and draws the result (about 1-2 minutes).

1. Create a fine-grained token: Resource owner `cervere-hermes`, repository access **only `kindle-weather`**, permissions **Actions: Read and write** (nothing else). Give it an expiry you're happy to renew.
2. Save it on the Kindle as `weatherboard/github-token` (a plain text file holding only the token). It is never in this repo, and updating the other files leaves it alone.

The token sits in plain text on the Kindle; it can only start this workflow. If it is missing, expired or rejected, a tap simply fetches the latest published image (`log.txt` says `render request failed (HTTP 401)`).

## evgrab (touch helper)

`kindle/evgrab/evgrab.c` is a ~2 KB freestanding program for 32-bit ARM Linux. It grabs the touchscreen
exclusively (EVIOCGRAB) and prints `T <time>` per finger press, sleeping in `poll()` otherwise.
Killing it, or the dashboard script dying, gives the touchscreen back. Rebuild on macOS without extra tools:

```
clang --target=armv7a-linux-gnueabihf -marm -mfloat-abi=soft -Os -ffreestanding -fno-stack-protector -fno-builtin -nostdlib -c kindle/evgrab/evgrab.c -o /tmp/evgrab.o
~/.rustup/toolchains/*/lib/rustlib/*/bin/rust-lld -flavor gnu -static -e _start -o kindle/weatherboard/bin/evgrab /tmp/evgrab.o
```
