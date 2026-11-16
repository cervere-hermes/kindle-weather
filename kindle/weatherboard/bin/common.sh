#!/bin/sh
# Shared helpers for Weatherboard.
EXT=/mnt/us/weatherboard
. "$EXT/weather.conf"
LOG="$EXT/log.txt"
IMG=/tmp/weatherboard.png
PIDFILE=/tmp/weatherboard.pid

for f in /mnt/us/libkh/bin/fbink /usr/bin/fbink /mnt/us/usbnet/bin/fbink; do
  [ -x "$f" ] && FBINK="$f" && break
done

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

screen_size() {
  eval "$($FBINK -e 2>/dev/null)"
  W=${viewWidth:-1072}; H=${viewHeight:-1448}
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

fetch() {
  screen_size
  for size in "${W}x${H}" "${H}x${W}" "1072x1448"; do
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

refresh() {
  if wifi_up && fetch; then
    draw; log "drew $FETCHED_SIZE"
  else
    log "fetch failed, keeping last image"
    [ -f "$IMG" ] && draw
    $FBINK -q -m -y -2 "Offline - showing last forecast"
  fi
  wifi_down
}
