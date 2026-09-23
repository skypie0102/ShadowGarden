/* Shadow Garden R2 — shared public navigation URL builders. */

export function seriesUrl(seriesId) {
  const id = String(seriesId || "").trim();
  return id ? `/series.html?id=${encodeURIComponent(id)}` : "/";
}

export function readerUrl(bookId, seriesId = "", { restart = false } = {}) {
  const book = String(bookId || "").trim();
  if (!book) return "#";
  const params = new URLSearchParams({ book });
  const series = String(seriesId || "").trim();
  if (series) params.set("series", series);
  if (restart) params.set("restart", "1");
  return `/reader.html?${params.toString()}`;
}

export function libraryUrl(adult = false) {
  return adult ? "/nsfw.html" : "/";
}

export function adultGateReturnUrl(path) {
  const target = String(path || "");
  return `/nsfw.html?return=${encodeURIComponent(target.startsWith("/") ? target : "/")}`;
}
