# AS218822
AS218822 Network Infrastructure Specs.

## Plan
- [x] RIR: RIPE
- [x] ASN sponsor LIR: [Lagrange](https://lagrange.cloud/products/lir)
- [x] Stack: IPv6
- [X] IPv6 PA range allocation: `2a06:9801:ff0::/44`
- [x] ASN allocation: AS218822

### OCI BYOASN/BYOIP range `2a06:9801:ff0::/48`, `2a06:9801:ff1::/48`, `2a06:9801:ff2::/48`
- [ ] BYOIP
- [ ] BYOASN
- [ ] Announce

### AWS BYOASN/BYOIP range `2a06:9801:ffa::/48` (regional), `2a06:9801:ffb::/48` (edge)
- [x] IPAM Pool allocation
- [ ] BYOASN
- [ ] Announce

### Self-announced range `2a06:9801:ff0::/44`
- [ ] BGP upstream tunneling: bgptunnel.com, hyehost
- [ ] BGP daemon hosting: Oracle Cloud
- [ ] Tailscale Exit Node

### Infrastructure As Code
- [ ] RIPE Database GitOps
- [ ] Container image for BGP Daemon
- [ ] Able to accept peering request by Github issue
