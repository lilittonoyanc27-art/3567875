let audioCtx: AudioContext | null = null;
let musicInterval: number | null = null;
let musicStep = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.12,
  delay = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playCorrectSound(enabled: boolean): void {
  if (!enabled) return;
  playTone(523.25, 0.12, 'triangle', 0.14, 0);
  playTone(659.25, 0.12, 'triangle', 0.14, 0.08);
  playTone(783.99, 0.22, 'triangle', 0.16, 0.16);
}

export function playStreakSound(enabled: boolean): void {
  if (!enabled) return;
  playTone(523.25, 0.1, 'triangle', 0.14, 0);
  playTone(659.25, 0.1, 'triangle', 0.14, 0.07);
  playTone(783.99, 0.12, 'triangle', 0.16, 0.14);
  playTone(1046.5, 0.3, 'sine', 0.18, 0.21);
}

export function playWrongSound(enabled: boolean): void {
  if (!enabled) return;
  playTone(220, 0.16, 'sawtooth', 0.08, 0);
  playTone(174.61, 0.24, 'sawtooth', 0.08, 0.12);
}

export function playTickSound(enabled: boolean): void {
  if (!enabled) return;
  playTone(880, 0.04, 'sine', 0.05, 0);
}

export function playVictorySound(enabled: boolean): void {
  if (!enabled) return;
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  const delays = [0, 0.1, 0.2, 0.32, 0.48, 0.6];
  notes.forEach((n, idx) => {
    playTone(n, idx === notes.length - 1 ? 0.45 : 0.16, 'triangle', 0.16, delays[idx]);
  });
}

const MELODY_NOTES = [261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 349.23];

export function syncBackgroundMusic(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (!enabled) {
    if (musicInterval !== null) {
      window.clearInterval(musicInterval);
      musicInterval = null;
    }
    return;
  }
  if (musicInterval !== null) return;

  musicInterval = window.setInterval(() => {
    const freq = MELODY_NOTES[musicStep % MELODY_NOTES.length];
    playTone(freq, 0.35, 'sine', 0.025, 0);
    musicStep += 1;
  }, 520);
}

export function stopBackgroundMusic(): void {
  if (typeof window === 'undefined') return;
  if (musicInterval !== null) {
    window.clearInterval(musicInterval);
    musicInterval = null;
  }
}

export function speakSpanish(
  text: string,
  enabled = true,
  onEnd?: () => void
): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }
  const cleanText = text.replace(/_{2,}/g, 'espacio');
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const voices = window.speechSynthesis.getVoices();
  const esEsVoice =
    voices.find((v) => v.lang.toLowerCase() === 'es-es') ||
    voices.find((v) => v.lang.toLowerCase().startsWith('es-')) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('es'));

  if (esEsVoice) {
    utterance.voice = esEsVoice;
  }
  utterance.lang = esEsVoice?.lang || 'es-ES';
  utterance.rate = 0.94;
  utterance.pitch = 1.02;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
