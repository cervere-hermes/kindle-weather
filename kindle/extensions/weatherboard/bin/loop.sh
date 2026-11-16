#!/bin/sh
. /mnt/us/extensions/weatherboard/bin/common.sh
echo $$ > "$PIDFILE"
tail -n 200 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
log "starting (fbink=$FBINK)"
# Hand the screen over: stop the stock UI and keep the screensaver away.
lipc-set-prop com.lab126.powerd preventScreenSaver 1 2>/dev/null
stop lab126_gui 2>/dev/null || /etc/init.d/framework stop 2>/dev/null
sleep 3
while true; do
  refresh
  sleep $((REFRESH_MIN * 60))
done
