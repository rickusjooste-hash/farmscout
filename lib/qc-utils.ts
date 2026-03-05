import type { QcSizeBin } from './qc-db'

// ── Audio feedback ─────────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null

export function beep() {
  try {
    if (!_audioCtx || _audioCtx.state === 'closed') _audioCtx = new AudioContext()
    const ctx = _audioCtx
    const play = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 1800
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    }
    ctx.state === 'suspended' ? ctx.resume().then(play).catch(() => {}) : play()
  } catch { }
}

// ── Time formatting ────────────────────────────────────────────────────────

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

// ── Size bin lookup ────────────────────────────────────────────────────────

export function findSizeBin(weightG: number, bins: QcSizeBin[]): QcSizeBin | null {
  return bins.find(b => weightG >= b.weight_min_g && weightG <= b.weight_max_g) ?? null
}

// ── UUID helper ────────────────────────────────────────────────────────────

export function generateUUID(): string {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
