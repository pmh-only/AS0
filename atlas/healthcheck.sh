#!/bin/sh
set -eu

status=/run/ripe-atlas/status
test -e "$status/reginit.vol"
read -r pid < "$status/con_keep_pid.vol"
case "$pid" in
    ''|*[!0-9]*) exit 1 ;;
esac
kill -0 "$pid"
# The controller SSH tunnel, not just the supervisor, must still be running.
grep -aq KEEP "/proc/$pid/cmdline"
