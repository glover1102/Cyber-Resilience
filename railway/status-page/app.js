/**
 * Cyber Resilience Dashboard - Client-side Application
 * Connects to the Railway API via Server-Sent Events (SSE) for real-time updates.
 */

// --- Configuration ---
const API_BASE = window.location.origin;
const SSE_ENDPOINT = `${API_BASE}/api/stream`;

// --- State ---
let eventSource = null;
let reconnectTimeout = null;
let reconnectDelay = 2000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_TIMELINE_ITEMS = 50;

// --- DOM Helpers ---
const $ = (id) => document.getElementById(id);

// --- Initialise ---
document.addEventListener('DOMContentLoaded', () => {
    setStartTime();
    setQrUrl();
    connectSSE();
});

/** Set the initial timestamp in the timeline */
function setStartTime() {
    const el = $('start-time');
    if (el) el.textContent = formatTime(new Date());
}

/** Display the current dashboard URL in the QR section */
function setQrUrl() {
    const el = $('qr-url');
    if (el) el.textContent = window.location.href;
}

// ================================================================
// Server-Sent Events
// ================================================================

/** Open an SSE connection to the API and wire up handlers */
function connectSSE() {
    if (eventSource) {
        eventSource.close();
    }

    setConnectionStatus('connecting');

    eventSource = new EventSource(SSE_ENDPOINT);

    eventSource.addEventListener('open', () => {
        reconnectDelay = 2000; // reset back-off on successful connect
        setConnectionStatus('connected');
        addTimelineEvent('info', 'Connected to live data stream');
    });

    // Default message handler — receives JSON metric updates
    eventSource.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleUpdate(data);
        } catch (err) {
            console.warn('Failed to parse SSE message:', err);
        }
    });

    // Named event: status update
    eventSource.addEventListener('status', (event) => {
        try {
            const data = JSON.parse(event.data);
            handleUpdate(data);
        } catch (err) {
            console.warn('Failed to parse status event:', err);
        }
    });

    // Named event: alert (e.g., ransomware detected)
    eventSource.addEventListener('alert', (event) => {
        try {
            const data = JSON.parse(event.data);
            showAlertBanner(data.message || 'Security alert detected');
            addTimelineEvent('danger', `ALERT: ${data.message || 'Security alert'}`);
        } catch (err) {
            console.warn('Failed to parse alert event:', err);
        }
    });

    // Named event: recovery
    eventSource.addEventListener('recovery', (event) => {
        try {
            const data = JSON.parse(event.data);
            hideAlertBanner();
            addTimelineEvent('success', `Recovery: ${data.message || 'Systems recovering'}`);
        } catch (err) {
            console.warn('Failed to parse recovery event:', err);
        }
    });

    eventSource.addEventListener('error', () => {
        setConnectionStatus('disconnected');
        eventSource.close();
        scheduleReconnect();
    });
}

/** Schedule an SSE reconnect with exponential back-off */
function scheduleReconnect() {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    addTimelineEvent('warning', `Connection lost — retrying in ${reconnectDelay / 1000}s`);

    reconnectTimeout = setTimeout(() => {
        connectSSE();
    }, reconnectDelay);

    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

// ================================================================
// Data Handlers
// ================================================================

/**
 * Process an incoming update payload.
 * Expected shape:
 * {
 *   systems: {
 *     "primary-dc": { status: "online"|"warning"|"offline", cpu: 45, memory: 60, network: 12.5 },
 *     ...
 *   },
 *   attack_active: false,
 *   event: { type: "info"|"warning"|"danger"|"success", message: "..." }
 * }
 */
function handleUpdate(data) {
    updateLastUpdated();

    if (data.systems) {
        updateStatusCards(data.systems);
        updateOverview(data.systems);
    }

    if (data.attack_active !== undefined) {
        if (data.attack_active) {
            showAlertBanner(data.alert_message || 'Ransomware attack detected!');
        } else {
            hideAlertBanner();
        }
    }

    if (data.event) {
        addTimelineEvent(data.event.type || 'info', data.event.message);
    }
}

/** Update all status cards from a systems map */
function updateStatusCards(systems) {
    for (const [key, info] of Object.entries(systems)) {
        updateCard(key, info);
    }
}

/**
 * Update a single status card.
 * @param {string} key - e.g. "primary-dc"
 * @param {Object} info - { status, cpu, memory, network }
 */
function updateCard(key, info) {
    const card = $(`card-${key}`);
    const badge = $(`badge-${key}`);
    const pulse = $(`pulse-${key}`);
    if (!card) return;

    const status = (info.status || 'online').toLowerCase();

    // Update card border / class
    card.className = 'status-card';
    if (status === 'offline') card.classList.add('offline');
    else if (status === 'warning') card.classList.add('warning');

    // Update badge
    if (badge) {
        badge.className = `card-status-badge ${status}`;
        badge.textContent = status.toUpperCase();
    }

    // Update pulse indicator
    if (pulse) {
        pulse.className = `card-pulse ${status !== 'online' ? status : ''}`;
    }

    // Update metric bars
    const cpu = clamp(info.cpu ?? 0, 0, 100);
    const mem = clamp(info.memory ?? 0, 0, 100);
    const net = info.network ?? 0;
    const netPct = clamp(net / 100 * 100, 0, 100); // scale for bar

    setMetricBar(`cpu-${key}`, cpu, `cpu-pct-${key}`, `${cpu.toFixed(0)}%`);
    setMetricBar(`mem-${key}`, mem, `mem-pct-${key}`, `${mem.toFixed(0)}%`);

    // Third metric varies by system type
    const netEl = $(`net-${key}`);
    const netPctEl = $(`net-pct-${key}`);
    if (netEl) {
        netEl.style.width = `${netPct}%`;
        applyBarColour(netEl, netPct);
    }
    if (netPctEl) {
        if (key === 'soc') {
            netPctEl.textContent = `${Math.round(net)}`;
        } else if (key === 'backup') {
            netPctEl.textContent = `${net.toFixed(0)}%`;
        } else if (key === 'application') {
            netPctEl.textContent = `${Math.round(net)}`;
        } else {
            netPctEl.textContent = `${net.toFixed(1)} MB/s`;
        }
    }
}

/** Set a metric bar width + label and apply colour based on value */
function setMetricBar(barId, pct, labelId, labelText) {
    const bar = $(barId);
    const label = $(labelId);
    if (bar) {
        bar.style.width = `${pct}%`;
        applyBarColour(bar, pct);
    }
    if (label) label.textContent = labelText;
}

/** Colour a metric bar based on percentage threshold */
function applyBarColour(bar, pct) {
    bar.className = 'metric-bar';
    if (pct >= 85) bar.classList.add('critical');
    else if (pct >= 65) bar.classList.add('warning');
}

/** Update the overall system overview numbers */
function updateOverview(systems) {
    const entries = Object.values(systems);
    const onlineCount = entries.filter(s => (s.status || 'online') === 'online').length;
    const total = entries.length;
    const alertCount = entries.filter(s => s.status === 'offline' || s.status === 'warning').length;

    const onlineEl = $('systems-online');
    if (onlineEl) onlineEl.textContent = `${onlineCount}/${total}`;

    const alertEl = $('active-alerts');
    if (alertEl) {
        alertEl.textContent = alertCount;
        alertEl.className = `metric-value ${alertCount > 0 ? 'alert-count' : ''}`;
    }

    const overallEl = $('overall-status');
    if (overallEl) {
        if (alertCount === 0) {
            overallEl.textContent = 'OPERATIONAL';
            overallEl.style.color = 'var(--color-online)';
        } else if (entries.some(s => s.status === 'offline')) {
            overallEl.textContent = 'DEGRADED';
            overallEl.style.color = 'var(--color-offline)';
        } else {
            overallEl.textContent = 'WARNING';
            overallEl.style.color = 'var(--color-warning)';
        }
    }
}

// ================================================================
// Alert Banner
// ================================================================

function showAlertBanner(message) {
    const banner = $('alert-banner');
    const msgEl = $('alert-message');
    const tsEl = $('alert-timestamp');
    if (banner) banner.classList.remove('hidden');
    if (msgEl) msgEl.textContent = message;
    if (tsEl) tsEl.textContent = formatTime(new Date());
}

function hideAlertBanner() {
    const banner = $('alert-banner');
    if (banner) banner.classList.add('hidden');
}

// ================================================================
// Timeline
// ================================================================

/**
 * Prepend a new event to the timeline.
 * @param {'info'|'warning'|'danger'|'success'} type
 * @param {string} message
 */
function addTimelineEvent(type, message) {
    const timeline = $('timeline');
    if (!timeline) return;

    const item = document.createElement('div');
    item.className = `timeline-item ${type}`;
    item.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
            <span class="timeline-time">${formatTime(new Date())}</span>
            <span class="timeline-desc">${escapeHtml(message)}</span>
        </div>
    `;

    // Insert at top (most recent first)
    timeline.insertBefore(item, timeline.firstChild);

    // Trim excess items
    while (timeline.children.length > MAX_TIMELINE_ITEMS) {
        timeline.removeChild(timeline.lastChild);
    }
}

// ================================================================
// Connection Status UI
// ================================================================

function setConnectionStatus(state) {
    const dot = $('connection-dot');
    const text = $('connection-text');
    if (!dot || !text) return;

    dot.className = 'status-dot';

    switch (state) {
        case 'connected':
            dot.classList.add('connected');
            text.textContent = 'Live';
            break;
        case 'disconnected':
            dot.classList.add('disconnected');
            text.textContent = 'Disconnected';
            break;
        default:
            text.textContent = 'Connecting...';
    }
}

function updateLastUpdated() {
    const el = $('last-updated');
    if (el) el.textContent = formatTime(new Date());
}

// ================================================================
// Utilities
// ================================================================

function formatTime(date) {
    return date.toLocaleTimeString('en-GB', { hour12: false });
}

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
