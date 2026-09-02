FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install --no-install-recommends -y bird2 iputils-ping tini traceroute \
    && rm -rf /var/lib/apt/lists/* \
    && usermod -aG bird node

COPY --chown=node:node server.mjs /app/server.mjs

USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "/app/server.mjs"]
