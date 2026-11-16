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

fetch() {
  screen_size
  for size in "${W}x${H}" "1072x1448"; do
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
