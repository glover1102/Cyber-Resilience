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

            // Simulate attack impact on primary DC
            systemStatus['primary-dc'] = { ...systemStatus['primary-dc'], status: 'warning', cpu: 95, memory: 88 };

            broadcastStatus({ type: 'danger', message: '⚠️  Ransomware attack started — reconnaissance phase' });
            broadcast('alert', { message: alertMessage });
            break;
        }
        case 'spreading': {
            systemStatus['primary-dc'] = { ...systemStatus['primary-dc'], status: 'offline', cpu: 100, memory: 95 };
            systemStatus['application'] = { ...systemStatus['application'], status: 'warning', cpu: 88, memory: 82 };

            broadcastStatus({ type: 'danger', message: '🔴 Ransomware spreading — encrypting files on Primary DC' });
            break;
        }
        case 'encrypted': {
            systemStatus['primary-dc'] = { ...systemStatus['primary-dc'], status: 'offline', cpu: 5, memory: 90 };
            systemStatus['application'] = { ...systemStatus['application'], status: 'offline', cpu: 5, memory: 90 };

            broadcastStatus({ type: 'danger', message: '💀 Files encrypted — failover to Secondary DC initiated' });
            break;
        }
        case 'recovery': {
            attackActive = false;
            alertMessage = '';

            // Restore all systems
            systemStatus['primary-dc'] = { status: 'warning', cpu: 30, memory: 45, network: 4.0 };
            systemStatus['secondary-dc'] = { status: 'online', cpu: 55, memory: 65, network: 12.0 };
            systemStatus['application'] = { status: 'online', cpu: 42, memory: 58, network: 95 };

            broadcastStatus({ type: 'success', message: '✅ Recovery complete — systems restored from backup' });
            broadcast('recovery', { message: 'Systems recovered successfully using 3-2-1-1-0 backup strategy' });
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
