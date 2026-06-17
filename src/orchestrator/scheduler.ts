/**
 * Scheduling utilities for determining when calls can be placed.
 * All time calculations respect the prospect's local timezone.
 */

/**
 * Check if it's currently a callable time in the given timezone.
 * Calls allowed: Monday-Friday 8:00 AM - 6:00 PM local time.
 * Saturdays: only if explicitly allowed. No Sundays.
 */
export function isCallableTime(timezone: string, allowSaturday = false): boolean {
  try {
    const now = new Date();
    const localString = now.toLocaleString('en-US', { timeZone: timezone });
    const localDate = new Date(localString);

    const day = localDate.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = localDate.getHours();
    const minute = localDate.getMinutes();
    const timeDecimal = hour + minute / 60;

    // No Sundays ever
    if (day === 0) return false;

    // Saturday only if explicitly allowed
    if (day === 6 && !allowSaturday) return false;

    // 8:00 AM to 6:00 PM
    return timeDecimal >= 8 && timeDecimal < 18;
  } catch {
    // If timezone is invalid, default to allowing the call
    return true;
  }
}

/**
 * Return the next valid call window start time in the given timezone.
 */
export function getNextCallableTime(timezone: string): Date {
  const now = new Date();

  // Try each 15-minute increment up to 14 days out
  for (let offsetMin = 0; offsetMin < 14 * 24 * 60; offsetMin += 15) {
    const candidate = new Date(now.getTime() + offsetMin * 60 * 1000);

    try {
      const localString = candidate.toLocaleString('en-US', { timeZone: timezone });
      const localDate = new Date(localString);

      const day = localDate.getDay();
      const hour = localDate.getHours();
      const minute = localDate.getMinutes();

      // Skip weekends
      if (day === 0 || day === 6) continue;

      // Must be between 8:00 AM and 6:00 PM
      if (hour >= 8 && hour < 18) {
        return candidate;
      }
    } catch {
      // If timezone parsing fails, just return the candidate
      return candidate;
    }
  }

  // Fallback: return now + 24 hours
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Get the best calling windows in a given timezone.
 * Primary: early morning (7:00-8:00 AM) — catch them before the day gets busy.
 * Secondary: late afternoon (4:30-5:30 PM) — catch them wrapping up.
 */
export function getBestCallTime(_timezone: string): { primary: string; secondary: string } {
  return {
    primary: '7:00-8:00 AM',
    secondary: '4:30-5:30 PM',
  };
}
