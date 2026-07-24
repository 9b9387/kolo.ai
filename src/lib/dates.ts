// Calendar-date derivation. The server never guesses: local_date is always
// computed from an explicit instant + IANA timezone.

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    FORMATTERS.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Returns the calendar date (YYYY-MM-DD) of `instant` in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): string {
  return formatterFor(timeZone).format(instant); // en-CA → YYYY-MM-DD
}

/** Parses YYYY-MM-DD into a Date at UTC midnight (for @db.Date columns). */
export function dateColumn(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
