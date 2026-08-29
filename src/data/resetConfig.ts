import type { ResetCycle } from './resetCycle'

// JST 5:00 / Monday 5:00 is an unverified placeholder, not a confirmed
// Japan-server value (see Issue #7).
const DAILY_RESET_HOUR_JST = 5
const WEEKLY_RESET_HOUR_JST = 5
// Matches the weekday numbering of Date.getUTCDay() (0=Sunday, 1=Monday, ..., 6=Saturday)
const WEEKLY_RESET_WEEKDAY_JST = 1

const JST_OFFSET_MINUTES = 9 * 60

const toJstShifted = (date: Date): Date =>
  new Date(date.getTime() + JST_OFFSET_MINUTES * 60_000)

const fromJstShifted = (jstShifted: Date): Date =>
  new Date(jstShifted.getTime() - JST_OFFSET_MINUTES * 60_000)

const mostRecentJstHourInstant = (now: Date, hourJst: number): Date => {
  const shifted = toJstShifted(now)
  const candidate = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      hourJst,
    ),
  )
  if (candidate.getTime() > shifted.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() - 1)
  }
  return candidate
}

export const getCurrentDailyPeriodStart = (now: Date): string =>
  fromJstShifted(
    mostRecentJstHourInstant(now, DAILY_RESET_HOUR_JST),
  ).toISOString()

export const getCurrentWeeklyPeriodStart = (now: Date): string => {
  const shiftedStart = mostRecentJstHourInstant(now, WEEKLY_RESET_HOUR_JST)
  while (shiftedStart.getUTCDay() !== WEEKLY_RESET_WEEKDAY_JST) {
    shiftedStart.setUTCDate(shiftedStart.getUTCDate() - 1)
  }
  return fromJstShifted(shiftedStart).toISOString()
}

// Adding a cycle (e.g. biweekly) will likely need extra parameters such as
// an epoch anchor, which would require redesigning this signature (now
// only) itself (to be settled in #108).
export const PERIOD_START_RESOLVERS: Record<ResetCycle, (now: Date) => string> =
  {
    daily: getCurrentDailyPeriodStart,
    weekly: getCurrentWeeklyPeriodStart,
  }
