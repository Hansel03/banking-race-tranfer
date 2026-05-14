// Audio helpers usando Web Audio API

/**
 * Reproduce un sonido 8-bit simple
 */
function playSound(
  type: OscillatorType,
  frequency: number,
  durationMs: number,
  volume = 0.18,
) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationMs / 1000)

    osc.onended = () => ctx.close()
  } catch {
    // Silencioso si no hay permisos de audio
  }
}

/**
 * Sonido de moneda recolectada: onda sinusoidal, 880Hz, 80ms
 */
export function playCoin(): void {
  playSound('sine', 880, 80)
}

/**
 * Sonido de colisión/crash: onda cuadrada, 120Hz, 300ms
 */
export function playCrash(): void {
  playSound('square', 120, 300, 0.25)
}