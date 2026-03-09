# 🛡️ Cyber Resilience Demonstration Platform

A **live, interactive platform** for demonstrating ransomware attacks and recovery using the 3-2-1-1-0 backup strategy — designed for conference talks, security training, and awareness sessions.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8%2B-blue)](https://www.python.org/)

---

## Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║           CYBER RESILIENCE DEMONSTRATION PLATFORM               ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  LOCAL ENVIRONMENT              CLOUD (Railway)                  ║
║  ─────────────────              ────────────────                 ║
║                                                                  ║
║  ┌──────────────┐  POST /api/metrics  ┌─────────────┐           ║
║  │  Metrics     │────────────────────▶│  Express    │           ║
║  │  Forwarder   │                     │  API Server │           ║
║  └──────────────┘                     └──────┬──────┘           ║
║                                              │ SSE              ║
║  ┌──────────────┐  POST /simulate-attack     ▼                  ║
║  │  Ransomware  │────────────────────▶┌─────────────┐           ║
║  │  Simulator   │                     │  Dashboard  │           ║
║  └──────────────┘                     │  (Browser)  │           ║
║                                       └─────────────┘           ║
║                                              ▲                  ║
║                                       Audience phones/laptops   ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Features

- 🎯 **Live attack simulation** — ransomware phases from reconnaissance to encryption
- 📊 **Real-time dashboard** — 6 status cards with live CPU, memory and network metrics
- 📡 **Server-Sent Events** — push updates to all audience browsers simultaneously
- 🔄 **Recovery demonstration** — failover and restore from backup, live on screen
- 📱 **Mobile responsive** — audience can follow along on their phones via QR code
- 🎨 **Dark cybersecurity theme** — professional presentation-ready UI
- 🛡️ **MITRE ATT&CK** aligned attack narrative
- 💾 **3-2-1-1-0 backup strategy** demonstrated in action

---

## Quick Start

### 1. Deploy the API to Railway

```bash
npm install -g @railway/cli
railway login
railway up
export RAILWAY_URL=$(railway status --json | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")
```

### 2. Start the local demo environment

```bash
git clone https://github.com/glover1102/Cyber-Resilience.git
cd Cyber-Resilience
chmod +x local/scripts/*.sh scripts/*.sh

export RAILWAY_URL=https://your-app.railway.app
bash local/scripts/start_demo.sh
```

### 3. Open the dashboard

Visit `$RAILWAY_URL` in your browser. All 6 system cards should be green.

### 4. Run the attack simulation

```bash
# Start attack
curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"start"}'

# Progress through phases: spreading → encrypted → recovery
```

---

## Repository Structure

```
Cyber-Resilience/
├── railway/
│   ├── api/
│   │   ├── server.js        # Express API + SSE server
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── status-page/
│   │   ├── index.html       # Live status dashboard
│   │   ├── style.css        # Dark theme
│   │   └── app.js           # SSE client
│   └── railway.json         # Railway deployment config
├── local/
│   ├── attack/
│   │   ├── ransomware_simulator.py   # Educational attack demo
│   │   └── setup.sh
│   ├── forwarder/
│   │   ├── metrics_forwarder.py      # Push metrics to Railway
│   │   └── requirements.txt
│   └── scripts/
│       ├── start_demo.sh             # One-command startup
│       └── check_requirements.sh    # Pre-flight check
├── scripts/
│   ├── test_api.sh          # API endpoint tests
│   └── generate_qr.py       # QR code for dashboard URL
└── docs/
    ├── INSTALLATION.md
    ├── ARCHITECTURE.md
    ├── PRESENTATION.md      # 20-min demo script + 32 slide outline
    ├── TROUBLESHOOTING.md
    └── FAQ.md
```

---

## Documentation

| Document | Description |
|---|---|
| [INSTALLATION.md](docs/INSTALLATION.md) | Full setup guide (WSL2, Railway, Python) |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture and data flow |
| [PRESENTATION.md](docs/PRESENTATION.md) | Presenter script, slide outline, backup plans |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and debug commands |
| [FAQ.md](docs/FAQ.md) | Frequently asked questions |

---

## Technology Stack

| Component | Technology |
|---|---|
| Cloud platform | [Railway](https://railway.app) |
| API server | Node.js 18 + Express 4 |
| Real-time updates | Server-Sent Events (SSE) |
| Dashboard | HTML5 / CSS3 / Vanilla JS |
| Metrics forwarder | Python 3.8+ |
| Attack simulator | Python 3.8+ |
| Containerisation | Docker (Alpine) |

---

## Requirements Check

```bash
bash local/scripts/check_requirements.sh
```

---

## License

[MIT License](LICENSE) — free to use, modify, and present.

---

## ⚠️ Educational Disclaimer

This platform is for **educational and demonstration purposes only**. The ransomware
simulator does not use real encryption, cannot spread across a network, and only
operates in safe sandbox directories. Do not use any component of this project
maliciously.
