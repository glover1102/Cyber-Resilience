/**
 * Internationalisation — UI Translation (English ↔ Spanish)
 * Usage: translateUI('es') / translateUI('en')
 * Elements with data-i18n="key" have their textContent replaced.
 * Elements with data-i18n-title="key" have their title attribute replaced.
 */

const UI_TRANSLATIONS = {
    en: {
        // Header
        'header-title':          'Cyber Resilience',
        'header-subtitle':       'Live Demonstration Platform',
        'reset-btn':             '🔄 RESET',
        'narration-btn-off':     '🎤 OFF',
        'narration-btn-on':      '🎤 ON',
        'theme-toggle-title':    'Toggle light/dark theme',
        'lang-selector-title':   'Narration language',
        'status-connecting':     'Connecting...',
        'status-live':           'Live',
        'status-disconnected':   'Disconnected',
        'last-updated-label':    'Last updated:',

        // Alert Banner
        'alert-title':           'RANSOMWARE DETECTED',
        'alert-message-default': 'Malicious activity detected on the network. Incident response initiated.',

        // KPI Cards
        'kpi-systems-online':    'Systems Online',
        'kpi-active-alerts':     'Active Alerts',
        'kpi-network-traffic':   'Network Traffic',
        'kpi-backup-status':     'Backup Status',

        // Demo Controls
        'demo-mode-normal':      ' Normal (45s)',
        'demo-mode-dramatic':    ' Dramatic (2min)',
        'start-demo':            '🎬 START DEMO',
        'demo-initializing':     'Initializing...',
        'pause-demo':            '⏸️ Pause',
        'resume-demo':           '▶️ Resume',
        'next-phase':            '⏭️ Next',
        'stop-demo':             '⏹️ Stop',
        'narration-demo-off':    '🎤 Narration: OFF',
        'narration-demo-on':     '🎤 Narration: ON',
        'reset-demo':            '🔄 Reset',

        // Master Control
        'master-enable':         '🎮 Enable Master Control',
        'master-disable':        '🎮 Disable Master Control',
        'master-mode-active':    '🎮 MASTER MODE ACTIVE',
        'master-start-all':      '▶️ Start for All',
        'master-pause-all':      '⏸️ Pause for All',
        'master-resume-all':     '▶️ Resume for All',
        'master-next-all':       '⏭️ Next Phase for All',
        'master-stop-all':       '⏹️ Stop for All',
        'master-reset-all':      '🔄 Reset for All',
        'viewer-mode':           '👁️ VIEWER MODE — Following presenter',

        // Section Titles
        'section-critical':      '⚡ Critical Systems',
        'section-metrics':       '📈 Real-time Metrics',
        'section-timeline':      '📋 Event Timeline',
        'section-supporting':    '🗄️ Supporting Systems',
        'supporting-hint':       'Click to expand / collapse (6 systems)',

        // System Cards — titles
        'card-primary-dc-title':   'Primary DC',
        'card-firewall-title':     'Firewall',
        'card-database-title':     'Database',
        'card-edr-title':          'EDR/AV',
        'card-application-title':  'Application',

        // System Cards — roles
        'card-primary-dc-role':    'Primary Domain Controller',
        'card-firewall-role':      'Network Firewall',
        'card-database-role':      'Database Server',
        'card-edr-role':           'Endpoint Detection & Response',
        'card-application-role':   'Application Server',

        // Supporting Systems Table headers
        'tbl-system':   'System',
        'tbl-status':   'Status',
        'tbl-cpu':      'CPU',
        'tbl-memory':   'Memory',
        'tbl-network':  'Network',

        // Supporting Systems Table rows
        'tbl-secondary-dc': 'Secondary DC',
        'tbl-soc':           'SOC',
        'tbl-noc':           'NOC',
        'tbl-backup':        'Backup',
        'tbl-vpn':           'VPN',
        'tbl-email':         'Email',

        // Gauge Labels
        'gauge-low':  'Low',
        'gauge-high': 'High',

        // Footer
        'footer-line1': '🛡️ Cyber Resilience Demo Platform  |  For educational purposes only',
        'footer-line2': 'MITRE ATT&CK® Framework Reference  |  3-2-1-1-0 Backup Strategy',

        // Timeline
        'dashboard-initialised': 'Dashboard initialised — awaiting metrics',

        // Connected Devices Panel
        'kpi-devices':       'Connected Users',
        'section-devices':   '👥 Connected Devices',
        'devices-connected': 'devices connected',
        'th-device':         'Device',
        'th-ip':             'IP Address',
        'th-browser':        'Browser',
        'th-type':           'Type',
        'th-status-col':     'Status',
        'th-actions':        'Actions',
    },

    es: {
        // Header
        'header-title':          'Ciber Resiliencia',
        'header-subtitle':       'Plataforma de Demostración en Vivo',
        'reset-btn':             '🔄 REINICIAR',
        'narration-btn-off':     '🎤 APAGADO',
        'narration-btn-on':      '🎤 ENCENDIDO',
        'theme-toggle-title':    'Alternar tema claro/oscuro',
        'lang-selector-title':   'Idioma de narración',
        'status-connecting':     'Conectando...',
        'status-live':           'En vivo',
        'status-disconnected':   'Desconectado',
        'last-updated-label':    'Última actualización:',

        // Alert Banner
        'alert-title':           'RANSOMWARE DETECTADO',
        'alert-message-default': 'Actividad maliciosa detectada en la red. Respuesta a incidentes iniciada.',

        // KPI Cards
        'kpi-systems-online':    'Sistemas en Línea',
        'kpi-active-alerts':     'Alertas Activas',
        'kpi-network-traffic':   'Tráfico de Red',
        'kpi-backup-status':     'Estado de Respaldo',

        // Demo Controls
        'demo-mode-normal':      ' Normal (45s)',
        'demo-mode-dramatic':    ' Dramático (2min)',
        'start-demo':            '🎬 INICIAR DEMO',
        'demo-initializing':     'Inicializando...',
        'pause-demo':            '⏸️ Pausa',
        'resume-demo':           '▶️ Reanudar',
        'next-phase':            '⏭️ Siguiente',
        'stop-demo':             '⏹️ Detener',
        'narration-demo-off':    '🎤 Narración: APAGADO',
        'narration-demo-on':     '🎤 Narración: ENCENDIDO',
        'reset-demo':            '🔄 Reiniciar',

        // Master Control
        'master-enable':         '🎮 Habilitar Control Maestro',
        'master-disable':        '🎮 Deshabilitar Control Maestro',
        'master-mode-active':    '🎮 MODO MAESTRO ACTIVO',
        'master-start-all':      '▶️ Iniciar para Todos',
        'master-pause-all':      '⏸️ Pausar para Todos',
        'master-resume-all':     '▶️ Reanudar para Todos',
        'master-next-all':       '⏭️ Siguiente Fase para Todos',
        'master-stop-all':       '⏹️ Detener para Todos',
        'master-reset-all':      '🔄 Reiniciar para Todos',
        'viewer-mode':           '👁️ MODO ESPECTADOR — Siguiendo al presentador',

        // Section Titles
        'section-critical':      '⚡ Sistemas Críticos',
        'section-metrics':       '📈 Métricas en Tiempo Real',
        'section-timeline':      '📋 Línea de Tiempo de Eventos',
        'section-supporting':    '🗄️ Sistemas de Soporte',
        'supporting-hint':       'Clic para expandir / colapsar (6 sistemas)',

        // System Cards — titles
        'card-primary-dc-title':   'DC Primario',
        'card-firewall-title':     'Firewall',
        'card-database-title':     'Base de Datos',
        'card-edr-title':          'EDR/AV',
        'card-application-title':  'Aplicación',

        // System Cards — roles
        'card-primary-dc-role':    'Controlador de Dominio Primario',
        'card-firewall-role':      'Firewall de Red',
        'card-database-role':      'Servidor de Base de Datos',
        'card-edr-role':           'Detección y Respuesta de Endpoints',
        'card-application-role':   'Servidor de Aplicaciones',

        // Supporting Systems Table headers
        'tbl-system':   'Sistema',
        'tbl-status':   'Estado',
        'tbl-cpu':      'CPU',
        'tbl-memory':   'Memoria',
        'tbl-network':  'Red',

        // Supporting Systems Table rows
        'tbl-secondary-dc': 'DC Secundario',
        'tbl-soc':           'SOC',
        'tbl-noc':           'NOC',
        'tbl-backup':        'Respaldo',
        'tbl-vpn':           'VPN',
        'tbl-email':         'Correo',

        // Gauge Labels
        'gauge-low':  'Bajo',
        'gauge-high': 'Alto',

        // Footer
        'footer-line1': '🛡️ Plataforma de Demostración de Ciber Resiliencia  |  Solo con fines educativos',
        'footer-line2': 'Referencia del Marco MITRE ATT&CK®  |  Estrategia de Respaldo 3-2-1-1-0',

        // Timeline
        'dashboard-initialised': 'Panel inicializado — esperando métricas',

        // Connected Devices Panel
        'kpi-devices':       'Usuarios Conectados',
        'section-devices':   '👥 Dispositivos Conectados',
        'devices-connected': 'dispositivos conectados',
        'th-device':         'Dispositivo',
        'th-ip':             'Dirección IP',
        'th-browser':        'Navegador',
        'th-type':           'Tipo',
        'th-status-col':     'Estado',
        'th-actions':        'Acciones',
    },
};

/** Currently active language code */
let currentLang = 'en';

/**
 * Look up a translation key in the active language, falling back to English.
 * @param {string} key
 * @returns {string}
 */
function t(key) {
    const dict = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS['en'];
    return (dict[key] !== undefined) ? dict[key] : (UI_TRANSLATIONS['en'][key] || key);
}

/**
 * Return a localised viewer-count string.
 * @param {number} count
 * @returns {string}
 */
function tViewerCount(count) {
    if (currentLang === 'es') {
        const noun = count !== 1 ? 'espectadores' : 'espectador';
        return `${count} ${noun} ${count !== 1 ? 'conectados' : 'conectado'}`;
    }
    return `${count} viewer${count !== 1 ? 's' : ''} connected`;
}

/**
 * Apply translations for the given language to all marked elements in the DOM.
 * @param {string} lang  'en' or 'es'
 */
function translateUI(lang) {
    currentLang = lang;
    const dict = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS['en'];

    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key] !== undefined) el.textContent = dict[key];
    });

    // title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (dict[key] !== undefined) el.title = dict[key];
    });

    // placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key] !== undefined) el.placeholder = dict[key];
    });

    // Update <html lang> attribute
    document.documentElement.lang = lang === 'es' ? 'es' : 'en';
}
