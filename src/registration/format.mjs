// One date style everywhere the office reads a date: "1 Oct 2026" and "1 Oct 2026 at 17:20".
const DATE = { day: "numeric", month: "short", year: "numeric" };
export const shortDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB", DATE) : "");
export const shortDateTime = (value) =>
  value ? `${shortDate(value)} at ${new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "";
// Dates of birth and list dates read as words: "2 January 2000". Accepts ISO or dd/mm/yyyy.
export function longDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : text;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? text : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
