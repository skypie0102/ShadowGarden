/* Shadow Garden R2 — shared browser formatting helpers. */

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

export function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return "";
  let amount = bytes, unit = 0;
  const units = ["B", "KB", "MB", "GB"];
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

export function formatDate(value) {
  const time = Date.parse(value || "") || 0;
  if (!time) return "Date unknown";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(time));
  } catch {
    return String(value || "");
  }
}
