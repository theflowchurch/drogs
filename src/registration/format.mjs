// One date style everywhere the office reads a date: "1 Oct 2026" and "1 Oct 2026 at 17:20".
const DATE = { day: "numeric", month: "short", year: "numeric" };
export const shortDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB", DATE) : "");
export const shortDateTime = (value) =>
  value ? `${shortDate(value)} at ${new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "";
