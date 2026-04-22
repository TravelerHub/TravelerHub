import { describe, it, expect, vi, beforeEach } from 'vitest'
import { haptic } from '../utils/haptic'

describe('haptic()', () => {
  beforeEach(() => {
    // Reset vibrate to a fresh spy before each test
    navigator.vibrate = vi.fn()
  })

  it('calls navigator.vibrate with a number for the default (light) pattern', () => {
    haptic()
    expect(navigator.vibrate).toHaveBeenCalledWith(30)
  })

  it('calls navigator.vibrate with 30 for the "light" pattern', () => {
    haptic('light')
    expect(navigator.vibrate).toHaveBeenCalledWith(30)
  })

  it('calls navigator.vibrate with 60 for the "medium" pattern', () => {
    haptic('medium')
    expect(navigator.vibrate).toHaveBeenCalledWith(60)
  })

  it('calls navigator.vibrate with 100 for the "heavy" pattern', () => {
    haptic('heavy')
    expect(navigator.vibrate).toHaveBeenCalledWith(100)
  })

  it('calls navigator.vibrate with [30, 50, 30] for the "success" pattern', () => {
    haptic('success')
    expect(navigator.vibrate).toHaveBeenCalledWith([30, 50, 30])
  })

  it('does not throw when navigator.vibrate is undefined', () => {
    navigator.vibrate = undefined
    expect(() => haptic('light')).not.toThrow()
  })
})
