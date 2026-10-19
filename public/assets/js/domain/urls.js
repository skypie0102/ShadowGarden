/* Shadow Garden R2 — shared public navigation URL builders. */

function scopeSuffix(seriesId,adult){
  return typeof adult==='boolean'&&adult!==String(seriesId).startsWith("adult-")?`&scope=${adult?"adult":"main"}`:"";
}

export function seriesUrl(seriesId,{adult}={}) {
  const id = String(seriesId || "").trim();
  return id ? `/series.html?id=${encodeURIComponent(id)}${scopeSuffix(id,adult)}` : "/";
}

export function readerUrl(bookId, seriesId = "", { restart = false,adult } = {}) {
  const book = String(bookId || "").trim();
  if (!book) return "#";
  const params = new URLSearchParams({ book });
  const series = String(seriesId || "").trim();
  if (series) params.set("series", series);
  if (restart) params.set("restart", "1");
  if(scopeSuffix(series,adult))params.set("scope",adult?"adult":"main");
  return `/reader.html?${params.toString()}`;
}

export function libraryUrl(adult = false) {
  return adult ? "/nsfw.html" : "/";
}

export function adultGateReturnUrl(path) {
  const target = String(path || "");
  return `/nsfw.html?return=${encodeURIComponent(target.startsWith("/") ? target : "/")}`;
}
