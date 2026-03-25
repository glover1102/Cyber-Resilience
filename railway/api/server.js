/**
 * Cyber Resilience API Server
 *
 * Endpoints:
 *   POST /api/metrics          - Receive metrics from the local forwarder
 *   GET  /api/status           - Return current system status snapshot
 *   GET  /api/stream           - Server-Sent Events for real-time updates
 *   POST /api/simulate-attack  - Trigger a demo attack simulation
 *   GET  /health               - Health check
 *   GET  /api/devices          - List connected devices
 *   POST /api/register-device  - Merge client-side device info
 *   GET  /api/ping             - RTT echo endpoint (returns { timestamp } for client-side RTT measurement)
 *   POST /api/ping/:ip         - Ping a device IP from the server (ICMP with demo-mode fallback)
 *
 * Serves the static status-page dashboard from ../status-page/
 */

'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------
app.use(cors());
app.use(express.json());

// Serve the static status-page dashboard
const statusPagePath = path.join(__dirname, '..', 'status-page');
console.log(`📁 Serving static files from: ${statusPagePath}`);
app.use(express.static(statusPagePath));

// ----------------------------------------------------------------
// In-memory state
// ----------------------------------------------------------------

/** Current status of all monitored systems */
let systemStatus = {
    'primary-dc': { status: 'online', cpu: 20, memory: 40, network: 5.2 },
    'secondary-dc': { status: 'online', cpu: 18, memory: 38, network: 3.1 },
    'soc': { status: 'online', cpu: 35, memory: 55, network: 2 },
    'noc': { status: 'online', cpu: 22, memory: 45, network: 8.4 },
    'backup': { status: 'online', cpu: 10, memory: 30, network: 60 },
    'application': { status: 'online', cpu: 42, memory: 60, network: 120 },
    'firewall': { status: 'online', cpu: 15, memory: 25, network: 450 },
    'vpn': { status: 'online', cpu: 30, memory: 35, network: 85 },
    'database': { status: 'online', cpu: 45, memory: 70, network: 320 },
    'email': { status: 'online', cpu: 25, memory: 40, network: 180 },
    'edr': { status: 'online', cpu: 20, memory: 30, network: 5 },
};

let attackActive = false;
let alertMessage = '';

/** Master control state */
let masterControlState = {
    isMasterMode: false,
    demoActive: false,
    demoPaused: false,
    currentPhase: null,
    demoStartTime: null,
    pauseTime: null,
};

/** Registered SSE clients */
const sseClients = new Set();

/** Connected device info — keyed by a unique client ID */
const connectedDevices = new Map();
let nextClientId = 1;

/** Simple in-memory rate limiter for ping requests (per IP, no external deps) */
const pingRateLimit = new Map(); // callerIp → { count, resetAt }
const PING_RATE_LIMIT_MAX = 10;  // max pings per window per caller
const PING_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1-minute window

/**
 * Express middleware that enforces a per-IP rate limit for the ping endpoint.
 * Keeps a simple in-memory token-bucket without requiring external packages.
 */
function pingRateLimiter(req, res, next) {
    const callerIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    const now = Date.now();
    const bucket = pingRateLimit.get(callerIp);
    if (bucket && bucket.resetAt > now) {
        if (bucket.count >= PING_RATE_LIMIT_MAX) {
            return res.status(429).json({ error: 'Too many ping requests — please wait before trying again.' });
        }
        bucket.count += 1;
    } else {
        pingRateLimit.set(callerIp, { count: 1, resetAt: now + PING_RATE_LIMIT_WINDOW_MS });
    }
    next();
}

// ----------------------------------------------------------------
// SSE Helpers
// ----------------------------------------------------------------

/**
 * Broadcast a payload to all connected SSE clients.
 * @param {string} eventName - SSE event name
 * @param {object} data      - Data to serialise as JSON
 */
function broadcast(eventName, data) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
        try {
            res.write(payload);
        } catch (_) {
            sseClients.delete(res);
        }
    }
}

/** Broadcast the current state to all connected clients */
function broadcastStatus(eventOverride) {
    const payload = {
        systems: systemStatus,
        attack_active: attackActive,
        alert_message: alertMessage,
        timestamp: new Date().toISOString(),
    };
    if (eventOverride) payload.event = eventOverride;
    broadcast('status', payload);
}

/** Broadcast the current connected device list to all clients */
function broadcastDevices() {
    broadcast('devices-update', {
        devices: Array.from(connectedDevices.values()),
        count: connectedDevices.size,
    });
}

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------

/**
 * GET /health
 * Simple health check — used by Railway and load balancers.
 */
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

/**
 * GET /api/status
 * Returns the current system status snapshot.
 */
app.get('/api/status', (_req, res) => {
    res.json({
        systems: systemStatus,
        attack_active: attackActive,
        alert_message: alertMessage,
        timestamp: new Date().toISOString(),
    });
});

/**
 * POST /api/metrics
 * Accept metrics from the local forwarder and propagate to SSE clients.
 *
 * Body: { systems: { "primary-dc": { status, cpu, memory, network }, ... } }
 */
app.post('/api/metrics', (req, res) => {
    const { systems } = req.body || {};

    if (!systems || typeof systems !== 'object') {
        return res.status(400).json({ error: 'Invalid payload: expected { systems: { ... } }' });
    }

    // Merge incoming metrics into current state
    for (const [key, metrics] of Object.entries(systems)) {
        if (systemStatus[key]) {
            systemStatus[key] = { ...systemStatus[key], ...metrics };
        }
    }

    broadcastStatus();
    res.json({ ok: true, received: Object.keys(systems).length });
});

/**
 * GET /api/stream
 * Server-Sent Events endpoint. Clients subscribe here for real-time updates.
 */
app.get('/api/stream', (req, res) => {
    console.log('📡 New SSE client connected from', req.ip);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering if present
    res.flushHeaders();

    // Assign a unique client ID and record device info
    const clientId = nextClientId++;
    res.clientId = clientId;
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    connectedDevices.set(clientId, {
        id: clientId,
        ip,
        userAgent,
        connectedAt: new Date().toISOString(),
    });

    // Send current state immediately on connect
    const initial = JSON.stringify({
        systems: systemStatus,
        attack_active: attackActive,
        alert_message: alertMessage,
        timestamp: new Date().toISOString(),
        event: { type: 'info', message: 'Connected to live data stream' },
    });
    res.write(`event: status\ndata: ${initial}\n\n`);

    // Send the assigned client ID so the browser can register device info
    res.write(`event: client-id\ndata: ${JSON.stringify({ clientId })}\n\n`);

    sseClients.add(res);
    broadcast('viewer-count', { count: sseClients.size });
    broadcastDevices();

    // Keep-alive ping every 25 seconds
    const keepAlive = setInterval(() => {
        try {
            res.write(': ping\n\n');
        } catch (_) {
            clearInterval(keepAlive);
            sseClients.delete(res);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(keepAlive);
        sseClients.delete(res);
        connectedDevices.delete(clientId);
        broadcast('viewer-count', { count: sseClients.size });
        broadcastDevices();
    });
});

/**
 * POST /api/simulate-attack
 * Trigger a demo ransomware attack sequence for presentation purposes.
 *
 * Optional body: { phase: "start"|"spreading"|"encrypted"|"recovery" }
 */
app.post('/api/simulate-attack', (req, res) => {
    const phase = (req.body && req.body.phase) || 'start';

    switch (phase) {
        case 'start': {
            attackActive = true;
            alertMessage = 'Ransomware detected on Primary DC — Incident response initiated';

            // Firewall detects anomaly
            systemStatus['firewall'] = { ...systemStatus['firewall'], status: 'warning', cpu: 85, memory: 60, network: 1200 };
            // EDR starts scanning
            systemStatus['edr'] = { ...systemStatus['edr'], status: 'warning', cpu: 95, memory: 80, network: 15 };
            // Primary DC compromised
            systemStatus['primary-dc'] = { ...systemStatus['primary-dc'], status: 'warning', cpu: 95, memory: 88, network: 12.0 };

            broadcastStatus({ type: 'danger', message: '⚠️ Ransomware detected — Firewall alerts triggered' });
            broadcast('alert', { message: alertMessage });
            break;
        }
        case 'spreading': {
            // Lateral movement to VPN and Database
            systemStatus['primary-dc'] = { ...systemStatus['primary-dc'], status: 'offline', cpu: 100, memory: 95, network: 0 };
            systemStatus['vpn'] = { ...systemStatus['vpn'], status: 'warning', cpu: 88, memory: 75, network: 200 };
            systemStatus['database'] = { ...systemStatus['database'], status: 'warning', cpu: 90, memory: 85, network: 850 };
            systemStatus['email'] = { ...systemStatus['email'], status: 'warning', cpu: 70, memory: 65, network: 500 };
            systemStatus['application'] = { ...systemStatus['application'], status: 'warning', cpu: 88, memory: 82, network: 50 };

            broadcastStatus({ type: 'danger', message: '🔴 Ransomware spreading — VPN, Database, Email compromised' });
            break;
        }
        case 'encrypted': {
            // Systems encrypted and offline
            systemStatus['primary-dc'] = { ...systemStatus['primary-dc'], status: 'offline', cpu: 5, memory: 90, network: 0 };
            systemStatus['application'] = { ...systemStatus['application'], status: 'offline', cpu: 5, memory: 90, network: 0 };
            systemStatus['database'] = { ...systemStatus['database'], status: 'offline', cpu: 10, memory: 85, network: 0 };
            systemStatus['email'] = { ...systemStatus['email'], status: 'offline', cpu: 5, memory: 60, network: 0 };
            systemStatus['vpn'] = { ...systemStatus['vpn'], status: 'offline', cpu: 8, memory: 50, network: 0 };

            // Firewall and EDR still reporting
            systemStatus['firewall'] = { ...systemStatus['firewall'], status: 'warning', cpu: 90, memory: 70, network: 50 };
            systemStatus['edr'] = { ...systemStatus['edr'], status: 'warning', cpu: 100, memory: 90, network: 25 };

            broadcastStatus({ type: 'danger', message: '💀 Files encrypted — 5 systems offline, failover to Secondary DC' });
            break;
        }
        case 'recovery': {
            attackActive = false;
            alertMessage = '';

            // Restore all systems
            systemStatus['primary-dc'] = { status: 'warning', cpu: 30, memory: 45, network: 4.0 };
            systemStatus['secondary-dc'] = { status: 'online', cpu: 55, memory: 65, network: 12.0 };
            systemStatus['application'] = { status: 'online', cpu: 42, memory: 58, network: 95 };
            systemStatus['database'] = { status: 'online', cpu: 50, memory: 72, network: 350 };
            systemStatus['email'] = { status: 'online', cpu: 28, memory: 42, network: 200 };
            systemStatus['vpn'] = { status: 'online', cpu: 32, memory: 38, network: 90 };
            systemStatus['firewall'] = { status: 'online', cpu: 18, memory: 28, network: 480 };
            systemStatus['edr'] = { status: 'online', cpu: 22, memory: 32, network: 6 };
            systemStatus['soc'] = { status: 'online', cpu: 40, memory: 58, network: 3 };
            systemStatus['noc'] = { status: 'online', cpu: 24, memory: 47, network: 8.8 };
            systemStatus['backup'] = { status: 'online', cpu: 12, memory: 32, network: 65 };

            broadcastStatus({ type: 'success', message: '✅ Recovery complete — All systems restored from backup' });
            broadcast('recovery', { message: 'Systems recovered using 3-2-1-1-0 backup strategy' });
            break;
        }
        default:
            return res.status(400).json({ error: `Unknown phase: ${phase}` });
    }

    res.json({ ok: true, phase, attack_active: attackActive });
});

// ----------------------------------------------------------------
// Master Control Routes
// ----------------------------------------------------------------

/**
 * GET /api/master-control/state
 * Returns the current master control state.
 */
app.get('/api/master-control/state', (_req, res) => {
    res.json({ ...masterControlState, viewerCount: sseClients.size });
});

/**
 * POST /api/master-control/play
 * Master initiates demo playback for all viewers.
 */
app.post('/api/master-control/play', (req, res) => {
    const token = req.headers['x-master-token'] || (req.body && req.body.token);
    if (process.env.MASTER_TOKEN && token !== process.env.MASTER_TOKEN) {
        return res.status(403).json({ error: 'Invalid master token' });
    }
    masterControlState.isMasterMode = true;
    masterControlState.demoActive = true;
    masterControlState.demoPaused = false;
    masterControlState.currentPhase = null;
    masterControlState.demoStartTime = Date.now();
    masterControlState.pauseTime = null;
    broadcast('master-play', { timestamp: new Date().toISOString() });
    res.json({ ok: true, action: 'play' });
});

/**
 * POST /api/master-control/pause
 * Master pauses demo for all viewers.
 */
app.post('/api/master-control/pause', (req, res) => {
    const token = req.headers['x-master-token'] || (req.body && req.body.token);
    if (process.env.MASTER_TOKEN && token !== process.env.MASTER_TOKEN) {
        return res.status(403).json({ error: 'Invalid master token' });
    }
    masterControlState.demoPaused = true;
    masterControlState.pauseTime = Date.now();
    broadcast('master-pause', { timestamp: new Date().toISOString() });
    res.json({ ok: true, action: 'pause' });
});

/**
 * POST /api/master-control/resume
 * Master resumes demo for all viewers.
 */
app.post('/api/master-control/resume', (req, res) => {
    const token = req.headers['x-master-token'] || (req.body && req.body.token);
    if (process.env.MASTER_TOKEN && token !== process.env.MASTER_TOKEN) {
        return res.status(403).json({ error: 'Invalid master token' });
    }
    masterControlState.demoPaused = false;
    masterControlState.pauseTime = null;
    broadcast('master-resume', { timestamp: new Date().toISOString() });
    res.json({ ok: true, action: 'resume' });
});

/**
 * POST /api/master-control/next-phase
 * Master advances demo to next phase for all viewers.
 */
app.post('/api/master-control/next-phase', (req, res) => {
    const token = req.headers['x-master-token'] || (req.body && req.body.token);
    if (process.env.MASTER_TOKEN && token !== process.env.MASTER_TOKEN) {
        return res.status(403).json({ error: 'Invalid master token' });
    }
    broadcast('master-next-phase', { timestamp: new Date().toISOString() });
    res.json({ ok: true, action: 'next-phase' });
});

/**
 * POST /api/master-control/stop
 * Master stops demo for all viewers.
 */
app.post('/api/master-control/stop', (req, res) => {
    const token = req.headers['x-master-token'] || (req.body && req.body.token);
    if (process.env.MASTER_TOKEN && token !== process.env.MASTER_TOKEN) {
        return res.status(403).json({ error: 'Invalid master token' });
    }
    masterControlState.demoActive = false;
    masterControlState.demoPaused = false;
    masterControlState.currentPhase = null;
    masterControlState.demoStartTime = null;
    masterControlState.pauseTime = null;
    broadcast('master-stop', { timestamp: new Date().toISOString() });
    res.json({ ok: true, action: 'stop' });
});

/**
 * POST /api/master-control/reset
 * Master resets demo for all viewers.
 */
app.post('/api/master-control/reset', (req, res) => {
    const token = req.headers['x-master-token'] || (req.body && req.body.token);
    if (process.env.MASTER_TOKEN && token !== process.env.MASTER_TOKEN) {
        return res.status(403).json({ error: 'Invalid master token' });
    }
    masterControlState.demoActive = false;
    masterControlState.demoPaused = false;
    masterControlState.currentPhase = null;
    masterControlState.demoStartTime = null;
    masterControlState.pauseTime = null;
    broadcast('master-reset', { timestamp: new Date().toISOString() });
    res.json({ ok: true, action: 'reset' });
});

// ----------------------------------------------------------------
// Connected Devices Routes
// ----------------------------------------------------------------

/**
 * GET /api/devices
 * Returns the current list of connected devices.
 */
app.get('/api/devices', (_req, res) => {
    res.json({ devices: Array.from(connectedDevices.values()), count: connectedDevices.size });
});

/**
 * POST /api/register-device
 * Accepts client-side device info and merges it with server-side data.
 *
 * Body: { clientId, os, browser, deviceType, screenResolution, language, timezone, connectionType }
 */
app.post('/api/register-device', (req, res) => {
    const { clientId, ...info } = req.body || {};
    if (!clientId || !connectedDevices.has(clientId)) {
        return res.status(404).json({ error: 'Device not found' });
    }
    const existing = connectedDevices.get(clientId);
    connectedDevices.set(clientId, { ...existing, ...info });
    broadcastDevices();
    res.json({ ok: true });
});

/**
 * GET /api/ping
 * RTT echo endpoint — returns the current server timestamp so the browser
 * can calculate its own round-trip time to the server.
 * The client records Date.now() before the request and subtracts it from
 * Date.now() after receiving the response to get RTT.
 */
app.get('/api/ping', (req, res) => {
    res.json({ timestamp: Date.now() });
});

/**
 * POST /api/ping/:ip
 * Attempts an ICMP ping to the given IP using child_process.execFile.
 * If ICMP is blocked (e.g. Railway's container network), falls back to a
 * demo-mode simulated latency so the UI always shows a useful result.
 *
 * Response shape:
 *   mode: "icmp"        — real ICMP ping succeeded
 *   mode: "demo"        — ICMP failed; simulated realistic latency returned
 */
app.post('/api/ping/:ip', pingRateLimiter, (req, res) => {
    const ip = req.params.ip;
    // Validate: strict IPv4 or IPv6 — no shell metacharacters allowed
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    const isIPv6 = /^[\da-fA-F:]+$/.test(ip) && ip.includes(':');
    if (!isIPv4 && !isIPv6) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    // Use execFile (not exec) so the IP is passed as an argument — no shell injection possible
    execFile('ping', ['-c', '4', '-W', '5', ip], { timeout: 30000 }, (error, stdout) => {
        if (!error) {
            // ICMP succeeded — parse and return real results
            const avgMatch = stdout.match(/avg[^=]*=\s*[\d.]+\/([\d.]+)/);
            const avgLatency = avgMatch ? parseFloat(avgMatch[1]) : null;
            const packetLossMatch = stdout.match(/([\d.]+)% packet loss/);
            const packetLoss = packetLossMatch ? parseFloat(packetLossMatch[1]) : null;
            return res.json({
                ok: true,
                ip,
                reachable: true,
                mode: 'icmp',
                avgLatency: avgLatency ? `${avgLatency}ms` : 'unknown',
                packetLoss: packetLoss !== null ? `${packetLoss}%` : 'unknown',
                output: stdout,
            });
        }

        // ICMP failed — return demo-mode simulated latency so the UI stays useful
        const MIN_SIMULATED_MS = 10;
        const MAX_SIMULATED_MS = 50;
        const simulated = Math.floor(Math.random() * (MAX_SIMULATED_MS - MIN_SIMULATED_MS + 1)) + MIN_SIMULATED_MS;
        return res.json({
            ok: true,
            ip,
            reachable: true,
            mode: 'demo',
            avgLatency: `${simulated}ms`,
            packetLoss: '0%',
            message: 'ICMP blocked by platform — simulated latency shown',
        });
    });
});

// ----------------------------------------------------------------
// Catchall 404 handler — must be registered after all routes
// ----------------------------------------------------------------
app.use((req, res) => {
    console.error(`❌ 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({
        error: 'Not Found',
        path: req.url,
        method: req.method,
        message: 'This endpoint does not exist. Check server logs for registered routes.',
    });
});

// ----------------------------------------------------------------
// Start Server
// ----------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🛡️  Cyber Resilience API running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 Stream:    http://localhost:${PORT}/api/stream`);
    console.log(`❤️  Health:   http://localhost:${PORT}/health`);

    // Log registered routes for debugging
    console.log('\n📍 Registered routes:');
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
            console.log(`   ${methods} ${middleware.route.path}`);
        } else if (middleware.name === 'router') {
            middleware.handle.stack.forEach((handler) => {
                if (handler.route) {
                    const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
                    console.log(`   ${methods} ${handler.route.path}`);
                }
            });
        }
    });
});

module.exports = app; // allow testing
