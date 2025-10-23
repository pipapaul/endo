function toDateValue(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function toTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function buildWeeklyReminderICS(nextSundayISO: string): string {
  const baseDate = new Date(`${nextSundayISO}T00:00:00Z`);
  if (Number.isNaN(baseDate.getTime())) {
    throw new Error("Ungültiges Datum für die Kalenderdatei.");
  }

  const startDateValue = toDateValue(baseDate);
  const endDate = new Date(baseDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const endDateValue = toDateValue(endDate);

  const stamp = toTimestamp(new Date());
  const uid = `endotrack-weekly-${nextSundayISO}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EndoTrack//Weekly Reminder//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    "SUMMARY:EndoTrack Check-in",
    "DESCRIPTION:Wöchentlicher Check-in mit EndoTrack.",
    `DTSTART;VALUE=DATE:${startDateValue}`,
    `DTEND;VALUE=DATE:${endDateValue}`,
    "RRULE:FREQ=WEEKLY;BYDAY=SU",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.join("\r\n")}\r\n`;
}
