import { describe, expect, it } from 'vitest'
import { UpstreamTasksDocumentSchema } from './taskSchema'

const buildDocument = (overrides: {
  daily?: Array<Record<string, unknown>>
  weekly?: Array<Record<string, unknown>>
}) => ({
  schemaVersion: 1,
  upstreamCommit: null,
  daily: overrides.daily ?? [
    {
      id: 'daily_a',
      label: 'Daily A',
      color: 'blue',
      maxProgress: 1,
      optional: false,
    },
  ],
  weekly: overrides.weekly ?? [
    {
      id: 'weekly_a',
      label: 'Weekly A',
      color: 'gold',
      maxProgress: 1,
      optional: false,
    },
  ],
})

describe('UpstreamTasksDocumentSchema availableWeekdays restriction', () => {
  it('accepts availableWeekdays on a daily entry', () => {
    const result = UpstreamTasksDocumentSchema.safeParse(
      buildDocument({
        daily: [
          {
            id: 'daily_a',
            label: 'Daily A',
            color: 'blue',
            maxProgress: 1,
            optional: false,
            availableWeekdays: [5, 6, 0],
          },
        ],
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects availableWeekdays on a weekly entry', () => {
    const result = UpstreamTasksDocumentSchema.safeParse(
      buildDocument({
        weekly: [
          {
            id: 'weekly_a',
            label: 'Weekly A',
            color: 'gold',
            maxProgress: 1,
            optional: false,
            availableWeekdays: [5],
          },
        ],
      }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          /availableWeekdays は daily のときのみ指定できます/.test(
            issue.message,
          ),
        ),
      ).toBe(true)
    }
  })
})
