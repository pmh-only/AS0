FROM dotenv/dotenvx@sha256:480318495159b1570a6c0072ea81ae050d06ad46ba267e0a7c7487b43e6ed285 AS dotenvx
FROM zerotier/zerotier@sha256:4d0542fa43f4ffaac4e702eb89d3ba6c6c4e6736fdd253b1249cae1a54e8ff97 AS zerotier

FROM debian:bookworm-slim

ARG CONFIG_ROOT=.

RUN apt-get update \
    && apt-get install --no-install-recommends -y bird2 ca-certificates gettext-base iproute2 libstdc++6 tini wireguard-tools \
    && rm -rf /var/lib/apt/lists/* \
    && chmod 0755 /etc/bird \
    && install -d -o bird -g bird /run/bird

COPY --from=dotenvx /usr/local/bin/dotenvx /usr/local/bin/dotenvx
COPY --from=zerotier /usr/sbin/zerotier-one /usr/sbin/zerotier-one
RUN ln -s zerotier-one /usr/sbin/zerotier-cli \
    && ln -s zerotier-one /usr/sbin/zerotier-idtool
COPY ${CONFIG_ROOT}/bird /etc/bird
COPY ${CONFIG_ROOT}/tunnels /etc/tunnels
COPY --chmod=0755 render-bird-config /usr/local/bin/render-bird-config

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["birdc", "-s", "/run/bird/bird.ctl", "show", "status"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["dotenvx", "run", "--quiet", "-f", "/etc/bird/.env", "--", "render-bird-config"]
