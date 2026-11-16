#!/bin/sh
# Weatherboard dashboard loop.
#   single tap   -> refresh now
#   double tap   -> back to the normal Kindle
#   plug in USB  -> back to the normal Kindle
#   otherwise    -> refresh every REFRESH_MIN minutes
. /mnt/us/weatherboard/bin/common.sh
echo $$ > "$PIDFILE"
tail -n 300 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
log "starting (fbink=$FBINK)"
lipc-set-prop com.lab126.powerd preventScreenSaver 1 2>/dev/null
stop lab126_gui 2>/dev/null || /etc/init.d/framework stop 2>/dev/null
sleep 3

EVLOG=/tmp/weatherboard.events
RPIDS=

now_cs() { tr -d . < /proc/uptime | cut -d' ' -f1; }   # uptime in centiseconds

# One background reader per input device; each event appends a timestamp.
start_readers() {
  : > "$EVLOG"
  RPIDS=
  for dev in /dev/input/event*; do
    [ -e "$dev" ] || continue
    ( while dd if="$dev" bs=24 count=1 of=/dev/null 2>/dev/null; do now_cs >> "$EVLOG"; done ) </dev/null >/dev/null 2>&1 &
    RPIDS="$RPIDS $!"
  done
}
stop_readers() { [ -n "$RPIDS" ] && kill $RPIDS 2>/dev/null; RPIDS=; }

# Connected to a computer (not just a charger): the USB gadget is enumerated.
usb_host() {
  for s in /sys/class/udc/*/state; do
    [ "$(cat "$s" 2>/dev/null)" = "configured" ] && return 0
  done
  for f in /sys/devices/platform/*/gadget*/lun*/file /sys/devices/platform/*/*/gadget*/lun*/file; do
    [ -s "$f" ] && return 0
  done
  return 1
}

# Count taps: bursts of events within 2 s of the first one, split by gaps > 0.2 s.
count_taps() {
  awk 'NR==1{f=$1;p=$1;b=1;next} ($1-f)<=200 { if (($1-p)>20) b++; p=$1 } END{print b+0}' "$EVLOG"
}

# Wait up to $1 seconds. Prints: timeout | refresh | exit-tap | exit-usb
wait_for_input() {
  usb_was=0; usb_host && usb_was=1
  start_readers
  t=0
  while [ "$t" -lt "$1" ]; do
    if usb_host; then
      [ "$usb_was" = 0 ] && { stop_readers; echo exit-usb; return; }
    else
      usb_was=0
    fi
    if [ -s "$EVLOG" ]; then
      sleep 2                       # let a double tap finish
      taps=$(count_taps)
      log "input: $taps tap(s), $(wc -l < "$EVLOG") events"
      stop_readers
      [ "$taps" -ge 2 ] && echo exit-tap || echo refresh
      return
    fi
    sleep 1; t=$((t + 1))
  done
  stop_readers
  echo timeout
}

exit_to_kindle() {
  log "back to the normal Kindle ($1)"
  stop_readers
  rm -f "$PIDFILE" "$EVLOG"
  lipc-set-prop com.lab126.powerd preventScreenSaver 0 2>/dev/null
  lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null
  start lab126_gui 2>/dev/null || /etc/init.d/framework start 2>/dev/null
  exit 0
}

log "usb at start: $(cat /sys/class/udc/*/state 2>/dev/null | tr '\n' ' ')"
sleep 1   # ignore the tap that launched us
mode=
while true; do
  refresh $mode
  mode=
  sleep 1
  case "$(wait_for_input $((REFRESH_MIN * 60)))" in
    exit-tap) exit_to_kindle "double tap" ;;
    exit-usb) exit_to_kindle "usb connected" ;;
    refresh)  log "refresh on tap"; mode=now; $FBINK -q -m -y -1 "Updating..." 2>/dev/null ;;
  esac
done
