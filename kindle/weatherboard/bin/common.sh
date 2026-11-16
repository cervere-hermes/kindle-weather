#!/bin/sh
# Shared helpers for Weatherboard.
EXT=/mnt/us/weatherboard
. "$EXT/weather.conf"
# Optional GitHub token, kept in its own file so weather.conf can be replaced freely.
GH_TOKEN=; [ -f "$EXT/github-token" ] && GH_TOKEN=$(tr -d ' \t\r\n' < "$EXT/github-token")
LOG="$EXT/log.txt"
IMG=/tmp/weatherboard.png
PIDFILE=/tmp/weatherboard.pid

for f in /mnt/us/libkh/bin/fbink /usr/bin/fbink /mnt/us/usbnet/bin/fbink; do
  [ -x "$f" ] && FBINK="$f" && break
done

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

num() { tr -cd '0-9'; }

screen_size() {
  # 1) fixed size from weather.conf, e.g. SCREEN=600x800
  if [ -n "$SCREEN" ]; then W=${SCREEN%x*}; H=${SCREEN#*x}; return; fi
  W=; H=
  # 2) FBInk's eval output (viewWidth=600;viewHeight=800;...), parsed without eval
  raw=$($FBINK -e 2>&1)
  W=$(echo "$raw" | tr ';' '\n' | grep -m1 '^ *viewWidth=' | num)
  H=$(echo "$raw" | tr ';' '\n' | grep -m1 '^ *viewHeight=' | num)
  # 3) eips framebuffer info (xres: 600 ... yres: 800)
  if [ -z "$W" ] || [ -z "$H" ]; then
    info=$(eips -i 2>/dev/null)
    W=$(echo "$info" | grep -o 'xres:[ ]*[0-9]*' | head -1 | num)
    H=$(echo "$info" | grep -o 'yres:[ ]*[0-9]*' | head -1 | num)
  fi
  # 4) kernel framebuffer mode, e.g. U:600x800p-0
  if [ -z "$W" ] || [ -z "$H" ]; then
    mode=$(head -1 /sys/class/graphics/fb0/modes 2>/dev/null | grep -o '[0-9]*x[0-9]*' | head -1)
    W=${mode%x*}; H=${mode#*x}
  fi
  if [ -z "$W" ] || [ -z "$H" ]; then
    log "screen size unknown; fbink -e said: $(echo "$raw" | head -c 300)"
    W=600; H=800
  fi
  # portrait: width is the short side
  if [ "$W" -gt "$H" ]; then t=$W; W=$H; H=$t; fi
  log "screen ${W}x${H}"
}

wifi_up() {
  lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null
  i=0
  while [ $i -lt 45 ]; do
    [ "$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null)" = "CONNECTED" ] && return 0
    sleep 1; i=$((i + 1))
  done
  return 1
}

wifi_down() { [ "$WIFI_SAVER" = "1" ] && lipc-set-prop com.lab126.cmd wirelessEnable 0 2>/dev/null; }

# GitHub API helpers (used only when GH_TOKEN is set in weather.conf)
api() { # api <path> [extra curl args...]
  p=$1; shift
  curl -fsSk --max-time 40 -H "Authorization: Bearer $GH_TOKEN" -H "X-GitHub-Api-Version: 2022-11-28" "$@" "https://api.github.com/repos/$p"
}

# The renderedAt stamp of the newest published render (via the API: no CDN cache).
rendered_at() {
  api "$ARTIFACTS_REPO/contents/model.json?ref=main" -H "Accept: application/vnd.github.raw" 2>/dev/null \
    | grep -o '"renderedAt": *"[^"]*"' | head -1 | sed 's/.*: *"//; s/"$//'
}

# Ask GitHub Actions for a fresh render and wait (up to ~4 min) until it is published.
trigger_render() {
  [ -n "$GH_TOKEN" ] || return 1
  before=$(rendered_at)
  code=$(curl -sk --max-time 30 -o /dev/null -w '%{http_code}' -X POST \
    -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" \
    -d '{"ref":"main"}' "https://api.github.com/repos/$CODE_REPO/actions/workflows/render.yml/dispatches")
  if [ "$code" != "204" ]; then log "render request failed (HTTP $code) - check GH_TOKEN"; return 1; fi
  log "render requested (last render $before)"
  i=0
  while [ $i -lt 24 ]; do
    sleep 10; i=$((i + 1))
    now=$(rendered_at)
    if [ -n "$now" ] && [ "$now" != "$before" ]; then log "fresh render $now after $((i * 10))s"; return 0; fi
  done
  log "no fresh render after 4 min, using the latest one"
  return 1
}

fetch() {
  screen_size
  for size in "${W}x${H}" "1072x1448"; do
    if [ -n "$GH_TOKEN" ] && api "$ARTIFACTS_REPO/contents/weather-$size.png?ref=main" \
         -H "Accept: application/vnd.github.raw" -o "$IMG.tmp" 2>>"$LOG"; then
      mv "$IMG.tmp" "$IMG"; FETCHED_SIZE=$size; return 0
    fi
    if curl -fsSL -k --max-time 40 -o "$IMG.tmp" "$BASE_URL/weather-$size.png?t=$(date +%s)" 2>>"$LOG" \
       || wget -q -T 40 -O "$IMG.tmp" "$BASE_URL/weather-$size.png" 2>>"$LOG"; then
      mv "$IMG.tmp" "$IMG"; FETCHED_SIZE=$size; return 0
    fi
  done
  return 1
}

draw() {
  if [ "$FETCHED_SIZE" = "${W}x${H}" ]; then
    $FBINK -q -c -f -g file="$IMG"
  else
    $FBINK -q -c -f -g file="$IMG",w="$W",h="$H"
  fi
  bat=$(lipc-get-prop com.lab126.powerd battLevel 2>/dev/null)
  if [ -n "$bat" ] && [ "$bat" -lt 15 ]; then
    $FBINK -q -m -y -3 "Battery $bat% - please charge me"
  fi
}

refresh() { # refresh [now]  - "now" asks GitHub for a fresh render first
  if wifi_up; then
    [ "$1" = "now" ] && trigger_render
    if fetch; then draw; log "drew $FETCHED_SIZE"; wifi_down; return; fi
  fi
  log "fetch failed, keeping last image"
  [ -f "$IMG" ] && draw
  $FBINK -q -m -y -2 "Offline - showing last forecast"
  wifi_down
}
