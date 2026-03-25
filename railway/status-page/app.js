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

/** Client ID assigned by the server for device registration */
let myClientId = null;

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
            if (timelineChart) timelineChart.draw();
        });
        // Set icon to match saved theme
        const saved = localStorage.getItem('theme') || 'dark';
        themeToggle.textContent = saved === 'dark' ? '🌙' : '☀️';
    }

    // Narration toggle (header button)
    const narrationBtn = $('narration-toggle-btn');
    if (narrationBtn) {
        narrationBtn.addEventListener('click', () => {
            const enabled = narrationManager.toggle();
            narrationBtn.textContent = t(enabled ? 'narration-btn-on' : 'narration-btn-off');
            narrationBtn.classList.toggle('active', enabled);
            syncNarrationDemoBtn(enabled);
        });
    }

    // Language selector
    const langSelector = $('lang-selector');
    if (langSelector) {
        const savedLang = localStorage.getItem('narration-lang') || 'en';
        langSelector.value = savedLang;
        narrationManager.setLanguage(savedLang);
        if (savedLang !== 'en') translateUI(savedLang);

        langSelector.addEventListener('change', () => {
            const lang = langSelector.value;
            narrationManager.setLanguage(lang);
            localStorage.setItem('narration-lang', lang);
            translateUI(lang);
        });
    }

    // Reset button (header)
    const resetBtn = $('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetDemo);

    // Supporting systems collapsible
    const toggleEl = $('supporting-toggle');
    const bodyEl   = $('supporting-body');
    if (toggleEl && bodyEl) {
        const expand = () => {
            const isExpanded = toggleEl.getAttribute('aria-expanded') === 'true';
            toggleEl.setAttribute('aria-expanded', String(!isExpanded));
            bodyEl.classList.toggle('hidden', isExpanded);
        };
        toggleEl.addEventListener('click', expand);
        toggleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expand(); }
        });
    }

    // Connected devices collapsible
    const devicesToggle = $('devices-toggle');
    const devicesBody = $('devices-body');
    if (devicesToggle && devicesBody) {
        const expandDevices = () => {
            const isExpanded = devicesToggle.getAttribute('aria-expanded') === 'true';
            devicesToggle.setAttribute('aria-expanded', String(!isExpanded));
            devicesBody.classList.toggle('hidden', isExpanded);
        };
        devicesToggle.addEventListener('click', expandDevices);
        devicesToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expandDevices(); }
        });
    }

    // Timeline chart
    timelineChart = new TimelineChart('timeline-canvas');
});

/** Set the initial timestamp in the timeline */
function setStartTime() {
    const el = $('start-time');
    if (el) el.textContent = formatTime(new Date());
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

    // Named event: viewer count update
    eventSource.addEventListener('viewer-count', (event) => {
        try {
            const data = JSON.parse(event.data);
            updateViewerCount(data.count);
        } catch (err) {
            console.warn('Failed to parse viewer-count event:', err);
        }
    });

    // Named event: client ID assigned by server
    eventSource.addEventListener('client-id', (event) => {
        try {
            const data = JSON.parse(event.data);
            myClientId = data.clientId;
            registerDeviceInfo(data.clientId);
        } catch (err) {
            console.warn('Failed to parse client-id event:', err);
        }
    });

    // Named event: connected devices list update
    eventSource.addEventListener('devices-update', (event) => {
        try {
            const data = JSON.parse(event.data);
            updateDevicesPanel(data.devices, data.count);
        } catch (err) {
            console.warn('Failed to parse devices-update event:', err);
        }
    });

    // Master control events — received by all viewers (non-master clients)
    eventSource.addEventListener('master-play', () => {
        if (!isMasterMode) {
            showViewerModeIndicator(true);
            startDemo();
            addTimelineEvent('info', '🎮 Master started demo');
        }
    });

    eventSource.addEventListener('master-pause', () => {
        if (!isMasterMode && !demoPaused) {
            togglePauseDemo();
            addTimelineEvent('info', '🎮 Master paused demo');
        }
    });

    eventSource.addEventListener('master-resume', () => {
        if (!isMasterMode && demoPaused) {
            togglePauseDemo();
            addTimelineEvent('info', '🎮 Master resumed demo');
        }
    });

    eventSource.addEventListener('master-next-phase', () => {
        if (!isMasterMode) {
            nextPhaseDemo();
            addTimelineEvent('info', '🎮 Master advanced to next phase');
        }
    });

    eventSource.addEventListener('master-stop', () => {
        if (!isMasterMode) {
            stopDemo();
            showViewerModeIndicator(false);
            addTimelineEvent('info', '🎮 Master stopped demo');
        }
    });

    eventSource.addEventListener('master-reset', () => {
        if (!isMasterMode) {
            resetDemo();
            showViewerModeIndicator(false);
            addTimelineEvent('info', '🎮 Master reset demo');
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
        updateSupportingTableRow(key, info);
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

    // Preserve extra classes (e.g. critical-card) added in HTML
    const extraClasses = [...card.classList].filter(c => !['status-card', 'offline', 'warning'].includes(c));
    card.className = ['status-card', ...extraClasses].join(' ');
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

    // KPI cards
    updateKpiCard('kpi-systems', `${onlineCount}/${total}`,
        onlineCount === total ? '+0%' : `-${total - onlineCount}`, onlineCount === total);

    updateKpiCard('kpi-alerts', String(alertCount),
        alertCount === 0 ? '+0' : `+${alertCount}`, alertCount === 0);

    // Push aggregated CPU / network to timeline chart
    if (timelineChart) {
        const avgCpu = entries.reduce((s, e) => s + (e.cpu || 0), 0) / (entries.length || 1);
        const avgNet = entries.reduce((s, e) => s + (e.network || 0), 0) / (entries.length || 1);
        timelineChart.push(avgCpu, Math.min(avgNet * 5, 100), alertCount);
    }
}

/**
 * Update a KPI card value and change indicator.
 * @param {string} id - base element id (e.g. 'kpi-systems')
 * @param {string} value - display value
 * @param {string} change - change string (e.g. '+0%')
 * @param {boolean} positive - true = green, false = red
 */
function updateKpiCard(id, value, change, positive) {
    const valEl    = $(id);
    const changeEl = $(`${id}-change`);
    if (valEl)    valEl.textContent = value;
    if (changeEl) {
        changeEl.textContent = change;
        changeEl.className = `kpi-change ${positive ? 'positive' : 'negative'}`;
    }
}

/** Update supporting systems table row */
function updateSupportingTableRow(key, info) {
    const supportingKeys = ['secondary-dc', 'soc', 'noc', 'backup', 'vpn', 'email'];
    if (!supportingKeys.includes(key)) return;

    const status = (info.status || 'online').toLowerCase();
    const cpu    = info.cpu    != null ? `${info.cpu.toFixed(0)}%`    : '—';
    const mem    = info.memory != null ? `${info.memory.toFixed(0)}%` : '—';
    const net    = info.network != null ? `${info.network.toFixed(1)}` : '—';

    const badgeEl = $(`tbl-badge-${key}`);
    if (badgeEl) {
        badgeEl.textContent = status.toUpperCase();
        badgeEl.className   = `tbl-badge ${status}`;
    }
    const cpuEl = $(`tbl-cpu-${key}`);
    const memEl = $(`tbl-mem-${key}`);
    const netEl = $(`tbl-net-${key}`);
    if (cpuEl) cpuEl.textContent = cpu;
    if (memEl) memEl.textContent = mem;
    if (netEl) netEl.textContent = net;
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
            text.textContent = t('status-live');
            break;
        case 'disconnected':
            dot.classList.add('disconnected');
            text.textContent = t('status-disconnected');
            break;
        default:
            text.textContent = t('status-connecting');
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
// Master Control
// ================================================================

let isMasterMode = false;

function showViewerModeIndicator(visible) {
    const indicator = $('viewer-mode-indicator');
    if (indicator) indicator.classList.toggle('hidden', !visible);
}

function updateViewerCount(count) {
    const el = $('viewer-count');
    if (el) el.textContent = tViewerCount(count);
}

function masterControlFetch(action) {
    const token = sessionStorage.getItem('masterToken') || '';
    return fetch(`${API_BASE}/api/master-control/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-master-token': token },
        body: JSON.stringify({ token }),
    }).then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || res.statusText); });
        return res.json();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = $('master-mode-toggle');
    const masterPanel = $('master-panel');
    const viewerIndicator = $('viewer-mode-indicator');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!isMasterMode) {
                // Prompt for token only if server requires one
                const token = prompt('Enter Master Control token (leave blank if not required):');
                if (token === null) return; // cancelled
                sessionStorage.setItem('masterToken', token || '');
            }

            isMasterMode = !isMasterMode;
            toggleBtn.textContent = isMasterMode ? t('master-disable') : t('master-enable');
            toggleBtn.classList.toggle('active', isMasterMode);
            if (masterPanel) masterPanel.classList.toggle('hidden', !isMasterMode);
            if (viewerIndicator) viewerIndicator.classList.add('hidden');

            addTimelineEvent('info', isMasterMode ? '🎮 Master control enabled' : '🎮 Master control disabled');
        });
    }

    const masterPlayBtn  = $('master-play-btn');
    const masterPauseBtn = $('master-pause-btn');
    const masterNextBtn  = $('master-next-btn');
    const masterStopBtn  = $('master-stop-btn');
    const masterResetBtn = $('master-reset-btn');

    if (masterPlayBtn) {
        masterPlayBtn.addEventListener('click', () => {
            masterControlFetch('play')
                .then(() => { startDemo(); addTimelineEvent('info', '🎮 Master: started demo for all'); })
                .catch(err => { showToast(`❌ ${err.message}`, 'danger'); });
        });
    }

    if (masterPauseBtn) {
        masterPauseBtn.addEventListener('click', () => {
            const action = demoPaused ? 'resume' : 'pause';
            masterControlFetch(action)
                .then(() => {
                    togglePauseDemo();
                    masterPauseBtn.textContent = demoPaused ? t('master-resume-all') : t('master-pause-all');
                    addTimelineEvent('info', `🎮 Master: ${action}d demo for all`);
                })
                .catch(err => { showToast(`❌ ${err.message}`, 'danger'); });
        });
    }

    if (masterNextBtn) {
        masterNextBtn.addEventListener('click', () => {
            masterControlFetch('next-phase')
                .then(() => { nextPhaseDemo(); addTimelineEvent('info', '🎮 Master: next phase for all'); })
                .catch(err => { showToast(`❌ ${err.message}`, 'danger'); });
        });
    }

    if (masterStopBtn) {
        masterStopBtn.addEventListener('click', () => {
            masterControlFetch('stop')
                .then(() => { stopDemo(); addTimelineEvent('info', '🎮 Master: stopped demo for all'); })
                .catch(err => { showToast(`❌ ${err.message}`, 'danger'); });
        });
    }

    if (masterResetBtn) {
        masterResetBtn.addEventListener('click', () => {
            masterControlFetch('reset')
                .then(() => { resetDemo(); addTimelineEvent('info', '🎮 Master: reset demo for all'); })
                .catch(err => { showToast(`❌ ${err.message}`, 'danger'); });
        });
    }
});

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
    const narrationDemoBtn = $('narration-demo-btn');
    const resetDemoBtn     = $('reset-demo-btn');

    if (startBtn)  startBtn.addEventListener('click', startDemo);
    if (pauseBtn)  pauseBtn.addEventListener('click', togglePauseDemo);
    if (nextBtn)   nextBtn.addEventListener('click', nextPhaseDemo);
    if (stopBtn)   stopBtn.addEventListener('click', stopDemo);
    if (narrationDemoBtn) {
        narrationDemoBtn.addEventListener('click', () => {
            const enabled = narrationManager.toggle();
            syncNarrationDemoBtn(enabled);
            // Keep header button in sync
            const headerBtn = $('narration-toggle-btn');
            if (headerBtn) {
                headerBtn.textContent = t(enabled ? 'narration-btn-on' : 'narration-btn-off');
                headerBtn.classList.toggle('active', enabled);
            }
        });
    }
    if (resetDemoBtn) resetDemoBtn.addEventListener('click', resetDemo);
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
    if (pauseBtn)    pauseBtn.textContent = t('pause-demo');

    if (typeof narrationManager !== 'undefined') narrationManager.stop();

    addTimelineEvent('info', '⏹️ Demo stopped');
}

function togglePauseDemo() {
    const pauseBtn = $('pause-demo-btn');
    if (demoPaused) {
        // Resume: shift start time by pause duration
        const pauseDuration = Date.now() - demoPauseTime;
        demoStartTime += pauseDuration;
        demoPaused = false;
        if (pauseBtn) pauseBtn.textContent = t('pause-demo');
        if (typeof narrationManager !== 'undefined') narrationManager.resume();
        addTimelineEvent('info', '▶️ Demo resumed');
    } else {
        demoPaused = true;
        demoPauseTime = Date.now();
        if (pauseBtn) pauseBtn.textContent = t('resume-demo');
        if (typeof narrationManager !== 'undefined') narrationManager.pause();
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

            // Voice narration
            if (typeof narrationManager !== 'undefined') {
                narrationManager.speak(phase);
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

// ================================================================
// Reset Demo
// ================================================================

function resetDemo() {
    stopDemo();

    // Reset all critical system gauges to baseline values
    const baseline = {
        'primary-dc':  { cpu: 20, mem: 45, net: 12 },
        'firewall':    { cpu: 15, mem: 30, net: 800 },
        'database':    { cpu: 45, mem: 60, net: 150 },
        'edr':         { cpu: 20, mem: 35, net: 5 },
        'application': { cpu: 42, mem: 55, net: 120 },
    };

    Object.entries(baseline).forEach(([key, vals]) => {
        updateCircularGauge(key, 'cpu', vals.cpu, `${vals.cpu}%`);
        updateCircularGauge(key, 'mem', vals.mem, `${vals.mem}%`);
        updateCircularGauge(key, 'net', Math.min(vals.net / 20, 100), `${vals.net}`);

        const card  = $(`card-${key}`);
        const badge = $(`badge-${key}`);
        const pulse = $(`pulse-${key}`);
        if (card)  { card.className = 'status-card critical-card'; }
        if (badge) { badge.className = 'card-status-badge online'; badge.textContent = 'ONLINE'; }
        if (pulse) { pulse.className = 'card-pulse'; }
    });

    // Reset KPI cards
    updateKpiCard('kpi-systems', '11/11', '+0%', true);
    updateKpiCard('kpi-alerts',  '0',     '+0',  true);
    updateKpiCard('kpi-network', '2.4 GB/s', '+0.2%', true);
    updateKpiCard('kpi-backup',  '100%', '+0.4%', true);

    // Clear alerts
    hideAlertBanner();

    // Reset chart
    if (timelineChart) timelineChart.reset();

    // Stop narration
    if (typeof narrationManager !== 'undefined') narrationManager.stop();

    addTimelineEvent('success', '🔄 All systems reset to operational baseline');
    showToast('✅ All systems operational', 'success');
}

// ================================================================
// Toast Notification
// ================================================================

let toastTimeout = null;

function showToast(message, type = 'info') {
    const toast = $('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;

    // Force reflow so animation restarts if called in rapid succession
    void toast.offsetWidth;
    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.className = 'toast hidden'; }, 350);
    }, 3000);
}

// ================================================================
// Narration sync helpers
// ================================================================

function syncNarrationDemoBtn(enabled) {
    const btn = $('narration-demo-btn');
    if (!btn) return;
    btn.textContent = t(enabled ? 'narration-demo-on' : 'narration-demo-off');
    btn.classList.toggle('active', enabled);
}

// ================================================================
// Connected Devices Panel
// ================================================================

/**
 * Collect client-side device info and POST it to the server.
 * @param {number} clientId - The client ID assigned by the server.
 */
function registerDeviceInfo(clientId) {
    const ua = navigator.userAgent;
    const info = {
        clientId,
        os: detectOS(ua),
        browser: detectBrowser(ua),
        deviceType: detectDeviceType(ua),
        screenResolution: `${window.screen.width}×${window.screen.height}`,
        language: navigator.language || 'unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
        connectionType: (navigator.connection && navigator.connection.effectiveType) || 'unknown',
    };
    fetch(`${API_BASE}/api/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
    }).catch(err => console.warn('Failed to register device:', err));
}

function detectOS(ua) {
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/CrOS/.test(ua)) return 'Chrome OS';
    if (/Linux/.test(ua)) return 'Linux';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    return 'Unknown';
}

function detectBrowser(ua) {
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
    return 'Unknown';
}

function detectDeviceType(ua) {
    if (/Mobi|Android.*Mobile|iPhone|iPod/.test(ua)) return 'Mobile';
    if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) return 'Tablet';
    return 'Desktop';
}

/**
 * Update the Connected Devices panel with the latest device list.
 * @param {Array} devices - Array of device objects.
 * @param {number} count  - Total connected device count.
 */
function updateDevicesPanel(devices, count) {
    // Update header badge count
    const badge = $('devices-count-badge');
    if (badge) badge.textContent = count;

    // Update the KPI card
    const kpiDevices = $('kpi-devices');
    if (kpiDevices) kpiDevices.textContent = count;

    // Update the table body
    const tbody = $('devices-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    devices.forEach(device => {
        const tr = document.createElement('tr');
        tr.className = 'device-row';
        tr.dataset.clientId = device.id;

        const deviceIcon = device.deviceType === 'Mobile' ? '📱' :
                          device.deviceType === 'Tablet' ? '📱' : '🖥️';

        tr.innerHTML = `
            <td>${deviceIcon} ${device.os || 'Unknown'}</td>
            <td>${device.ip || 'Unknown'}</td>
            <td>${device.browser || 'Unknown'}</td>
            <td>${device.deviceType || 'Unknown'}</td>
            <td><span class="tbl-badge online">Connected</span></td>
            <td>
                <button class="ping-btn" onclick="pingDevice('${device.ip}', this)" title="Ping this device">🏓 Ping</button>
            </td>
        `;

        // Click row to expand details
        tr.addEventListener('click', (e) => {
            if (e.target.classList.contains('ping-btn')) return;
            toggleDeviceDetails(tr, device);
        });

        tbody.appendChild(tr);
    });
}

/**
 * Toggle an expanded detail row for a device.
 * @param {HTMLTableRowElement} row    - The device row element.
 * @param {object}              device - The device data object.
 */
function toggleDeviceDetails(row, device) {
    const existingDetail = row.nextElementSibling;
    if (existingDetail && existingDetail.classList.contains('device-detail-row')) {
        existingDetail.remove();
        return;
    }

    const detailRow = document.createElement('tr');
    detailRow.className = 'device-detail-row';
    const connectedTime = device.connectedAt ? new Date(device.connectedAt).toLocaleTimeString() : 'Unknown';
    detailRow.innerHTML = `
        <td colspan="6">
            <div class="device-details">
                <div class="detail-item"><strong>Screen:</strong> ${device.screenResolution || 'Unknown'}</div>
                <div class="detail-item"><strong>Language:</strong> ${device.language || 'Unknown'}</div>
                <div class="detail-item"><strong>Timezone:</strong> ${device.timezone || 'Unknown'}</div>
                <div class="detail-item"><strong>Connection:</strong> ${device.connectionType || 'Unknown'}</div>
                <div class="detail-item"><strong>Connected Since:</strong> ${connectedTime}</div>
                <div class="detail-item"><strong>User Agent:</strong> <span class="ua-text">${device.userAgent || 'Unknown'}</span></div>
            </div>
        </td>
    `;
    row.after(detailRow);
}

/**
 * Ping a device IP from the server and show the result.
 * @param {string}          ip  - IP address to ping.
 * @param {HTMLButtonElement} btn - The ping button element.
 */
function pingDevice(ip, btn) {
    if (!ip || ip === 'Unknown') {
        showToast('Cannot ping: IP unknown', 'warning');
        return;
    }
    const originalText = btn.textContent;
    btn.textContent = '⏳ Pinging...';
    btn.disabled = true;

    fetch(`${API_BASE}/api/ping/${encodeURIComponent(ip)}`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.reachable) {
                btn.textContent = `✅ ${data.avgLatency}`;
                showToast(`Ping ${ip}: ${data.avgLatency} (${data.packetLoss} loss)`, 'success');
            } else {
                btn.textContent = '❌ Unreachable';
                showToast(`Ping ${ip}: Unreachable`, 'danger');
            }
            setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 5000);
        })
        .catch(err => {
            btn.textContent = '❌ Error';
            showToast(`Ping failed: ${err.message}`, 'danger');
            setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 3000);
        });
}
