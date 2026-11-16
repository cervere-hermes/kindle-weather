#!/bin/sh
# Detach fully so the loop survives the Kindle UI being stopped.
[ -f /tmp/weatherboard.pid ] && kill "$(cat /tmp/weatherboard.pid)" 2>/dev/null
if command -v setsid >/dev/null 2>&1; then
  setsid /bin/sh /mnt/us/weatherboard/bin/loop.sh </dev/null >/dev/null 2>&1 &
else
  nohup /bin/sh /mnt/us/weatherboard/bin/loop.sh </dev/null >/dev/null 2>&1 &
fi
