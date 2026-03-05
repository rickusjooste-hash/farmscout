'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UseRfidScannerOptions {
  onScan: (tagNumber: string) => void
  enabled?: boolean
  maxInterKeystrokeMs?: number
  minLength?: number
}

/**
 * Detects USB OTG RFID keyboard-wedge scanners.
 *
 * HID scanners send rapid keystrokes (< 50ms between keys) followed by Enter.
 * This hook accumulates those digits and fires `onScan` with the tag number.
 * Skips detection when an <input> or <textarea> is focused so manual search still works.
 */
export function useRfidScanner({
  onScan,
  enabled = true,
  maxInterKeystrokeMs = 50,
  minLength = 4,
}: UseRfidScannerOptions) {
  const bufferRef = useRef('')
  const lastKeystrokeRef = useRef(0)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

    // Skip when an input/textarea is focused — let manual search work
    const tag = (document.activeElement?.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return

    const now = Date.now()
    const timeSinceLast = now - lastKeystrokeRef.current

    // If gap too long, reset buffer (human typing, not scanner)
    if (timeSinceLast > maxInterKeystrokeMs && bufferRef.current.length > 0) {
      bufferRef.current = ''
    }

    if (e.key === 'Enter') {
      if (bufferRef.current.length >= minLength) {
        e.preventDefault()
        onScan(bufferRef.current)
      }
      bufferRef.current = ''
      lastKeystrokeRef.current = 0
      return
    }

    // Only accumulate digits and hex chars (common in RFID tags)
    if (/^[0-9a-fA-F]$/.test(e.key)) {
      bufferRef.current += e.key
      lastKeystrokeRef.current = now
    } else {
      // Non-digit/hex key — reset (not a scanner)
      bufferRef.current = ''
      lastKeystrokeRef.current = 0
    }
  }, [enabled, maxInterKeystrokeMs, minLength, onScan])

  useEffect(() => {
    if (!enabled) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}
