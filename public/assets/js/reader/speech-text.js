// Clean only the synthesis copy. Publication text and CFI/range offsets stay
// untouched, including when an ornament appears inside a readable paragraph.
export function prepareSpeechText(value) {
  if (typeof value !== "string") return "";
  const text = value
    // XML 1.0 excludes these controls, lone surrogates and U+FFFE/U+FFFF.
    // Unicode mode preserves valid supplementary letters and surrogate pairs.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/gu, " ")
    .replace(/[\u00ad\u200b\u2060\ufeff]/gu, "")
    .replace(/[❦❧☙⁂⁑⁕※✦✧★☆][\ufe0e\ufe0f]?/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  // Scene breaks, punctuation and emoji alone can yield no provider audio.
  // Keep letters/numbers from every script, plus their meaningful punctuation,
  // units, currency and mathematical symbols when part of readable prose.
  return /[\p{L}\p{N}]/u.test(text) ? text : "";
}
