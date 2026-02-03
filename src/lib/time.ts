export function isoNowInTimeZone(timeZone: string) {
  return isoInTimeZone(new Date(), timeZone);
}

export function isoInTimeZone(date: Date, timeZone: string) {
  // Build an ISO-like timestamp with an explicit offset for the given IANA timezone.
  // Example: 2026-02-03T13:45:12-08:00
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "shortOffset"
    });
  } catch {
    return date.toISOString();
  }

  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const hour = part("hour");
  const minute = part("minute");
  const second = part("second");

  const tzName = part("timeZoneName"); // e.g. "GMT-8"
  const offset = gmtOffsetToIso(tzName);

  if (!year || !month || !day || !hour || !minute || !second || !offset) {
    return date.toISOString();
  }

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

function gmtOffsetToIso(tzName: string | undefined): string | undefined {
  if (!tzName) return undefined;
  if (tzName === "GMT") return "Z";
  const m = tzName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return undefined;
  const sign = m[1];
  const hours = m[2].padStart(2, "0");
  const minutes = (m[3] ?? "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}
