# agent-bridge — Claude Code agentic pe host

Rulează Claude Code agentic PE HOST (în `~/berlinstar`) și-l expune printr-un
mic API HTTP/SSE pe `:8765`, pe care backend-ul (din container) îl proxează.
Vezi planul: AdminV2 → „Asistent AI".

⚠️ Acest serviciu permite execuție de cod arbitrar pe host (`bypassPermissions`).
E protejat de `X-Bridge-Secret` și nu e expus în afara LAN-ului. NU porni pe
Prod fără review.

## Instalare pe server (user berlinqa)

```bash
cd ~/berlinstar

# 1. venv + dependențe
python3 -m venv ~/agent-bridge-venv
~/agent-bridge-venv/bin/pip install -U pip
~/agent-bridge-venv/bin/pip install -r ops/agent-bridge/requirements.txt

# 2. fișier de mediu cu secrete (chmod 600)
mkdir -p ~/.config
cp ops/agent-bridge/env.example ~/.config/berlinstar-agent-bridge.env
chmod 600 ~/.config/berlinstar-agent-bridge.env
# editează: pune ANTHROPIC_API_KEY real + un BRIDGE_SHARED_SECRET random
#   openssl rand -hex 32
nano ~/.config/berlinstar-agent-bridge.env

# 3. serviciu systemd --user (pornește la boot via linger)
mkdir -p ~/.config/systemd/user
cp ops/agent-bridge/berlinstar-agent-bridge.service ~/.config/systemd/user/
loginctl enable-linger berlinqa
systemctl --user daemon-reload
systemctl --user enable --now berlinstar-agent-bridge

# 4. verificare
systemctl --user status berlinstar-agent-bridge
SECRET=$(grep BRIDGE_SHARED_SECRET ~/.config/berlinstar-agent-bridge.env | cut -d= -f2)
curl -s -H "X-Bridge-Secret: $SECRET" http://127.0.0.1:8765/healthz
```

## Smoke test agentic

```bash
SECRET=$(grep BRIDGE_SHARED_SECRET ~/.config/berlinstar-agent-bridge.env | cut -d= -f2)
CID=$(curl -s -H "X-Bridge-Secret: $SECRET" -H 'Content-Type: application/json' \
  -d '{"prompt":"ruleaza git status si zi-mi pe scurt branch-ul"}' \
  http://127.0.0.1:8765/agent/chats | python3 -c 'import sys,json;print(json.load(sys.stdin)["chat_id"])')
curl -N -H "X-Bridge-Secret: $SECRET" http://127.0.0.1:8765/agent/chats/$CID/events
```

`BRIDGE_SHARED_SECRET` trebuie să fie identic cu `ASSISTANT_BRIDGE_SECRET` din
`deploy/.env` al backend-ului.

## Hardening firewall (recomandat)
Restricționează portul 8765 doar la docker/localhost:
```bash
sudo ufw deny in on eno1 to any port 8765
```
(LAN-ul e oricum în spatele routerului; portul nu e port-forwarded.)
