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

// --- Theme ---
(function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
})();

// --- Initialise ---
document.addEventListener('DOMContentLoaded', () => {
    setStartTime();
    setQrUrl();
    connectSSE();

    // Theme toggle
    const themeToggle = $('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
        });
        // Set icon to match saved theme
        const saved = localStorage.getItem('theme') || 'dark';
        themeToggle.textContent = saved === 'dark' ? '🌙' : '☀️';
    }
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

    // Update circular gauges
    const cpu = clamp(info.cpu ?? 0, 0, 100);
    const mem = clamp(info.memory ?? 0, 0, 100);
    const net = info.network ?? 0;
    const netPct = clamp(net, 0, 100);

    updateCircularGauge(key, 'cpu', cpu, `${cpu.toFixed(0)}%`);
    updateCircularGauge(key, 'mem', mem, `${mem.toFixed(0)}%`);

    // Third metric label varies by system type
    let netLabel;
    if (key === 'soc') {
        netLabel = `${Math.round(net)}`;
    } else if (key === 'backup') {
        netLabel = `${net.toFixed(0)}%`;
    } else if (key === 'application') {
        netLabel = `${Math.round(net)}`;
    } else if (key === 'firewall') {
        netLabel = `${Math.round(net)} pkts/s`;
    } else if (key === 'vpn') {
        netLabel = `${Math.round(net)} conn`;
    } else if (key === 'database') {
        netLabel = `${Math.round(net)} q/s`;
    } else if (key === 'email') {
        netLabel = `${Math.round(net)} msgs/hr`;
    } else if (key === 'edr') {
        netLabel = `${Math.round(net)} scans`;
    } else {
        netLabel = `${net.toFixed(1)} MB/s`;
    }
    updateCircularGauge(key, 'net', netPct, netLabel);
}

/**
 * Update a circular gauge (CPU, Memory, Network).
 * @param {string} systemKey - e.g. 'primary-dc'
 * @param {string} metricType - 'cpu', 'mem', or 'net'
 * @param {number} pct - 0-100 percentage for arc/needle position
 * @param {string} displayText - text to show in the gauge centre
 */
function updateCircularGauge(systemKey, metricType, pct, displayText) {
    const arc = $(`arc-${metricType}-${systemKey}`);
    const needle = $(`needle-${metricType}-${systemKey}`);
    const valueEl = $(`gauge-value-${metricType}-${systemKey}`);

    if (!arc || !needle || !valueEl) return;

    // Arc dashoffset: 251.2 is full arc length (π × 80)
    const maxDash = 251.2;
    const offset = maxDash - (maxDash * (pct / 100));
    arc.style.strokeDashoffset = offset;

    // Needle rotation: -90deg (0%) → +90deg (100%)
    const rotation = -90 + (180 * (pct / 100));
    needle.style.transform = `rotate(${rotation}deg)`;

    // Update displayed value
    valueEl.textContent = displayText;

    // Critical state (>85%)
    if (pct > 85) {
        valueEl.classList.add('critical');
        needle.classList.add('attack');
    } else {
        valueEl.classList.remove('critical');
        needle.classList.remove('attack');
    }
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

// ================================================================
// Auto Demo Mode
// ================================================================

let demoInterval = null;
let demoTimeoutIds = [];
let demoStartTime = null;
let demoPaused = false;
let demoPauseTime = 0;
let demoPhaseCursor = 0; // index of the next phase to be scheduled

const DEMO_PHASES_NORMAL = [
    { phase: 'start',     delay:  5000, duration: 10000, message: '🔴 Attack Detected' },
    { phase: 'spreading', delay: 15000, duration: 10000, message: '🔴 Ransomware Spreading' },
    { phase: 'encrypted', delay: 25000, duration: 10000, message: '💀 Systems Encrypted' },
    { phase: 'recovery',  delay: 35000, duration: 10000, message: '✅ Recovery Initiated' },
];

const DEMO_PHASES_DRAMATIC = [
    { phase: 'start',     delay:  20000, duration: 30000, message: '🔴 Attack Detected' },
    { phase: 'spreading', delay:  50000, duration: 30000, message: '🔴 Ransomware Spreading' },
    { phase: 'encrypted', delay:  80000, duration: 20000, message: '💀 Systems Encrypted' },
    { phase: 'recovery',  delay: 100000, duration: 20000, message: '✅ Recovery Initiated' },
];

function getDemoPhases() {
    const sel = document.querySelector('input[name="demo-mode"]:checked');
    return sel && sel.value === 'dramatic' ? DEMO_PHASES_DRAMATIC : DEMO_PHASES_NORMAL;
}

function getDemoTotal() {
    const phases = getDemoPhases();
    const last = phases[phases.length - 1];
    return last.delay + last.duration;
}

document.addEventListener('DOMContentLoaded', () => {
    const startBtn  = $('start-demo-btn');
    const pauseBtn  = $('pause-demo-btn');
    const nextBtn   = $('next-phase-btn');
    const stopBtn   = $('stop-demo-btn');

    if (startBtn)  startBtn.addEventListener('click', startDemo);
    if (pauseBtn)  pauseBtn.addEventListener('click', togglePauseDemo);
    if (nextBtn)   nextBtn.addEventListener('click', nextPhaseDemo);
    if (stopBtn)   stopBtn.addEventListener('click', stopDemo);
});

function startDemo() {
    const startBtn    = $('start-demo-btn');
    const progress    = $('demo-progress');
    const progressBar = $('demo-progress-bar');
    const phaseEl     = $('demo-phase');
    const timerEl     = $('demo-timer');

    if (startBtn)    startBtn.classList.add('hidden');
    if (progress)    progress.classList.remove('hidden');

    demoPaused = false;
    demoPhaseCursor = 0;
    demoStartTime = Date.now();

    const phases = getDemoPhases();
    const total = getDemoTotal();

    demoInterval = setInterval(() => {
        if (demoPaused) return;

        const elapsed = Date.now() - demoStartTime;
        const percent = Math.min((elapsed / total) * 100, 100);

        if (progressBar) progressBar.style.width = `${percent}%`;

        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs    = seconds % 60;
        if (timerEl) timerEl.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;

        const currentPhase = phases.find(
            p => elapsed >= p.delay && elapsed < p.delay + p.duration
        );
        if (currentPhase && phaseEl) phaseEl.textContent = currentPhase.message;

        if (elapsed >= total) stopDemo();
    }, 100);

    phases.forEach(({ phase, delay }, idx) => {
        const timeoutId = setTimeout(() => {
            demoPhaseCursor = idx + 1;
            triggerAttackPhase(phase);
        }, delay);
        demoTimeoutIds.push(timeoutId);
    });

    addTimelineEvent('info', '🎬 Auto demo started');
}

function stopDemo() {
    const startBtn    = $('start-demo-btn');
    const progress    = $('demo-progress');
    const progressBar = $('demo-progress-bar');
    const pauseBtn    = $('pause-demo-btn');

    if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
    }

    demoTimeoutIds.forEach(id => clearTimeout(id));
    demoTimeoutIds = [];
    demoPaused = false;
    demoPhaseCursor = 0;

    if (startBtn)    startBtn.classList.remove('hidden');
    if (progress)    progress.classList.add('hidden');
    if (progressBar) progressBar.style.width = '0%';
    if (pauseBtn)    pauseBtn.textContent = '⏸️ Pause';

    addTimelineEvent('info', '⏹️ Demo stopped');
}

function togglePauseDemo() {
    const pauseBtn = $('pause-demo-btn');
    if (demoPaused) {
        // Resume: shift start time by pause duration
        const pauseDuration = Date.now() - demoPauseTime;
        demoStartTime += pauseDuration;
        demoPaused = false;
        if (pauseBtn) pauseBtn.textContent = '⏸️ Pause';
        addTimelineEvent('info', '▶️ Demo resumed');
    } else {
        demoPaused = true;
        demoPauseTime = Date.now();
        if (pauseBtn) pauseBtn.textContent = '▶️ Resume';
        addTimelineEvent('info', '⏸️ Demo paused');
    }
}

function nextPhaseDemo() {
    const phases = getDemoPhases();
    if (demoPhaseCursor >= phases.length) return;

    // Cancel any pending timeout for the next phase
    const nextPhase = phases[demoPhaseCursor];
    if (!nextPhase) return;

    // Clear all pending timeouts
    demoTimeoutIds.forEach(id => clearTimeout(id));
    demoTimeoutIds = [];

    // Trigger the next phase immediately and compute remaining phases before advancing cursor
    triggerAttackPhase(nextPhase.phase);
    const remaining = phases.slice(demoPhaseCursor + 1);
    demoPhaseCursor++;

    // Reschedule remaining phases relative to now
    remaining.forEach(({ phase }, i) => {
        const delay = (i + 1) * 5000; // 5s gaps between remaining phases
        const timeoutId = setTimeout(() => {
            demoPhaseCursor++;
            triggerAttackPhase(phase);
        }, delay);
        demoTimeoutIds.push(timeoutId);
    });

    addTimelineEvent('info', `⏭️ Skipped to: ${nextPhase.phase}`);
}

function triggerAttackPhase(phase) {
    fetch(`${API_BASE}/api/simulate-attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase }),
    })
        .then(res => res.json())
        .then(data => {
            console.log(`✅ Demo phase "${phase}" triggered`, data);

            // Sound effects
            if (typeof soundManager !== 'undefined') {
                if (phase === 'start') {
                    soundManager.play('alarmStart');
                } else if (phase === 'spreading') {
                    soundManager.play('warning');
                } else if (phase === 'encrypted') {
                    soundManager.play('critical');
                } else if (phase === 'recovery') {
                    soundManager.play('success');
                }
            }

            // Confetti on recovery
            if (phase === 'recovery') {
                setTimeout(() => {
                    if (typeof launchConfetti === 'function') launchConfetti();
                }, 500);
            }
        })
        .catch(err => console.error(`❌ Failed to trigger phase "${phase}"`, err));
}
