FROM debian:trixie-slim

ARG ATLAS_VERSION=5130
ARG REPO_PACKAGE=ripe-atlas-repo_1.6-1_all.deb

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates wget \
    && wget -q "https://ftp.ripe.net/ripe/atlas/software-probe/debian/dists/trixie/main/binary-$(dpkg --print-architecture)/${REPO_PACKAGE}" \
    && wget -q "https://github.com/RIPE-NCC/ripe-atlas-software-probe/releases/latest/download/CHECKSUMS" \
    && grep -F "$(sha256sum "${REPO_PACKAGE}")" CHECKSUMS \
    && dpkg -i "${REPO_PACKAGE}" \
    && apt-get update \
    && apt-get install --no-install-recommends -y "ripe-atlas-probe=${ATLAS_VERSION}" tini \
    && rm -rf /var/lib/apt/lists/* "${REPO_PACKAGE}" CHECKSUMS /etc/ripe-atlas

COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh
COPY ssh_config /etc/ssh/ssh_config.d/ripe-atlas.conf

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
