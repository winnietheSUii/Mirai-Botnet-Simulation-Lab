# Out-of-Band SOC Monitor

Run this on a separate `soc-monitor` LXC, not on either victim. Recommended NICs:

| Interface | VLAN | Address | Purpose |
|---|---:|---|---|
| `eth0` | 10 | `185.10.20.110/24` | SOC interface and management telemetry |
| `eth1` | 40 | `12.1.2.110/24` | External public probe for US |
| `eth2` | 44 | `5.200.0.110/24` | External public probe for IR |

Do not configure a default gateway on `eth1` or `eth2`. The monitor makes a real HTTP transaction request to each public app and independently reads the victim agent over VLAN 10. It displays stale management data honestly if a victim no longer responds.

```bash
chmod +x start.sh
./start.sh
```

For a persistent monitor, copy `deploy/systemd/mirai-soc-monitor.service` to
`/etc/systemd/system/`, run `sudo systemctl daemon-reload`, then enable it with
`sudo systemctl enable --now mirai-soc-monitor`.

Override URLs only when lab addressing differs:

```bash
US_PUBLIC_URL=http://12.1.2.100 US_AGENT_URL=http://185.10.20.101:9081 ./start.sh
```
