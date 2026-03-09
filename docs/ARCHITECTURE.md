# Architecture Documentation

Technical architecture of the Cyber Resilience Demonstration Platform.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Hybrid Architecture](#2-hybrid-architecture)
3. [Component Descriptions](#3-component-descriptions)
4. [Data Flow](#4-data-flow)
5. [Security Considerations](#5-security-considerations)
6. [Technology Stack](#6-technology-stack)

---

## 1. System Overview

```
╔══════════════════════════════════════════════════════════════════════╗
║              CYBER RESILIENCE DEMONSTRATION PLATFORM                 ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║   LOCAL ENVIRONMENT                   CLOUD (Railway)                ║
║   ─────────────────                   ──────────────                 ║
║                                                                      ║
║  ┌─────────────┐  metrics  ┌──────────┐  SSE   ┌──────────────┐     ║
║  │  VM Lab     │──POST────▶│  API     │───────▶│  Status Page  │     ║
║  │  Simulator  │           │  server  │        │  Dashboard    │     ║
║  └─────────────┘           └──────────┘        └──────────────┘     ║
║         │                       │                     ▲              ║
║         │                       │                     │              ║
║  ┌─────────────┐          ┌──────────┐        ┌──────────────┐     ║
║  │ Ransomware  │──trigger─▶│ Simulate │        │   Audience   │     ║
║  │ Simulator   │          │ Attack   │        │   Browsers   │     ║
║  └─────────────┘          └──────────┘        └──────────────┘     ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 2. Hybrid Architecture

The platform uses a **hybrid architecture**: attack simulation runs locally (where it is safe and isolated), while the status dashboard and API are hosted in the cloud (accessible to the audience during a live presentation).

### Why hybrid?

| Concern | Local | Cloud |
|---|---|---|
| Attack simulation safety | ✅ Isolated | ❌ Not appropriate |
| Audience visibility | ❌ Local network only | ✅ Public URL |
| Real-time metrics | ✅ Close to VMs | ✅ Delivered via SSE |
| Infrastructure cost | ✅ Free (your hardware) | ✅ Free tier (Railway) |

---

## 3. Component Descriptions

### 3.1 Status Page Dashboard (`railway/status-page/`)

A single-page application served as static HTML/CSS/JS.

- **`index.html`** — Dashboard layout with 6 system status cards, alert banner, event timeline, and QR code section.
- **`style.css`** — Dark theme (`#0a0e27` background), card-based grid, pulse animations.
- **`app.js`** — Connects to `/api/stream` via the browser's native `EventSource` API. Updates the DOM in real-time when new data arrives. Handles reconnection with exponential back-off.

### 3.2 API Server (`railway/api/server.js`)

A lightweight Express.js server that:

- **Stores in-memory state** for the 6 monitored systems.
- **Accepts metric updates** (`POST /api/metrics`) from the local forwarder.
- **Streams updates** to dashboard clients via Server-Sent Events (`GET /api/stream`).
- **Provides attack simulation** phases (`POST /api/simulate-attack`).
- **Serves** the status-page static files.

### 3.3 Metrics Forwarder (`local/forwarder/metrics_forwarder.py`)

A Python daemon that:

- Generates realistic sinusoidal metric variations for 6 virtual systems.
- Optionally reads real host CPU/memory from `psutil`.
- POSTs metrics every 2 seconds to the Railway API.
- Handles network errors gracefully with exponential back-off.

### 3.4 Ransomware Simulator (`local/attack/ransomware_simulator.py`)

An **educational** script that simulates the phases of a ransomware attack:

1. Reconnaissance
2. Privilege escalation
3. File encryption (safe demo files only)
4. Shadow copy deletion
5. Data exfiltration
6. Ransom note creation

And the recovery phase:

7. Decryption / restoration

> **Safety:** The script only operates in `/tmp` or `./test` directories and never touches real system files.

---

## 4. Data Flow

### Normal operation

```
metrics_forwarder.py
       │
       │  POST /api/metrics  { systems: { ... } }
       ▼
   server.js (Railway)
       │
       │  broadcast via SSE
       ▼
   app.js (browser)
       │
       │  updateCard() / updateOverview()
       ▼
   index.html (DOM update)
```

### Attack simulation

```
presenter runs:
  curl -X POST .../api/simulate-attack -d '{"phase":"start"}'
       │
       ▼
   server.js
    - sets attackActive = true
    - modifies systemStatus (cpu → 95%, status → "warning")
    - broadcasts 'alert' SSE event
       │
       ▼
   app.js
    - showAlertBanner()
    - addTimelineEvent('danger', ...)
    - updateCard() → card turns red and pulses
```

### Recovery

```
presenter runs:
  curl -X POST .../api/simulate-attack -d '{"phase":"recovery"}'
       │
       ▼
   server.js
    - attackActive = false
    - restores systemStatus to healthy values
    - broadcasts 'recovery' SSE event
       │
       ▼
   app.js
    - hideAlertBanner()
    - addTimelineEvent('success', ...)
    - updateCard() → cards return to green
```

---

## 5. Security Considerations

- **No real credentials** are stored in the repository. The `.gitignore` excludes `.env` files.
- **CORS** is enabled on the API server so the dashboard can be served from a different origin if needed.
- **Ransomware simulator** is restricted to safe directories (`/tmp`, `./test`) and cannot be triggered remotely.
- **In-memory state** only — no database, so there is no persistent data exposure risk.
- **Rate limiting** is not implemented (this is a demo platform). Add `express-rate-limit` before any production use.
- **Authentication** is not implemented. Do not expose the `/api/simulate-attack` endpoint publicly in production without auth.

---

## 6. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Cloud platform | [Railway](https://railway.app) | Host API + static dashboard |
| API server | Node.js 18 + Express 4 | REST API + SSE broker |
| Dashboard | HTML5 / CSS3 / Vanilla JS | Real-time status display |
| Real-time transport | Server-Sent Events (SSE) | One-way push from server to browser |
| Metrics forwarder | Python 3.8+ | Simulate and forward VM metrics |
| Attack simulator | Python 3.8+ | Educational ransomware demo |
| Containerisation | Docker (Alpine) | Optional container deployment |
| Security framework | MITRE ATT&CK® | Attack phase taxonomy |
| Backup strategy | 3-2-1-1-0 rule | Recovery demonstration |
