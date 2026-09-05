#!/bin/sh
set -eu

# Run the real bootstrap in a disposable container without network access.
timeout -k 1 3 /usr/local/bin/entrypoint.sh >/dev/null 2>&1 || [ "$?" -eq 124 ]
. /etc/ripe-atlas/reg_servers.sh
case "${SSH_ADDRESS_FAMILY:-inet}" in
    inet)
        [ "$REG_3_HOST" = "$REG_1_HOST" ]
        [ "$REG_6_HOST" = "$REG_4_HOST" ]
        ;;
    inet6)
        [ "$REG_2_HOST" = "$REG_1_HOST" ]
        [ "$REG_5_HOST" = "$REG_4_HOST" ]
        ;;
    any)
        [ "$REG_2_HOST" = 193.0.19.75 ]
        [ "$REG_3_HOST" = 2001:67c:2e8:11::c100:134b ]
        ;;
esac
test -s /etc/ripe-atlas/probe_key.pub
printf 'Atlas bootstrap passed for %s\n' "${SSH_ADDRESS_FAMILY:-inet}"
