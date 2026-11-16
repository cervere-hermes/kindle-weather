#!/bin/sh
[ -f /tmp/weatherboard.pid ] && kill "$(cat /tmp/weatherboard.pid)" 2>/dev/null
nohup /bin/sh /mnt/us/extensions/weatherboard/bin/loop.sh >/dev/null 2>&1 &
