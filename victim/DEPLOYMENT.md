# Dynamic victim deployment

US and IR are now real public applications with a separate management-plane
telemetry agent. They do not need Docker.

## Quick lab run

On the US or IR LXC, after configuring both NICs:

```bash
cd ~/Mirai-Botnet-Simulation-Lab/victim
sudo ./start.sh us
```

The public app listens only on that victim's public address and the telemetry
agent listens only on its management address at port `9081`. Start the SOC on
the separate Monitor LXC with `monitor/start.sh`.

## Persistent service

Copy the country environment file and units once per LXC:

```bash
sudo mkdir -p /etc/mirai-victim
sudo cp deploy/public-us.env.example /etc/mirai-victim/public.env
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mirai-public-app mirai-telemetry-agent
```

Use `public-ir.env.example` on the IR LXC. The public app has a deliberately
bounded six-request capacity for this isolated teaching lab. It does not send
traffic. When observed ingress reaches the telemetry threshold, it sheds
dynamic requests with an explicit `503` response; the external monitor records
the user-visible result from the public VLAN.

For a deterministic classroom fallback, set `SAFE_DEMO_MODE=degraded` or
`SAFE_DEMO_MODE=outage` in `/etc/mirai-victim/public.env`, restart both units,
and identify it to the audience as a simulated scenario.
