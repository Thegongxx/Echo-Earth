let context: AudioContext | undefined;
let active: OscillatorNode[] = [];
let generation = 0;
export function stopTone() {
  generation++;
  for (const o of active) {
    o.onended = null;
    try {
      o.stop();
      o.disconnect();
    } catch {
      /* 已结束 */
    }
  }
  active = [];
}
export async function playDemoTone(onEnd: () => void) {
  stopTone();
  const currentGeneration = generation;
  context ??= new AudioContext();
  await context.resume();
  if (currentGeneration !== generation) return 0;
  const ctx = context;
  const notes = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66];
  for (let i = 0; i < notes.length; i++) {
    const o = ctx.createOscillator();
    const gain = ctx.createGain();
    o.type = "sine";
    o.frequency.value = notes[i];
    const start = ctx.currentTime + i * 0.65;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.11, start + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1);
    o.connect(gain);
    gain.connect(ctx.destination);
    o.start(start);
    o.stop(start + 1.15);
    active.push(o);
    o.onended = () => {
      o.disconnect();
      gain.disconnect();
      if (i === notes.length - 1 && generation === currentGeneration) {
        active = [];
        onEnd();
      }
    };
  }
  return 5.7;
}
