// Section identity ignores query/fragment suffixes before decoding once. This
// compares publication paths; it does not resolve relative links or iframe URLs.
export function cleanSectionHref(value) {
  let href = String(value || "").split("#")[0].split("?")[0];
  try { href = decodeURIComponent(href); } catch {}
  return href.replace(/^\.\//, "").replace(/^\//, "");
}

export function sectionHrefMatches(a, b) {
  const left = cleanSectionHref(a), right = cleanSectionHref(b);
  if (!left || !right) return false;
  return left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
}

// Preserve publication order and section objects. EPUBs with no linear entries
// retain their href-bearing spine as the existing navigation fallback.
export function linearSpineItems(book) {
  const raw = book?.spine?.spineItems || [];
  const linear = raw.filter(item => item?.href && item.linear !== "no");
  return linear.length ? linear : raw.filter(item => item?.href);
}
