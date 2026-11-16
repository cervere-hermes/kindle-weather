#!/bin/sh
# Stop the dashboard (if running) and give the touchscreen back.
[ -f /tmp/weatherboard.pid ] && kill "$(cat /tmp/weatherboard.pid)" 2>/dev/null
killall evgrab 2>/dev/null
rm -f /tmp/weatherboard.pid /tmp/weatherboard.fifo
lipc-set-prop com.lab126.powerd preventScreenSaver 0 2>/dev/null
