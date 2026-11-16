#!/bin/sh
[ -f /tmp/weatherboard.pid ] && kill "$(cat /tmp/weatherboard.pid)" 2>/dev/null
rm -f /tmp/weatherboard.pid
lipc-set-prop com.lab126.powerd preventScreenSaver 0 2>/dev/null
lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null
start lab126_gui 2>/dev/null || /etc/init.d/framework start 2>/dev/null
