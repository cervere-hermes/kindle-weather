#!/bin/sh
# Weatherboard dashboard loop.
#
# The Kindle UI keeps running underneath; we only draw on top of it, and evgrab
# holds the touchscreen so taps reach us instead of the UI.
#   single tap   -> fresh forecast
#   double tap   -> release the touchscreen, Kindle home screen (instant)
#   plug in USB  -> release; the Kindle shows its own USB screen
#   otherwise    -> refresh every REFRESH_MIN minutes
# Energy: evgrab sleeps in the kernel until a touch; this script blocks on its
# output and wakes every 5 s only to look for a USB cable. Wi-Fi is off between refreshes.
. /mnt/us/weatherboard/bin/common.sh
echo $$ > "$PIDFILE"
tail -n 300 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
log "starting (fbink=$FBINK)"

FIFO=/tmp/weatherboard.fifo
GRABPID=

# Touchscreen = input devices that report absolute positions (buttons are left alone,
# so the power button keeps working).
touch_devices() {
  awk 'BEGIN{RS=""} /B: ABS=/ { if (match($0, /event[0-9]+/)) print "/dev/input/" substr($0, RSTART, RLENGTH) }' /proc/bus/input/devices 2>/dev/null
}

# Connected to a computer (not just a charger): the USB gadget is enumerated.
usb_host() {
  for s in /sys/class/udc/*/state; do
    [ "$(cat "$s" 2>/dev/null)" = "configured" ] && return 0
  done
  return 1
}

cleanup() {
  [ -n "$GRABPID" ] && kill "$GRABPID" 2>/dev/null
  GRABPID=
  exec 3<&- 2>/dev/null
  rm -f "$FIFO" "$PIDFILE"
  lipc-set-prop com.lab126.powerd preventScreenSaver 0 2>/dev/null
}

go_home() {
  # The UI never stopped; make it repaint by switching apps, ending on home.
  lipc-set-prop com.lab126.appmgrd start app://com.lab126.booklet.settings 2>/dev/null
  sleep 1
  lipc-set-prop com.lab126.appmgrd start app://com.lab126.booklet.home 2>/dev/null
}

leave() {
  log "leaving ($1)"
  cleanup
  [ "$1" = "double tap" ] && go_home
  exit 0
}
trap 'leave signal' TERM INT

# --- grab the touchscreen ---
DEVS=$(touch_devices)
log "touch devices: ${DEVS:-none} | usb: $(cat /sys/class/udc/*/state 2>/dev/null | tr '\n' ' ')"
rm -f "$FIFO"; mkfifo "$FIFO"
exec 3<>"$FIFO"                      # read-write open: never blocks, keeps the pipe alive
"$EXT/bin/evgrab" $DEVS >"$FIFO" 2>>"$LOG" &
GRABPID=$!
if read -t 3 line <&3 && [ "$line" = "R" ]; then log "touch grabbed"; else log "evgrab not ready ($line)"; fi
lipc-set-prop com.lab126.powerd preventScreenSaver 1 2>/dev/null
sleep 2                              # let the UI finish closing the book we were launched from

now_s() { cut -d' ' -f1 /proc/uptime | cut -d. -f1; }

# Wait up to $1 seconds. Prints: timeout | refresh | double | usb
wait_for_input() {
  end=$(( $(now_s) + $1 ))
  usb_was=0; usb_host && usb_was=1
  while [ "$(now_s)" -lt "$end" ]; do
    if read -t 5 line <&3; then
      case "$line" in
        T\ *)
          t0=${line#T }
          second=
          # a second touch-down within 0.7 s makes it a double tap
          while read -t 1 l2 <&3; do
            case "$l2" in T\ *) second=${l2#T }; break ;; esac
          done
          while read -t 1 junk <&3; do :; done      # drop the rest of this gesture
          if [ -n "$second" ] && awk -v a="$t0" -v b="$second" 'BEGIN{exit !(b - a <= 0.7)}'; then
            echo double
          else
            echo refresh
          fi
          return ;;
        *) [ -n "$line" ] && log "evgrab: $line" ;;
      esac
    fi
    if usb_host; then
      [ "$usb_was" = 0 ] && { echo usb; return; }
    else
      usb_was=0
    fi
  done
  echo timeout
}

mode=
while true; do
  refresh $mode
  mode=
  case "$(wait_for_input $((REFRESH_MIN * 60)))" in
    double)  leave "double tap" ;;
    usb)     leave "usb connected" ;;
    refresh) log "refresh on tap"; mode=now; $FBINK -q -m -y -1 "Updating..." 2>/dev/null ;;
  esac
done
