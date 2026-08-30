import { describe, expect, it } from 'vitest'
import {
  CustomTaskSchema,
  MAX_CUSTOM_TASK_MAX_PROGRESS,
  MAX_CUSTOM_TASK_NAME_LENGTH,
  MIN_CUSTOM_TASK_MAX_PROGRESS,
} from './customTaskSchema'

const VALID_CUSTOM_TASK = {
  id: 'custom_1234',
  name: 'ギルドクエスト',
  color: 'blue',
  maxProgress: 3,
  category: 'daily',
} as const

describe('CustomTaskSchema', () => {
  it('accepts a valid custom task', () => {
    expect(CustomTaskSchema.safeParse(VALID_CUSTOM_TASK).success).toBe(true)
  })

  it.each([
    ['daily', true],
    ['weekly', true],
    ['milestone', true],
    ['not_a_category', false],
  ] as const)('category %s is valid: %s', (category, expected) => {
    const result = CustomTaskSchema.safeParse({
      ...VALID_CUSTOM_TASK,
      category,
    })
    expect(result.success).toBe(expected)
  })

  it.each([
    ['blue', true],
    ['dark_purple', true],
    ['not_a_real_token', false],
  ] as const)('color %s is valid: %s', (color, expected) => {
    const result = CustomTaskSchema.safeParse({
      ...VALID_CUSTOM_TASK,
      color,
    })
    expect(result.success).toBe(expected)
  })

  it.each([
    ['custom_ok', true],
    ['Custom_Bad', false],
    ['custom-hyphen', false],
    ['__proto__', false],
    ['constructor', false],
    ['prototype', false],
    ['daily_a', false],
    ['weekly_a', false],
    ['custom', false],
  ] as const)('id %s is valid: %s', (id, expected) => {
    const result = CustomTaskSchema.safeParse({ ...VALID_CUSTOM_TASK, id })
    expect(result.success).toBe(expected)
  })

  it('rejects an empty name', () => {
    const result = CustomTaskSchema.safeParse({
      ...VALID_CUSTOM_TASK,
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it(`accepts a name exactly ${MAX_CUSTOM_TASK_NAME_LENGTH} characters long`, () => {
    const result = CustomTaskSchema.safeParse({
      ...VALID_CUSTOM_TASK,
      name: 'a'.repeat(MAX_CUSTOM_TASK_NAME_LENGTH),
    })
    expect(result.success).toBe(true)
  })

  it(`rejects a name longer than ${MAX_CUSTOM_TASK_NAME_LENGTH} characters`, () => {
    const result = CustomTaskSchema.safeParse({
      ...VALID_CUSTOM_TASK,
      name: 'a'.repeat(MAX_CUSTOM_TASK_NAME_LENGTH + 1),
    })
    expect(result.success).toBe(false)
  })

  it.each([
    [MIN_CUSTOM_TASK_MAX_PROGRESS - 1, false],
    [MIN_CUSTOM_TASK_MAX_PROGRESS, true],
    [MAX_CUSTOM_TASK_MAX_PROGRESS, true],
    [MAX_CUSTOM_TASK_MAX_PROGRESS + 1, false],
    [1.5, false],
  ] as const)('maxProgress %s is valid: %s', (maxProgress, expected) => {
    const result = CustomTaskSchema.safeParse({
      ...VALID_CUSTOM_TASK,
      maxProgress,
    })
    expect(result.success).toBe(expected)
  })

  it('rejects unknown extra fields (strictObject)', () => {
    const result = CustomTaskSchema.safeParse({
      ...VALID_CUSTOM_TASK,
      label: 'unexpected',
    })
    expect(result.success).toBe(false)
  })
})
