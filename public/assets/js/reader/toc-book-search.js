import {recordReaderDiagnostic} from './diagnostics.js';

function normalizeBookQuery(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

// The TOC keeps its root/UI scopes; this boundary owns book-query presentation.
// Navigation and chapter labels are supplied by the same application/TOC owners.
export function createTocBookSearch({scope,uiScope,bookSearch,navigate,closeDrawers,chapterForLocation}) {
  let resultsScope=uiScope.child();
  let bookSection = null;
  let bookStatus = null;
  let bookResults = null;
  let searchTimer = 0;
  let searchSerial = 0;

  function clearBookResults({hide=true,status=""}={}) {
    bookSearch?.cancel?.();
    resultsScope.dispose();resultsScope=uiScope.child();
    scope.clearTimeout(searchTimer);
    searchTimer = 0;
    searchSerial += 1;
    bookResults?.replaceChildren();
    if (bookStatus) bookStatus.textContent = status;
    if (bookSection) bookSection.hidden = hide;
  }

  function renderBookResult(hit, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "book-search-result";
    button.dataset.cfi = hit.cfi;
    const chapter = document.createElement("span");
    chapter.className = "book-search-result-chapter";
    const location = { start: { href: hit.href || "", index: Number(hit.sectionIndex) } };
    chapter.textContent = chapterForLocation(location) || hit.href || `Result ${index + 1}`;
    const excerpt = document.createElement("span");
    excerpt.className = "book-search-result-excerpt";
    excerpt.textContent = hit.excerpt || "Matching text";
    button.append(chapter, excerpt);
    resultsScope.listen(button,"click", async () => {
      try {
        await navigate(hit.cfi);
        if(!scope.disposed)closeDrawers();
      } catch (error) {
        if(!scope.disposed)recordReaderDiagnostic('navigation.searchFailed');
      }
    });
    return button;
  }

  function scheduleBookSearch(value) {
    const query = normalizeBookQuery(value);
    clearBookResults({ hide: !query });
    if (!query || !bookSection || !bookStatus || !bookResults) return;
    bookSection.hidden = false;
    const minimum = Number(bookSearch?.minQueryLength) || 3;
    if (query.length < minimum) {
      bookStatus.textContent = `Enter at least ${minimum} characters to search book text.`;
      return;
    }
    const serial = searchSerial;
    bookStatus.textContent = "Searching book text…";
    searchTimer = scope.timeout(async () => {
      const result = await bookSearch?.search?.(query, {
        onProgress: progress => {
          if (scope.disposed || serial !== searchSerial || !bookStatus) return;
          bookStatus.textContent = `Searching ${progress.scanned} of ${progress.total} sections… ${progress.count} ${progress.count === 1 ? "match" : "matches"}`;
        }
      });
      if (scope.disposed || serial !== searchSerial || !result || result.cancelled) return;
      const fragment = document.createDocumentFragment();
      result.hits.forEach((hit, index) => fragment.appendChild(renderBookResult(hit, index)));
      bookResults.replaceChildren(fragment);
      if (result.unavailable) bookStatus.textContent = "Book text search is unavailable for this EPUB.";
      else if (!result.hits.length) bookStatus.textContent = "No matching book text.";
      else if (result.capped) bookStatus.textContent = `${result.hits.length}+ book-text matches · Refine your search for more precise results.`;
      else bookStatus.textContent = `${result.hits.length} book-text ${result.hits.length === 1 ? "match" : "matches"}.`;
    }, 180);
  }

  function createBookSection() {
    const section = document.createElement("section");
    section.className = "toc-book-search-section";
    section.hidden = true;
    const heading = document.createElement("h3");
    heading.className = "toc-search-section-label";
    heading.textContent = "Book text";
    bookStatus = document.createElement("p");
    bookStatus.className = "book-search-status";
    bookStatus.setAttribute("role", "status");
    bookStatus.setAttribute("aria-live", "polite");
    bookResults = document.createElement("div");
    bookResults.id = "tocBookSearchResults";
    bookResults.className = "book-search-results";
    bookResults.setAttribute("aria-label", "Book text search results");
    section.append(heading, bookStatus, bookResults);
    return section;
  }

  // The TOC disposes the old UI scope before supplying its replacement.
  function reset(nextUiScope) {
    uiScope = nextUiScope;
    resultsScope = uiScope.child();
    searchSerial += 1;
    bookSection = null;
    bookStatus = null;
    bookResults = null;
    scope.clearTimeout(searchTimer);
    bookSearch?.cancel?.();
  }

  // Parent teardown invalidates publication before disposing the root scope.
  function invalidate() {
    searchSerial += 1;
    bookSearch?.cancel?.();
  }

  function cancel() {
    scope.clearTimeout(searchTimer);
    invalidate();
  }

  return {
    createSection() {
      bookSection = createBookSection();
      return bookSection;
    },
    schedule: scheduleBookSearch,
    clear: clearBookResults,
    reset,
    cancel,
    invalidate
  };
}
