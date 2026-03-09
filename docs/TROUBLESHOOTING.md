# Troubleshooting Guide

Solutions to common issues with the Cyber Resilience Demonstration Platform.

---

## Table of Contents

1. [Railway Deployment Issues](#1-railway-deployment-issues)
2. [WSL2 Problems](#2-wsl2-problems)
3. [Python Dependency Errors](#3-python-dependency-errors)
4. [Network Connectivity Issues](#4-network-connectivity-issues)
5. [Dashboard / SSE Issues](#5-dashboard--sse-issues)
6. [Performance Optimisation](#6-performance-optimisation)
7. [Debug Commands Reference](#7-debug-commands-reference)

---

## 1. Railway Deployment Issues

### "railway: command not found"

The Railway CLI is not installed or not on your PATH.

```bash
# Install via npm
npm install -g @railway/cli

# Or via the install script
curl -fsSL https://railway.app/install.sh | sh

# Verify
railway --version
```

### "Error: Not logged in"

```bash
railway login
# Follow the browser authentication flow
```

### Build fails: "Cannot find module 'express'"

The build command is not installing dependencies correctly.

Verify `railway/railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd railway/api && npm install"
  }
}
```

Also check that `railway/api/package.json` exists and lists `express` and `cors`.

### Deployment succeeds but dashboard is blank

1. Check the Railway logs: `railway logs`
2. Confirm the start command is `cd railway/api && npm start`
3. Visit `https://your-app.railway.app/health` — should return `{"status":"ok",...}`

### "Application failed to respond"

Railway expects the app to listen on the `PORT` environment variable.  
The server already does this:

```js
const PORT = process.env.PORT || 3000;
```

If you modified `server.js`, ensure this line is present.

---

## 2. WSL2 Problems

### WSL2 is not starting

```powershell
# In PowerShell (as Administrator)
wsl --shutdown
wsl --update
wsl
```

### Cannot access Railway URL from WSL2 browser

WSL2 networking routes through the Windows host. If you are using a browser inside WSL2 (e.g., with X11 forwarding), use the Windows browser instead — both will reach the public Railway URL.

### File permissions issues

If scripts fail with `Permission denied`:

```bash
chmod +x local/scripts/*.sh
chmod +x scripts/*.sh
```

### "pip3: command not found" in WSL2

```bash
sudo apt install -y python3-pip
```

### WSL2 has no internet access

```powershell
# In PowerShell (as Administrator)
netsh winsock reset
# Restart WSL2
wsl --shutdown
```

---

## 3. Python Dependency Errors

### "ModuleNotFoundError: No module named 'requests'"

```bash
pip3 install requests
# Or install all at once:
pip3 install -r local/forwarder/requirements.txt
```

### "ModuleNotFoundError: No module named 'psutil'"

```bash
pip3 install psutil
```

### pip3 install fails with "externally-managed-environment" (Ubuntu 23.04+)

Ubuntu 23.04 and later restrict system-level pip installs. Use a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r local/forwarder/requirements.txt
pip install cryptography colorama
```

Or bypass the restriction (not recommended for production):

```bash
pip3 install --break-system-packages requests psutil colorama cryptography
```

### colorama is not displaying colours on Windows CMD

colorama needs to be initialised. The forwarder already calls `colorama.init(autoreset=True)`, but if running in a non-ANSI terminal (old Windows CMD), colours may not appear. Use Windows Terminal or WSL2 instead.

---

## 4. Network Connectivity Issues

### Metrics forwarder shows "Connection error" continuously

1. Verify the Railway URL is correct:
   ```bash
   echo $RAILWAY_URL
   curl $RAILWAY_URL/health
   ```
2. Check Railway is deployed and running: `railway status`
3. Ensure you are not behind a firewall blocking outbound HTTPS

### `/api/stream` disconnects immediately

- Some proxies and load balancers buffer SSE responses. Railway sets `X-Accel-Buffering: no` to prevent this.
- If using your own reverse proxy (nginx), add:
  ```nginx
  proxy_buffering off;
  proxy_cache off;
  proxy_set_header Connection '';
  chunked_transfer_encoding on;
  ```

### CORS errors in browser console

The API has CORS enabled for all origins. If you see CORS errors:

1. Ensure you are hitting the correct API URL
2. Check the browser Network tab — confirm the `Access-Control-Allow-Origin` header is present
3. Do not use `file://` to open `index.html` — serve it from the API at `$RAILWAY_URL`

---

## 5. Dashboard / SSE Issues

### Dashboard shows "Connecting..." indefinitely

1. Open browser DevTools → Network tab → Filter by `stream`
2. If the request is not appearing, check that `app.js` is loaded (no 404 in DevTools → Console)
3. Verify the API URL — open `$RAILWAY_URL/api/stream` directly in the browser. You should see a stream of SSE messages.

### Status cards are not updating

- Confirm the metrics forwarder is running: check the forwarder terminal for `✓ Metrics sent` messages
- Confirm SSE is connected: look for `Connected to live data stream` in the dashboard timeline

### Alert banner won't dismiss after recovery

The banner is hidden when the server sends a `recovery` SSE event. Trigger recovery manually:

```bash
curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"recovery"}'
```

---

## 6. Performance Optimisation

### Metrics forwarder is using too much CPU

The default 2-second interval is very light. If you are running the forwarder on a constrained machine, increase the interval:

```bash
python3 local/forwarder/metrics_forwarder.py $RAILWAY_URL/api/metrics --interval 5
```

### Dashboard is sluggish with many browser tabs open

Each browser tab maintains its own SSE connection to the API. With large conference audiences:

- Railway free tier supports ~100 concurrent connections
- If you expect more, upgrade the Railway plan or add a connection limit in `server.js`

### Node.js server running out of memory

The server stores all state in memory and keeps a set of SSE client response objects. If clients disconnect uncleanly, the set may grow. Restart the server periodically, or add a cleanup interval.

---

## 7. Debug Commands Reference

```bash
# Check Railway deployment status
railway status

# View Railway logs in real-time
railway logs --tail

# Test API health
curl -s $RAILWAY_URL/health | python3 -m json.tool

# Get current system status
curl -s $RAILWAY_URL/api/status | python3 -m json.tool

# Watch SSE stream (raw)
curl -N $RAILWAY_URL/api/stream

# Trigger each attack phase
curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"start"}'

curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"spreading"}'

curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"encrypted"}'

curl -X POST $RAILWAY_URL/api/simulate-attack \
     -H "Content-Type: application/json" \
     -d '{"phase":"recovery"}'

# Run requirements check
bash local/scripts/check_requirements.sh

# Run API test suite
bash scripts/test_api.sh $RAILWAY_URL

# Check Python packages
pip3 list | grep -E "requests|psutil|colorama|cryptography"
```
