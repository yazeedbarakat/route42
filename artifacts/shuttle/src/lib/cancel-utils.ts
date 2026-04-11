const CANCEL_WINDOW_MINUTES = 15;

/**
 * Parse a trip's Jordan-local date + departureTime into a UTC millisecond timestamp.
 * date is "YYYY-MM-DD", departureTime is "H:MM AM/PM" (Jordan local).
 */
export function departureToUtcMs(dateStr: string, departureTimeStr: string): number {
  const match = departureTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return NaN;

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;

  // Determine Jordan's UTC offset on the trip date using noon-UTC as reference
  const [year, mo, day] = dateStr.split("-").map(Number);
  const refDate = new Date(Date.UTC(year, mo - 1, day, 12, 0, 0));

  const jordanNoonHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Amman",
      hour: "numeric",
      hour12: false,
    }).format(refDate),
    10,
  );

  const jordanOffsetHours = jordanNoonHour - 12; // e.g. 2 for UTC+2, 3 for UTC+3

  const utcH = h - jordanOffsetHours;
  return Date.UTC(year, mo - 1, day, utcH, m, 0);
}

/**
 * Returns true if the trip can still be cancelled (≥ 15 min before departure).
 */
export function canCancelBooking(trip: { date: string; departureTime: string }): boolean {
  const nowMs = Date.now();
  const departureMs = departureToUtcMs(trip.date, trip.departureTime);
  if (isNaN(departureMs)) return true; // fail open
  return (departureMs - nowMs) / 60_000 >= CANCEL_WINDOW_MINUTES;
}

/**
 * Returns how many minutes remain before the cancellation window closes.
 * Negative means window has already closed.
 */
export function minutesUntilDeparture(trip: { date: string; departureTime: string }): number {
  const departureMs = departureToUtcMs(trip.date, trip.departureTime);
  if (isNaN(departureMs)) return Infinity;
  return (departureMs - Date.now()) / 60_000;
}
