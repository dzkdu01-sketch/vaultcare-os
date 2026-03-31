import '@testing-library/jest-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
})

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})
