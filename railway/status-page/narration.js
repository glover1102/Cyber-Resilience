/**
 * Narration Manager - Voice narration using Web Speech API
 * Female voice, auto-narrates each attack phase
 */
class NarrationManager {
    constructor() {
        this.enabled = false;
        this.supported = 'speechSynthesis' in window;
        this.language = 'en';
        this.scripts = {
            en: {
                'start': 'Alert detected. Ransomware identified on Primary Domain Controller. Firewall has logged anomalous outbound traffic patterns. Security Operations Center is responding. Endpoint Detection and Response agent has initiated containment procedures.',
                'spreading': 'The ransomware is now spreading laterally across the network. VPN gateway and Database server have been compromised. Active connections spiking to two hundred. This is a coordinated attack hitting multiple vectors simultaneously.',
                'encrypted': 'Critical situation. Five systems are now offline. Files have been encrypted with military-grade AES-256 encryption. Primary Domain Controller, Application Server, Database, Email Gateway, and VPN are down. Initiating failover to Secondary Domain Controller. Backup restoration sequence commencing.',
                'recovery': 'Recovery initiated. Restoring from immutable, air-gapped backups using the three-two-one-one-zero strategy. Secondary Domain Controller has assumed primary role. All systems coming back online. Database integrity verified. Application services restored. Incident contained successfully. Total downtime: forty-five seconds. Zero data loss.'
            },
            es: {
                'start': 'Alerta detectada. Ransomware identificado en el Controlador de Dominio Primario. El firewall ha registrado patrones de tráfico saliente anómalos. El Centro de Operaciones de Seguridad está respondiendo. El agente de Detección y Respuesta de Endpoints ha iniciado procedimientos de contención.',
                'spreading': 'El ransomware se está propagando lateralmente a través de la red. La puerta de enlace VPN y el servidor de base de datos han sido comprometidos. Las conexiones activas se están disparando a doscientas. Este es un ataque coordinado que golpea múltiples vectores simultáneamente.',
                'encrypted': 'Situación crítica. Cinco sistemas están ahora fuera de línea. Los archivos han sido cifrados con encriptación AES-256 de grado militar. El Controlador de Dominio Primario, Servidor de Aplicaciones, Base de Datos, Puerta de Enlace de Correo y VPN están caídos. Iniciando conmutación por error al Controlador de Dominio Secundario. Comenzando secuencia de restauración de respaldo.',
                'recovery': 'Recuperación iniciada. Restaurando desde respaldos inmutables y aislados utilizando la estrategia tres-dos-uno-uno-cero. El Controlador de Dominio Secundario ha asumido el rol primario. Todos los sistemas están volviendo en línea. Integridad de la base de datos verificada. Servicios de aplicación restaurados. Incidente contenido exitosamente. Tiempo total de inactividad: cuarenta y cinco segundos. Cero pérdida de datos.'
            }
        };
    }

    setLanguage(lang) {
        this.language = lang;
        this.stop();
    }

    speak(phase) {
        if (!this.enabled || !this.supported) return;

        const text = this.scripts[this.language][phase];
        if (!text) return;

        // Cancel any current speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        utterance.volume = 0.7;

        // Select a voice matching the current language
        const selectVoice = () => {
            const voices = speechSynthesis.getVoices();
            let chosenVoice;
            if (this.language === 'es') {
                utterance.lang = 'es-ES';
                chosenVoice = voices.find(v =>
                    v.name.includes('Paulina') ||
                    v.name.includes('Monica') ||
                    v.name.includes('Jorge') ||
                    v.lang.startsWith('es')
                );
            } else {
                utterance.lang = 'en-US';
                chosenVoice = voices.find(v =>
                    v.name.includes('Female') ||
                    v.name.includes('Zira') ||
                    v.name.includes('Samantha') ||
                    v.name.includes('Karen') ||
                    v.name.includes('Moira') ||
                    v.name.includes('Tessa') ||
                    (v.name.toLowerCase().includes('google') && v.name.toLowerCase().includes('uk') && v.lang === 'en-GB')
                );
            }
            if (chosenVoice) utterance.voice = chosenVoice;
            speechSynthesis.speak(utterance);
        };

        // Voices may load asynchronously on first call
        if (speechSynthesis.getVoices().length === 0) {
            speechSynthesis.addEventListener('voiceschanged', selectVoice, { once: true });
        } else {
            selectVoice();
        }
    }

    pause() {
        if (this.supported && speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.pause();
        }
    }

    resume() {
        if (this.supported && speechSynthesis.paused) {
            speechSynthesis.resume();
        }
    }

    stop() {
        if (this.supported) speechSynthesis.cancel();
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) this.stop();
        return this.enabled;
    }

    setEnabled(state) {
        this.enabled = state;
        if (!state) this.stop();
    }
}

// Singleton instance
const narrationManager = new NarrationManager();
