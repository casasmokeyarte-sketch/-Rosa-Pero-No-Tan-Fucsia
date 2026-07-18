// Web Audio API – generador de tonos sin archivos externos
export type ToneName =
  | 'Predeterminado'
  | 'Suave'
  | 'Agudo'
  | 'Triple'
  | 'Chime'
  | 'Pop'
  | 'Ping'
  | 'Silencio';

export const TONE_NAMES: ToneName[] = [
  'Predeterminado', 'Suave', 'Agudo', 'Triple', 'Chime', 'Pop', 'Ping', 'Silencio'
];

function beep(
  ctx: AudioContext,
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
  delay = 0
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + dur + 0.01);
}

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  return _ctx;
}

const TONES: Record<ToneName, (ctx: AudioContext) => void> = {
  Silencio:       () => {},
  Predeterminado: (c) => beep(c, 880, 0.12, 0.35),
  Suave:          (c) => beep(c, 520, 0.25, 0.2, 'sine'),
  Agudo:          (c) => { beep(c, 1200, 0.07, 0.4); beep(c, 1200, 0.07, 0.4, 'sine', 0.13); },
  Triple:         (c) => [0, 0.12, 0.24].forEach(t => beep(c, 880 + t * 800, 0.07, 0.3, 'sine', t)),
  Chime:          (c) => { beep(c, 1047, 0.18, 0.35, 'sine'); beep(c, 1319, 0.18, 0.35, 'sine', 0.22); },
  Pop:            (c) => beep(c, 380, 0.06, 0.5, 'triangle'),
  Ping:           (c) => beep(c, 1760, 0.06, 0.55)
};

export let hasInteracted = false;

export function playTone(tone: ToneName = 'Predeterminado') {
  if (tone === 'Silencio' || !hasInteracted) return;
  try {
    const ctx = getCtx();
    const run = () => TONES[tone]?.(ctx);
    if (ctx.state === 'suspended') ctx.resume().then(run);
    else run();
  } catch { /* silently ignore */ }
}

// Auto-resumen del AudioContext con la primera interacción del usuario en la página
if (typeof window !== 'undefined') {
  const initAudioOnGesture = () => {
    hasInteracted = true;
    try {
      if (!_ctx) {
        _ctx = new AudioContext();
      }
      if (_ctx && _ctx.state === 'suspended') {
        _ctx.resume();
      }
    } catch (e) {
      console.warn("Could not auto-resume audio context:", e);
    }
    window.removeEventListener('click', initAudioOnGesture);
    window.removeEventListener('keydown', initAudioOnGesture);
    window.removeEventListener('touchstart', initAudioOnGesture);
  };
  window.addEventListener('click', initAudioOnGesture);
  window.addEventListener('keydown', initAudioOnGesture);
  window.addEventListener('touchstart', initAudioOnGesture);
}
