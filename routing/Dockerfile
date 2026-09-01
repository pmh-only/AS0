FROM dotenv/dotenvx@sha256:480318495159b1570a6c0072ea81ae050d06ad46ba267e0a7c7487b43e6ed285 AS dotenvx

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install --no-install-recommends -y bird2 ca-certificates gettext-base tini \
    && rm -rf /var/lib/apt/lists/* \
    && chmod 0755 /etc/bird \
    && install -d -o bird -g bird /run/bird

COPY --from=dotenvx /usr/local/bin/dotenvx /usr/local/bin/dotenvx
COPY bird /etc/bird
COPY --chmod=0755 render-bird-config /usr/local/bin/render-bird-config

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["birdc", "-s", "/run/bird/bird.ctl", "show", "status"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["dotenvx", "run", "--quiet", "-f", "/etc/bird/.env", "--", "render-bird-config"]
