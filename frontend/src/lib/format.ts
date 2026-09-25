export const BUSINESS_TIMEZONE = "America/Vancouver";

export function formatReportDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: BUSINESS_TIMEZONE,
  }).format(date);
}

const moneyFormatter = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const countFormatter = new Intl.NumberFormat("en-CA");

/** Formats a backend decimal string (e.g. "12345.67") for display. Intl formats the string exactly, no float parsing. */
export function formatMoney(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "—";
  return moneyFormatter.format(value as Intl.StringNumericLiteral);
}

export function formatCount(value: number | null | undefined): string {
  return value == null ? "—" : countFormatter.format(value);
}
