import { describe, expect, it } from 'vitest'
import { expandPlainMediaLinesToHtml, sanitizeProductHtml } from './sanitizeProductHtml'

describe('expandPlainMediaLinesToHtml', () => {
  it('wraps a lone mp4 line as video', () => {
    const u = 'https://ik.imagekit.io/vaultcare/video/VC048-s1.mp4?updatedAt=1'
    const out = expandPlainMediaLinesToHtml(u)
    expect(out).toContain('<video')
    expect(out).toContain('src="https://ik.imagekit.io/vaultcare/video/VC048-s1.mp4?updatedAt=1"')
    expect(out).toContain('controls')
  })

  it('does not modify content that already has HTML tags', () => {
    const raw = '<p>hello</p>'
    expect(expandPlainMediaLinesToHtml(raw)).toBe(raw)
  })

  it('maps multiple lines: video then image', () => {
    const a = 'https://cdn.example.com/a.mp4'
    const b = 'https://cdn.example.com/b.webp'
    const out = expandPlainMediaLinesToHtml(`${a}\n${b}`)
    expect(out).toContain('<video')
    expect(out).toContain('<img')
    expect(out).toContain('b.webp')
  })
})

describe('sanitizeProductHtml', () => {
  it('renders plain mp4 URL as video after expand + sanitize', () => {
    const u = 'https://ik.imagekit.io/vaultcare/video/x.mp4'
    const safe = sanitizeProductHtml(u)
    expect(safe).toMatch(/<video[^>]*>/i)
    expect(safe).toContain('ik.imagekit.io')
  })
})
