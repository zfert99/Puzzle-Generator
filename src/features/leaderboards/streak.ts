/**
 * Pure streak computation over a set of UTC dates on which a user completed a daily.
 * Separated from the DB query so the (fiddly) consecutive-day logic is unit-testable
 * without a database or a clock.
 */

/** Subtract one UTC day from an ISO `YYYY-MM-DD` string, returning ISO. */
function previousDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The current streak: consecutive UTC days with a completed daily, ending today or
 * yesterday. Ending "yesterday" still counts as an active streak — today's puzzle may
 * just not be done yet — so the streak doesn't appear broken mid-morning. A gap before
 * today/yesterday ends it.
 *
 * @param completedDates ISO `YYYY-MM-DD` dates the user completed a daily (any order, may dup).
 * @param today ISO `YYYY-MM-DD` for the current UTC day.
 */
export function currentStreak(completedDates: string[], today: string): number {
  const done = new Set(completedDates);
  // Anchor at today if done, else yesterday (grace) — otherwise the streak is 0.
  let cursor: string;
  if (done.has(today)) cursor = today;
  else if (done.has(previousDay(today))) cursor = previousDay(today);
  else return 0;

  let streak = 0;
  while (done.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}
