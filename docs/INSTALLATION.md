# Installation Guide

Complete setup instructions for the Cyber Resilience Demonstration Platform.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Windows — WSL2 Setup](#2-windows--wsl2-setup)
3. [Deploy the API to Railway](#3-deploy-the-api-to-railway)
4. [Local Environment Setup](#4-local-environment-setup)
5. [Install Python Dependencies](#5-install-python-dependencies)
6. [Running the Demo](#6-running-the-demo)
7. [Testing the Installation](#7-testing-the-installation)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| RAM | 8 GB | 32 GB (for full VM lab) |
| Disk | 20 GB free | 60 GB free |
| CPU | 4 cores | 8+ cores |
| OS | Linux / macOS / Windows (WSL2) | Ubuntu 22.04 LTS |
| Python | 3.8+ | 3.11+ |
| Node.js | 18+ | 20 LTS |
| Git | Any recent | 2.40+ |
| Internet | Required for Railway | — |

Run the requirements checker at any time:

```bash
bash local/scripts/check_requirements.sh
```

---

## 2. Windows — WSL2 Setup

> Skip this section if you are on Linux or macOS.

### Enable WSL2

```powershell
# Run in PowerShell as Administrator
wsl --install
# Restart when prompted
```

### Install Ubuntu 22.04

```powershell
wsl --install -d Ubuntu-22.04
```

### Open WSL and update packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip nodejs npm git curl
```

### Clone the repository inside WSL

```bash
cd ~
git clone https://github.com/glover1102/Cyber-Resilience.git
cd Cyber-Resilience
```

> **Tip:** Keep all files inside the WSL filesystem (`~/`) rather than on the Windows drive (`/mnt/c/`). This gives significantly better I/O performance.

---

## 3. Deploy the API to Railway

### 3.1 Create a free Railway account

Visit [railway.app](https://railway.app) and sign up with GitHub.

### 3.2 Install the Railway CLI

```bash
# npm (recommended)
npm install -g @railway/cli

# Or via the install script
curl -fsSL https://railway.app/install.sh | sh
```

### 3.3 Log in

```bash
railway login
```

### 3.4 Create a new project and deploy

```bash
cd /path/to/Cyber-Resilience
railway init          # creates a new project
railway up            # deploys using railway/railway.json
```

### 3.5 Get your deployment URL

```bash
railway status
```

Copy the URL — it will look like `https://your-project.up.railway.app`.

### 3.6 Set the environment variable

```bash
export RAILWAY_URL=https://your-project.up.railway.app
```

Add this to your `~/.bashrc` or `~/.zshrc` to persist it across sessions.

---

## 4. Local Environment Setup

### Clone the repository

```bash
git clone https://github.com/glover1102/Cyber-Resilience.git
cd Cyber-Resilience
```

### Make scripts executable

```bash
chmod +x local/scripts/*.sh
chmod +x local/attack/setup.sh
chmod +x scripts/*.sh
```

---

## 5. Install Python Dependencies

### All dependencies (recommended)

```bash
pip3 install -r local/forwarder/requirements.txt
pip3 install cryptography colorama
```

### Individual packages

```bash
pip3 install requests psutil cryptography colorama
```

### Verify

```bash
python3 -c "import requests, psutil, cryptography, colorama; print('All OK')"
```

---

## 6. Running the Demo

### Start everything with a single command

```bash
export RAILWAY_URL=https://your-project.up.railway.app
bash local/scripts/start_demo.sh
```

The script will:
1. Verify `RAILWAY_URL` is set
2. Check Python dependencies
3. Start the metrics forwarder in the background
4. Print the dashboard URL and attack commands

### Manual steps (if you prefer)

```bash
# Terminal 1 — start the metrics forwarder
python3 local/forwarder/metrics_forwarder.py $RAILWAY_URL/api/metrics

# Terminal 2 — run the attack simulation
cd /tmp/demo_files
python3 ~/Cyber-Resilience/local/attack/ransomware_simulator.py

# Trigger attack phases via the API
curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase": "start"}'
```

---

## 7. Testing the Installation

```bash
# Run the full API test suite
bash scripts/test_api.sh $RAILWAY_URL
```

Expected output:

```
✓ /health            → 200 OK
✓ /api/status        → 200 OK  (6 systems)
✓ /api/stream        → 200 OK  (SSE connected)
✓ /api/simulate-attack → 200 OK  (phase: start)
```

---

## 8. Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.
