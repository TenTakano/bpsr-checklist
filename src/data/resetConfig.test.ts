import { describe, expect, it } from 'vitest'
import {
  getCurrentDailyPeriodStart,
  getCurrentWeeklyPeriodStart,
} from './resetConfig'

describe('getCurrentDailyPeriodStart', () => {
  it.each([
    {
      note: 'just before the reset instant',
      // 2026-02-01T19:59:00Z = 2026-02-02T04:59:00 JST (before 05:00)
      now: '2026-02-01T19:59:00.000Z',
      expected: '2026-01-31T20:00:00.000Z',
    },
    {
      note: 'exactly at the JST 05:00 boundary',
      // 2026-02-01T20:00:00Z = 2026-02-02T05:00:00 JST (exactly at the boundary)
      now: '2026-02-01T20:00:00.000Z',
      expected: '2026-02-01T20:00:00.000Z',
    },
    {
      note: 'just after the reset instant',
      now: '2026-02-01T20:00:01.000Z',
      expected: '2026-02-01T20:00:00.000Z',
    },
    {
      note: 'well into the day',
      // 2026-02-04T10:00:00Z = 2026-02-04T19:00:00 JST
      now: '2026-02-04T10:00:00.000Z',
      expected: '2026-02-03T20:00:00.000Z',
    },
  ])(
    'resolves the previous JST 05:00 boundary ($note)',
    ({ now, expected }) => {
      expect(getCurrentDailyPeriodStart(new Date(now))).toBe(expected)
    },
  )
})

describe('getCurrentWeeklyPeriodStart', () => {
  it.each([
    {
      note: "before this week's boundary",
      // 2026-02-01T19:59:00Z = 2026-02-02T04:59:00 JST (Monday, before 05:00)
      now: '2026-02-01T19:59:00.000Z',
      expected: '2026-01-25T20:00:00.000Z',
    },
    {
      note: 'exactly at the JST Monday 05:00 boundary',
      // 2026-02-01T20:00:00Z = 2026-02-02T05:00:00 JST (Monday, exactly at 05:00)
      now: '2026-02-01T20:00:00.000Z',
      expected: '2026-02-01T20:00:00.000Z',
    },
    {
      note: 'just after the weekly reset instant',
      now: '2026-02-01T20:00:01.000Z',
      expected: '2026-02-01T20:00:00.000Z',
    },
    {
      note: 'mid-week',
      // 2026-02-04T10:00:00Z = 2026-02-04T19:00:00 JST (Wednesday)
      now: '2026-02-04T10:00:00.000Z',
      expected: '2026-02-01T20:00:00.000Z',
    },
    {
      note: 'the full 6 days from a Sunday',
      // 2026-02-08T01:00:00Z = 2026-02-08T10:00:00 JST (Sunday)
      now: '2026-02-08T01:00:00.000Z',
      expected: '2026-02-01T20:00:00.000Z',
    },
  ])(
    'resolves the most recent JST Monday 05:00 boundary ($note)',
    ({ now, expected }) => {
      expect(getCurrentWeeklyPeriodStart(new Date(now))).toBe(expected)
    },
  )
})
