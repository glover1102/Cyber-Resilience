// Sound effect manager
class SoundManager {
    constructor() {
        this.enabled = true;
        this.sounds = {
            alarmStart: this.createBeep([800, 1000], 0.3, 0.5),
            warning: this.createBeep([600, 800], 0.2, 0.3),
            critical: this.createBeep([400, 600], 0.4, 0.7),
            success: this.createChime([523, 659, 784], 0.3),
        };
    }

    createBeep(frequencies, duration, volume = 0.5) {
        return () => {
            if (!this.enabled) return;
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = frequencies[0];
                gainNode.gain.value = volume;

                oscillator.start();

                if (frequencies.length > 1) {
                    oscillator.frequency.exponentialRampToValueAtTime(
                        frequencies[1],
                        audioContext.currentTime + duration
                    );
                }

                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                oscillator.stop(audioContext.currentTime + duration);
            } catch (e) {
                console.warn('Sound playback failed:', e);
            }
        };
    }

    createChime(frequencies, duration) {
        return () => {
            if (!this.enabled) return;
            frequencies.forEach((freq, i) => {
                setTimeout(() => {
                    try {
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();

                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);

                        oscillator.frequency.value = freq;
                        oscillator.type = 'sine';
                        gainNode.gain.value = 0.3;

                        oscillator.start();
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                        oscillator.stop(audioContext.currentTime + duration);
                    } catch (e) {
                        console.warn('Sound playback failed:', e);
                    }
                }, i * 150);
            });
        };
    }

    play(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

const soundManager = new SoundManager();
