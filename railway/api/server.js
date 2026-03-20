/**
 * Cyber Resilience API Server
 *
 * Endpoints:
 *   POST /api/metrics          - Receive metrics from the local forwarder
 *   GET  /api/status           - Return current system status snapshot
 *   GET  /api/stream           - Server-Sent Events for real-time updates
 *   POST /api/simulate-attack  - Trigger a demo attack simulation
 *   GET  /health               - Health check
 *
 * Serves the static status-page dashboard from ../status-page/
 */

'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');

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

/** Registered SSE clients */
const sseClients = new Set();

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

    // Send current state immediately on connect
    const initial = JSON.stringify({
        systems: systemStatus,
        attack_active: attackActive,
        alert_message: alertMessage,
        timestamp: new Date().toISOString(),
        event: { type: 'info', message: 'Connected to live data stream' },
    });
    res.write(`event: status\ndata: ${initial}\n\n`);

    sseClients.add(res);

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
