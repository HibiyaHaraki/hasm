// [REQ-04-RULE-021] [REQ-04-RULE-025] Format ticket and graph occurrence values without changing stored dates.
export function formatOccurrence(value, language, t, compact = false) {
  if (!value) return t("Not set");
  const locale = language === "ja" ? "ja-JP" : "en-US";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return value;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: compact ? "numeric" : "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: compact ? "numeric" : "long",
    day: "numeric",
    hour: compact ? "2-digit" : "numeric",
    minute: "2-digit",
    ...(compact ? { hourCycle: "h23" } : { timeZoneName: "short" }),
  }).format(date);
}
