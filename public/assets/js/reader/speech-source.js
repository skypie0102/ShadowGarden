import { withSectionSource } from "./section-source.js";

const BLOCKS = "p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th,div";
const SKIP =
  'script,style,noscript,svg,math,rt,rp,nav,[hidden],[aria-hidden="true"],[role="doc-footnote"],[role="doc-endnote"],[role="doc-noteref"]';
export function splitSpeechText(value, limit = 1000) {
  let text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  const result = [];
  while (text.length > limit) {
    const window = text.slice(0, limit),
      sentences = [...window.matchAll(/[.!?。！？][”’"']?(?:\s|$)/g)];
    let end = sentences.at(-1)?.index;
    end =
      end != null && end > limit / 3
        ? end + sentences.at(-1)[0].length
        : window.lastIndexOf(" ");
    if (end < limit / 3) end = limit;
    if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    result.push(text.slice(0, end).trim());
    text = text.slice(end).trim();
  }
  if (text) result.push(text);
  return result;
}
export function speechPassages(document, section) {
  const root = document.body || document.documentElement,
    walker = document.createTreeWalker(root, 4);
  const groups = [];
  let current = null,
    node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!node.nodeValue || parent?.closest(SKIP)) continue;
    let excluded = false;
    for (
      let ancestor = parent;
      ancestor && ancestor !== root.parentElement;
      ancestor = ancestor.parentElement
    ) {
      if (
        /\b(?:footnote|endnote|noteref)\b/.test(
          ancestor.getAttribute("epub:type") || "",
        ) ||
        /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(
          ancestor.getAttribute("style") || "",
        )
      ) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    const block = parent?.closest(BLOCKS) || root;
    if (!current || current.block !== block) {
      current = { block, nodes: [] };
      groups.push(current);
    }
    current.nodes.push(node);
  }
  return groups.flatMap(({ nodes }) => {
    const range = document.createRange();
    range.setStart(nodes[0], 0);
    range.setEnd(nodes.at(-1), nodes.at(-1).nodeValue.length);
    let cfi;
    try {
      cfi = section.cfiFromRange(range);
    } catch {
      return [];
    }
    // Do not read ruby pronunciation, hidden notes or illustration alt text.
    return splitSpeechText(nodes.map((n) => n.nodeValue).join("")).map(
      (text) => ({ text, cfi }),
    );
  });
}
export function createSpeechSource({ getBook, getCfi, getSpineIndex }) {
  async function chapter(index, { fromCfi = "", direction = 1, signal } = {}) {
    const book = getBook(),
      items = book?.spine?.spineItems || [];
    for (let i = index; i >= 0 && i < items.length; i += direction) {
      signal?.throwIfAborted();
      const section = items[i];
      if (section.linear === "no") continue;
      const entries = await withSectionSource(
        section,
        book.load.bind(book),
        (doc) => speechPassages(doc, section),
      );
      signal?.throwIfAborted();
      if (!entries.length) continue;
      let position = direction < 0 ? entries.length - 1 : 0;
      const cfi = book.epubcfi || book.locations?.epubcfi;
      if (i === index && fromCfi && cfi?.compare) {
        for (let p = 0; p < entries.length; p++) {
          try {
            if (cfi.compare(entries[p].cfi, fromCfi) <= 0) position = p;
            else break;
          } catch {
            break;
          }
        }
        // Chunks from one long paragraph share its anchor; start at its first chunk.
        while (
          position > 0 &&
          entries[position - 1].cfi === entries[position].cfi
        )
          position--;
      }
      return { entries, index: position, spineIndex: i };
    }
    return null;
  }
  return {
    current: ({ signal } = {}) =>
      chapter(Number(getSpineIndex()) || 0, { fromCfi: getCfi(), signal }),
    async move(cursor, direction, { signal } = {}) {
      const index = cursor.index + direction;
      if (index >= 0 && index < cursor.entries.length)
        return { ...cursor, index };
      return chapter(cursor.spineIndex + direction, { direction, signal });
    },
  };
}
