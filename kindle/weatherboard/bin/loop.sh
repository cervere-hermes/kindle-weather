#!/bin/sh
. /mnt/us/weatherboard/bin/common.sh
echo $$ > "$PIDFILE"
tail -n 200 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
log "starting (fbink=$FBINK)"
# Hand the screen over: stop the stock UI and keep the screensaver away.
lipc-set-prop com.lab126.powerd preventScreenSaver 1 2>/dev/null
stop lab126_gui 2>/dev/null || /etc/init.d/framework stop 2>/dev/null
sleep 3

TOUCH=/tmp/weatherboard.touch

# Wait up to $1 seconds; return 0 early if the screen (or any button) is touched.
wait_or_touch() {
  : > "$TOUCH"
  pids=
  for dev in /dev/input/event*; do
    [ -e "$dev" ] || continue
    head -c 1 "$dev" >> "$TOUCH" 2>/dev/null &
    pids="$pids $!"
  done
  t=0
  while [ "$t" -lt "$1" ]; do
    [ -s "$TOUCH" ] && break
    sleep 1; t=$((t + 1))
  done
  kill $pids 2>/dev/null
  [ -s "$TOUCH" ]
}

exit_to_kindle() {
  log "touch detected, back to the normal Kindle"
  $FBINK -q -m -y -3 "Back to your Kindle..." 2>/dev/null
  rm -f "$PIDFILE" "$TOUCH"
  lipc-set-prop com.lab126.powerd preventScreenSaver 0 2>/dev/null
  lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null
  start lab126_gui 2>/dev/null || /etc/init.d/framework start 2>/dev/null
  exit 0
}

while true; do
  refresh
  sleep 2   # ignore the tap that launched us
  wait_or_touch $((REFRESH_MIN * 60)) && exit_to_kindle
done
