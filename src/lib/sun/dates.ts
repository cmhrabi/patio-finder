/**
 * Toronto-local calendar-day helpers for the sun pipeline. Shared by the
 * sun-batch trigger route and the sun-batch workflow steps so date math lives
 * in exactly one place. All functions re-format through the Toronto timezone,
 * so DST transitions can't shift the window.
 */

export const TZ = 'America/Toronto'
export const LOOKAHEAD_DAYS = 7

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** "YYYY-MM-DD" for the Toronto-local calendar day containing `d`. */
export function torontoYmd(d: Date): string {
  return dateFmt.format(d)
}

/**
 * Build a Date at noon-ish on the given Toronto-local YYYY-MM-DD. SunCalc only
 * needs *any* timestamp inside the local day to derive sunrise/sunset; 16:00 UTC
 * is comfortably mid-day in Toronto across both EDT and EST.
 */
export function noonishUtcForYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 16))
}

/** Return Toronto-local YMDs for [today, today+LOOKAHEAD_DAYS-1]. */
export function lookaheadYmds(now: Date): string[] {
  const todayYmd = torontoYmd(now)
  const out: string[] = [todayYmd]
  // Walk forward by stepping 24 h from a noon-ish UTC anchor — DST transitions
  // can't break this because we re-format through the Toronto TZ each step.
  let cursor = noonishUtcForYmd(todayYmd)
  for (let i = 1; i < LOOKAHEAD_DAYS; i++) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    out.push(torontoYmd(cursor))
  }
  return out
}

/** Toronto-local YMD for the day before today. DST-safe (re-formatted via TZ). */
export function yesterdayYmd(now: Date): string {
  const anchor = noonishUtcForYmd(torontoYmd(now))
  return torontoYmd(new Date(anchor.getTime() - 24 * 60 * 60 * 1000))
}
