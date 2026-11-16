#!/bin/sh
# Draw the current forecast over the normal Kindle UI (the Kindle UI redraws over it as soon as you tap).
. /mnt/us/weatherboard/bin/common.sh
WIFI_SAVER=0
sleep 2
refresh
