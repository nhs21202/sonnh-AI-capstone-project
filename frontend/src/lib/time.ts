import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format } from "date-fns";

// A datetime-local value ("2026-07-05T23:59") interpreted in the store's timezone -> absolute UTC ISO.
export function storeLocalToUTC(localValue: string, timeZone: string): string {
  return fromZonedTime(localValue, timeZone).toISOString();
}

// Absolute UTC ISO -> datetime-local value in the store's timezone (for the form input).
export function utcToStoreLocal(utcISO: string, timeZone: string): string {
  const zoned = toZonedTime(new Date(utcISO), timeZone);
  return format(zoned, "yyyy-MM-dd'T'HH:mm");
}
