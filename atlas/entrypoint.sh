#!/bin/sh
set -eu

install -d -m 0770 -o ripe-atlas -g ripe-atlas /etc/ripe-atlas
systemd-tmpfiles --create ripe-atlas.conf

if [ ! -s /etc/ripe-atlas/probe_key ]; then
    ssh-keygen -q -t ed25519 -N '' -C "$(hostname -s)" -f /etc/ripe-atlas/probe_key
fi

printf 'prod\n' > /etc/ripe-atlas/mode
printf 'RXTXRPT=%s\nTELNETD_PORT=%s\nHTTP_POST_PORT=%s\n' \
    "${RXTXRPT:-no}" "${TELNETD_PORT:-2023}" "${HTTP_POST_PORT:-8080}" \
    > /etc/ripe-atlas/config.txt
chown -R ripe-atlas:ripe-atlas /etc/ripe-atlas /var/spool/ripe-atlas

exec setpriv \
    --reuid=ripe-atlas \
    --regid=ripe-atlas \
    --init-groups \
    --inh-caps=+net_raw \
    --ambient-caps=+net_raw \
    -- /usr/sbin/ripe-atlas
