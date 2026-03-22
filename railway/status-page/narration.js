/**
 * Narration Manager - Voice narration using Web Speech API
 * Female voice, auto-narrates each attack phase
 */
class NarrationManager {
    constructor() {
        this.enabled = false;
        this.supported = 'speechSynthesis' in window;
        this.scripts = {
            'start': 'Alert detected. Ransomware identified on Primary Domain Controller. Firewall has logged anomalous outbound traffic patterns. Security Operations Center is responding. Endpoint Detection and Response agent has initiated containment procedures.',
            'spreading': 'The ransomware is now spreading laterally across the network. VPN gateway and Database server have been compromised. Active connections spiking to two hundred. This is a coordinated attack hitting multiple vectors simultaneously.',
            'encrypted': 'Critical situation. Five systems are now offline. Files have been encrypted with military-grade AES-256 encryption. Primary Domain Controller, Application Server, Database, Email Gateway, and VPN are down. Initiating failover to Secondary Domain Controller. Backup restoration sequence commencing.',
            'recovery': 'Recovery initiated. Restoring from immutable, air-gapped backups using the three-two-one-one-zero strategy. Secondary Domain Controller has assumed primary role. All systems coming back online. Database integrity verified. Application services restored. Incident contained successfully. Total downtime: forty-five seconds. Zero data loss.'
        };
    }

    speak(phase) {
        if (!this.enabled || !this.supported) return;

        const text = this.scripts[phase];
        if (!text) return;

        // Cancel any current speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        utterance.volume = 0.7;

        // Prefer a female voice
        const selectVoice = () => {
            const voices = speechSynthesis.getVoices();
            const femaleVoice = voices.find(v =>
                v.name.includes('Female') ||
                v.name.includes('Zira') ||
                v.name.includes('Samantha') ||
                v.name.includes('Karen') ||
                v.name.includes('Moira') ||
                v.name.includes('Tessa') ||
                (v.name.toLowerCase().includes('google') && v.name.toLowerCase().includes('uk') && v.lang === 'en-GB')
            );
            if (femaleVoice) utterance.voice = femaleVoice;
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
