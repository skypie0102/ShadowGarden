// Public summaries describe the saved record without inferring a percentage
// from device-specific page counts or treating missing values as zero.
function finiteNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function readingProgressSummary(progress) {
  const rawPercentage = finiteNumber(progress?.percentage);
  const fraction = rawPercentage === null ? null : Math.min(1, Math.max(0, rawPercentage));
  const percent = fraction === null ? null : Math.round(fraction * 100);
  const rawPage = finiteNumber(progress?.page), rawTotal = finiteNumber(progress?.totalPages);
  const page = rawPage !== null && rawPage >= 1 ? Math.trunc(rawPage) : null;
  const total = rawTotal !== null && rawTotal >= 1 ? Math.trunc(rawTotal) : null;
  const totalPages = page !== null && total !== null && total >= page ? total : null;
  const chapter = typeof progress?.chapter === "string" ? progress.chapter.trim().replace(/\s+/g, " ") : "";
  const parts = [
    percent === null ? "" : `${percent}% complete`,
    page === null ? "" : `Saved page ${page}${totalPages === null ? "" : ` of ${totalPages}`}`,
    chapter
  ].filter(Boolean);
  return { text: parts.join(" · ") || "Saved reading position", percent, fraction, page, totalPages, chapter };
}
