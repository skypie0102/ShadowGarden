/* Offline EPUB search uses its own book instance so it cannot unload the visible reader's sections. */
(function () {
  'use strict';
  const MAX_QUERY = 128;
  const MAX_RESULTS = 100;
  const MAX_SECTIONS = 1000;
  const MAX_SECTION_BYTES = 4 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
  const MAX_TEXT_PER_NODE = 256 * 1024;
  const MAX_NODES = 100000;

  window.createOfflineBookSearch = function (bytes) {
    let serial = 0;
    let queue = Promise.resolve();
    let searchBookPromise = null;

    function getBook() {
      if (!searchBookPromise) {
        const candidate = ePub(bytes);
        searchBookPromise = candidate.ready.then(function () { return candidate; }).catch(function (error) {
          searchBookPromise = null;
          throw error;
        });
      }
      return searchBookPromise;
    }

    // EPUB.js resolves archived section URLs the same way. Never inflate an
    // entry without a known, bounded declared size.
    function declaredSize(book, section) {
      try {
        if (!book.archive || !book.archive.zip || typeof section.url !== 'string' || section.url.charAt(0) !== '/') return null;
        const path = decodeURIComponent(section.url.slice(1));
        const entry = book.archive.zip.file(path);
        const size = entry && entry._data && entry._data.uncompressedSize;
        return Number.isSafeInteger(size) && size >= 0 ? size : null;
      } catch (_) { return null; }
    }

    function excluded(node) {
      let parent = node.parentElement;
      let depth = 0;
      while (parent && depth++ < 128) {
        if (/^(script|style|noscript|svg)$/i.test(parent.localName || parent.tagName || '')) return 1;
        parent = parent.parentElement;
      }
      return parent ? 2 : 0;
    }

    function excerpt(text, index, length) {
      const start = Math.max(0, index - 70);
      const end = Math.min(text.length, index + length + 70);
      return (start ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
    }

    async function searchSections(query, token, onProgress) {
      const result = { hits: [], limited: false, skipped: false, cancelled: false };
      const book = await getBook();
      if (token !== serial) { result.cancelled = true; return result; }
      const sections = book.spine && book.spine.spineItems;
      if (!Array.isArray(sections) || !sections.length) throw new Error('Search unavailable');
      const pattern = new RegExp(query.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&'), 'gi');
      let totalBytes = 0;
      let nodes = 0;
      const total = Math.min(sections.length, MAX_SECTIONS);
      if (sections.length > total) result.limited = true;
      for (let index = 0; index < total; index++) {
        if (token !== serial) { result.cancelled = true; return result; }
        const section = sections[index];
        const size = declaredSize(book, section);
        if (size === null || size > MAX_SECTION_BYTES) { result.skipped = true; continue; }
        if (size > MAX_TOTAL_BYTES - totalBytes) { result.limited = true; break; }
        totalBytes += size;
        if (onProgress) onProgress(index + 1, total);
        try {
          await section.load(book.load.bind(book));
          if (token !== serial) { result.cancelled = true; return result; }
          const doc = section.document;
          const root = doc && (doc.body || doc.documentElement);
          if (!root || typeof doc.createTreeWalker !== 'function') { result.skipped = true; continue; }
          const walker = doc.createTreeWalker(root, 4, null, false);
          let node;
          while ((node = walker.nextNode())) {
            if (token !== serial) { result.cancelled = true; return result; }
            if (++nodes > MAX_NODES) { result.limited = true; break; }
            if (nodes % 128 === 0) {
              await new Promise(function (resolve) { setTimeout(resolve, 0); });
              if (token !== serial) { result.cancelled = true; return result; }
            }
            if (!node.nodeValue) continue;
            const exclusion = excluded(node);
            if (exclusion) { if (exclusion === 2) result.skipped = true; continue; }
            let text = node.nodeValue;
            if (text.length > MAX_TEXT_PER_NODE) { text = text.slice(0, MAX_TEXT_PER_NODE); result.limited = true; }
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text))) {
              try {
                const range = doc.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                const cfi = section.cfiFromRange(range);
                if (typeof cfi === 'string' && cfi.length <= 65536 && cfi.indexOf('epubcfi(') === 0) {
                  result.hits.push({ cfi: cfi, section: index + 1, excerpt: excerpt(text, match.index, match[0].length) });
                } else result.skipped = true;
              } catch (_) { result.skipped = true; }
              if (result.hits.length >= MAX_RESULTS) { result.limited = true; break; }
            }
            if (result.hits.length >= MAX_RESULTS) break;
          }
        } catch (_) { result.skipped = true; }
        finally { try { section.unload(); } catch (_) { result.skipped = true; } }
        if (nodes > MAX_NODES || result.hits.length >= MAX_RESULTS) break;
        await new Promise(function (resolve) { setTimeout(resolve, 0); });
      }
      if (token !== serial) result.cancelled = true;
      return result;
    }

    return {
      cancel: function () { serial++; },
      search: function (rawQuery, onProgress) {
        const query = String(rawQuery || '').replace(/\s+/g, ' ').trim();
        const token = ++serial;
        if (query.length < 3) return Promise.resolve({ tooShort: true });
        if (query.length > MAX_QUERY) return Promise.resolve({ tooLong: true });
        const task = queue.then(function () {
          if (token !== serial) return { cancelled: true };
          return searchSections(query, token, onProgress);
        });
        queue = task.then(function () {}, function () {});
        return task;
      }
    };
  };
})();
