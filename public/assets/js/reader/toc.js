function childrenOf(item) {
  if (Array.isArray(item?.subitems)) return item.subitems;
  if (Array.isArray(item?.children)) return item.children;
  return [];
}

function cleanHref(value) {
  let href = String(value || "").split("#")[0].split("?")[0];
  try { href = decodeURIComponent(href); } catch {}
  return href.replace(/^\.\//, "").replace(/^\//, "");
}

function hrefMatches(a, b) {
  const left = cleanHref(a), right = cleanHref(b);
  if (!left || !right) return false;
  return left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
}

function flatten(items, depth = 0, output = []) {
  for (const item of Array.isArray(items) ? items : []) {
    output.push({ item, depth });
    flatten(childrenOf(item), depth + 1, output);
  }
  return output;
}

function normalizeSearchText(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function normalizeBookQuery(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function genericVisualLabel(item) {
  const label = String(item?.label || "").trim();
  if (!label) return true;
  return /^(?:page|pg\.?)\s*\d+(?:\s*[-–—]\s*\d+)?$/i.test(label) ||
    /^(?:cover|cover page|illustration|illustration page|image|image page|plate|frontispiece)(?:\s+\d+)?$/i.test(label);
}

function sectionLabel(item) {
  return String(item?.label || "section").trim() || "section";
}

function setBranchExpanded(toggle, childBox, expanded) {
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.textContent = expanded ? "▾" : "▸";
  toggle.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${toggle.dataset.label || "section"}`);
  childBox.classList.toggle("collapsed", !expanded);
}

function spineIndexForHref(href, items) {
  if (!href) return null;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!hrefMatches(href, item?.href || item?.url || "")) continue;
    const explicit = Number(item?.index);
    return Number.isFinite(explicit) ? explicit : index;
  }
  return null;
}

function locationSpineIndex(location, items) {
  for (const value of [location?.start?.index, location?.end?.index]) {
    const index = Number(value);
    if (Number.isFinite(index) && index >= 0) return index;
  }
  return spineIndexForHref(location?.start?.href || location?.end?.href || "", items);
}

export function createTocController({ panel, navigate, closeDrawers, getBook, bookSearch }) {
  let items = [];
  let flat = [];
  let activeButton = null;
  let pageResolver = null;
  let tree = null;
  let searchInput = null;
  let searchTools = null;
  let searchToggle = null;
  let currentButton = null;
  let filterEmpty = null;
  let contentsHeading = null;
  let bookSection = null;
  let bookStatus = null;
  let bookResults = null;
  let searchTimer = 0;
  let searchSerial = 0;

  function readerSpineItems() {
    const values = getBook?.()?.spine?.spineItems;
    return Array.isArray(values) ? values : [];
  }

  function pageNumberFor(href) {
    if (!pageResolver || !href) return null;
    try {
      const value = Number(pageResolver(href));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  function syncPageNumbers() {
    panel.querySelectorAll(".toc-entry-link[data-href]").forEach(button => {
      const row = button.closest(".toc-row");
      if (!row) return;
      let page = row.querySelector(".toc-page-number");
      const number = pageNumberFor(button.dataset.href);
      if (!number) {
        page?.remove();
        return;
      }
      if (!page) {
        page = document.createElement("span");
        page.className = "toc-page-number";
        page.setAttribute("aria-label", `Starts on page ${number}`);
        row.appendChild(page);
      }
      page.textContent = String(number);
      page.setAttribute("aria-label", `Starts on page ${number}`);
    });
  }

  function createNode(item, depth, path) {
    const node = document.createElement("div");
    const children = childrenOf(item);
    const label = String(item?.label || "Untitled section").trim() || "Untitled section";
    node.className = `toc-node ${children.length ? "toc-branch" : "toc-leaf"}`;
    node.style.setProperty("--toc-depth", String(depth));
    node.dataset.tocLabel = normalizeSearchText(label);

    const row = document.createElement("div");
    row.className = "toc-row";
    node.appendChild(row);

    if (children.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "toc-expander";
      toggle.textContent = "▾";
      toggle.dataset.label = sectionLabel(item);
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", `Collapse ${toggle.dataset.label}`);
      row.appendChild(toggle);

      const childBox = document.createElement("div");
      childBox.className = "toc-children";
      childBox.id = `toc-${path}`;
      toggle.setAttribute("aria-controls", childBox.id);
      toggle.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const expanded = toggle.getAttribute("aria-expanded") !== "false";
        setBranchExpanded(toggle, childBox, !expanded);
      });

      children.forEach((child, index) => childBox.appendChild(createNode(child, depth + 1, `${path}-${index}`)));
      node.appendChild(childBox);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "toc-expander-spacer";
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }

    const href = String(item?.href || "");
    if (href) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toc-link toc-entry-link";
      button.textContent = label;
      button.dataset.href = href;
      button.addEventListener("click", async () => {
        try {
          await navigate(href);
          closeDrawers();
        } catch (error) {
          console.error("TOC navigation failed", error);
        }
      });
      row.appendChild(button);
      const pageNumber = pageNumberFor(href);
      if (pageNumber) {
        const page = document.createElement("span");
        page.className = "toc-page-number";
        page.textContent = String(pageNumber);
        page.setAttribute("aria-label", `Starts on page ${pageNumber}`);
        row.appendChild(page);
      }
    } else {
      const text = document.createElement("span");
      text.className = "toc-link toc-entry-label";
      text.textContent = label;
      row.appendChild(text);
    }

    return node;
  }

  function filterNode(node, query, ancestorMatched = false) {
    const ownMatch = ancestorMatched || node.dataset.tocLabel.includes(query);
    const childBox = [...node.children].find(child => child.classList?.contains("toc-children")) || null;
    const childMatches = childBox ? [...childBox.children].map(child => filterNode(child, query, ownMatch)) : [];
    const visible = !query || ownMatch || childMatches.some(Boolean);
    node.hidden = !visible;
    return visible;
  }

  function applyFilter(value) {
    const query = normalizeSearchText(value);
    if (!tree) return false;
    tree.classList.toggle("toc-filtering", Boolean(query));
    const visible = [...tree.children].map(node => filterNode(node, query)).some(Boolean);
    if (contentsHeading) contentsHeading.hidden = !query;
    if (filterEmpty) filterEmpty.hidden = !query || visible;
    return visible;
  }

  function clearBookResults({hide=true,status=""}={}) {
    bookSearch?.cancel?.();
    clearTimeout(searchTimer);
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
    button.addEventListener("click", async () => {
      try {
        await navigate(hit.cfi);
        closeDrawers();
      } catch (error) {
        console.error("Book search navigation failed", error);
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
    searchTimer = setTimeout(async () => {
      const result = await bookSearch?.search?.(query, {
        onProgress: progress => {
          if (serial !== searchSerial || !bookStatus) return;
          bookStatus.textContent = `Searching ${progress.scanned} of ${progress.total} sections… ${progress.count} ${progress.count === 1 ? "match" : "matches"}`;
        }
      });
      if (serial !== searchSerial || !result || result.cancelled) return;
      const fragment = document.createDocumentFragment();
      result.hits.forEach((hit, index) => fragment.appendChild(renderBookResult(hit, index)));
      bookResults.replaceChildren(fragment);
      if (result.unavailable) bookStatus.textContent = "Book text search is unavailable for this EPUB.";
      else if (!result.hits.length) bookStatus.textContent = "No matching book text.";
      else if (result.capped) bookStatus.textContent = `${result.hits.length}+ book-text matches · Refine your search for more precise results.`;
      else bookStatus.textContent = `${result.hits.length} book-text ${result.hits.length === 1 ? "match" : "matches"}.`;
    }, 180);
  }

  function runCombinedSearch(value) {
    applyFilter(value);
    scheduleBookSearch(value);
  }

  function clearFilter() {
    if (searchInput) searchInput.value = "";
    applyFilter("");
    clearBookResults();
  }

  function setSearchExpanded(expanded, { focus = true } = {}) {
    if (!searchTools || !searchToggle) return;
    if (!expanded) clearFilter();
    searchTools.hidden = !expanded;
    searchToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    searchToggle.classList.toggle("active", expanded);
    if (expanded && focus) queueMicrotask(() => searchInput?.focus());
  }

  function switchToContentsTab() {
    const tabs = panel.closest?.(".reader-drawer")?.querySelector?.(".drawer-tabs") || null;
    const contentsTab = tabs?.querySelector?.('button[data-panel="toc"]') || null;
    if (contentsTab && !contentsTab.classList.contains("active")) contentsTab.click();
  }

  function openSearch() {
    switchToContentsTab();
    setSearchExpanded(true);
  }

  function installSearchToggle() {
    const drawer = panel.closest?.(".reader-drawer") || null;
    const tabs = drawer?.querySelector?.(".drawer-tabs") || null;
    if (!tabs) return;
    tabs.querySelector(".toc-search-toggle")?.remove();

    searchToggle = document.createElement("button");
    searchToggle.type = "button";
    searchToggle.className = "toc-search-toggle";
    searchToggle.title = "Search contents and book";
    searchToggle.setAttribute("aria-label", "Search contents and book");
    searchToggle.setAttribute("aria-controls", "tocSearchTools");
    searchToggle.setAttribute("aria-expanded", "false");
    searchToggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>';
    searchToggle.addEventListener("click", () => {
      switchToContentsTab();
      setSearchExpanded(searchTools?.hidden !== false);
    });
    tabs.appendChild(searchToggle);

    const bookmarksTab = tabs.querySelector('button[data-panel="bookmarks"]');
    bookmarksTab?.addEventListener("click", () => setSearchExpanded(false, { focus: false }));
  }

  function createTools() {
    const tools = document.createElement("div");
    tools.id = "tocSearchTools";
    tools.className = "toc-tools";
    tools.hidden = true;

    searchInput = document.createElement("input");
    searchInput.className = "toc-search";
    searchInput.type = "search";
    searchInput.autocomplete = "off";
    searchInput.spellcheck = false;
    searchInput.placeholder = "Search contents & book";
    searchInput.setAttribute("aria-label", "Search contents and book");
    searchInput.setAttribute("aria-controls", "tocTree tocBookSearchResults");
    searchInput.addEventListener("input", () => runCombinedSearch(searchInput.value));
    searchInput.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (searchInput.value) clearFilter();
      else {
        setSearchExpanded(false, { focus: false });
        searchToggle?.focus();
      }
    });
    tools.appendChild(searchInput);

    currentButton = document.createElement("button");
    currentButton.type = "button";
    currentButton.className = "toc-current-button";
    currentButton.textContent = "Current";
    currentButton.title = "Show current chapter";
    currentButton.disabled = !activeButton;
    currentButton.addEventListener("click", () => {
      if (!activeButton) return;
      clearFilter();
      expandAncestorsOf(activeButton);
      activeButton.focus({ preventScroll: true });
      revealActiveButton(activeButton);
    });
    tools.appendChild(currentButton);

    return tools;
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

  function render(navigationItems) {
    items = Array.isArray(navigationItems) ? navigationItems : [];
    flat = flatten(items);
    activeButton = null;
    tree = null;
    searchInput = null;
    searchTools = null;
    currentButton = null;
    filterEmpty = null;
    contentsHeading = null;
    bookSection = null;
    bookStatus = null;
    bookResults = null;
    clearTimeout(searchTimer);
    bookSearch?.cancel?.();
    panel.closest?.(".reader-drawer")?.querySelector?.(".toc-search-toggle")?.remove();
    searchToggle = null;
    panel.replaceChildren();

    searchTools = createTools();
    panel.appendChild(searchTools);
    installSearchToggle();

    contentsHeading = document.createElement("h3");
    contentsHeading.className = "toc-search-section-label";
    contentsHeading.textContent = "Contents";
    contentsHeading.hidden = true;
    panel.appendChild(contentsHeading);

    tree = document.createElement("div");
    tree.id = "tocTree";
    tree.className = "toc-tree";
    tree.setAttribute("role", "tree");
    items.forEach((item, index) => tree.appendChild(createNode(item, 0, String(index))));
    panel.appendChild(tree);

    filterEmpty = document.createElement("p");
    filterEmpty.className = "bookmark-empty toc-filter-empty";
    filterEmpty.textContent = items.length ? "No matching contents." : "This EPUB does not provide a table of contents.";
    filterEmpty.setAttribute("role", "status");
    filterEmpty.hidden = Boolean(items.length);
    panel.appendChild(filterEmpty);

    bookSection = createBookSection();
    panel.appendChild(bookSection);
    syncPageNumbers();
  }

  function setPageResolver(resolver) {
    pageResolver = typeof resolver === "function" ? resolver : null;
    syncPageNumbers();
  }

  function bestEntry(entries) {
    let best = null;
    for (const entry of entries) {
      if (!best || entry.depth > best.depth || cleanHref(entry.item?.href).length > cleanHref(best.item?.href).length) best = entry;
    }
    return best;
  }

  function matchForLocation(location) {
    const href = location?.start?.href || location?.end?.href || "";
    const exactEntries = flat.filter(entry => hrefMatches(href, entry.item?.href));
    const exactMeaningful = bestEntry(exactEntries.filter(entry => !genericVisualLabel(entry.item)));
    if (exactMeaningful) return exactMeaningful.item;

    const spineItems = readerSpineItems();
    const currentIndex = locationSpineIndex(location, spineItems);
    if (Number.isFinite(currentIndex)) {
      let preceding = null;
      for (let order = 0; order < flat.length; order++) {
        const entry = flat[order];
        if (genericVisualLabel(entry.item)) continue;
        const navIndex = spineIndexForHref(entry.item?.href, spineItems);
        if (!Number.isFinite(navIndex) || navIndex > currentIndex) continue;
        if (!preceding || navIndex > preceding.navIndex || (navIndex === preceding.navIndex && entry.depth >= preceding.entry.depth)) preceding = { entry, navIndex, order };
      }
      if (preceding) return preceding.entry.item;
    }

    const exactFallback = bestEntry(exactEntries);
    if (exactFallback) return exactFallback.item;
    return null;
  }

  function chapterForLocation(location) {
    const match = matchForLocation(location);
    return String(match?.label || "").trim();
  }

  function tocDrawer() {
    return panel.closest?.(".reader-drawer") || null;
  }

  function expandAncestorsOf(button) {
    let box = button.closest?.(".toc-children") || null;
    while (box) {
      if (box.classList.contains("collapsed")) {
        const toggle = panel.querySelector(`.toc-expander[aria-controls="${box.id}"]`);
        if (toggle) setBranchExpanded(toggle, box, true);
        else box.classList.remove("collapsed");
      }
      box = box.parentElement?.closest?.(".toc-children") || null;
    }
  }

  function revealActiveButton(button) {
    const drawer = tocDrawer();
    if (!drawer || typeof button.getBoundingClientRect !== "function" || typeof drawer.getBoundingClientRect !== "function") return;
    const drawerRect = drawer.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const buttonHeight = Number(button.offsetHeight) || 0;
    if (!drawerRect || !buttonRect || !drawer.clientHeight) return;
    const target = drawer.scrollTop + (buttonRect.top - drawerRect.top) - (drawer.clientHeight - buttonHeight) / 2;
    drawer.scrollTop = Math.max(0, target);
  }

  function setActiveForLocation(location) {
    const match = matchForLocation(location);
    const href = String(match?.href || "");
    const previous = activeButton;
    if (previous) {
      previous.classList.remove("active");
      previous.removeAttribute("aria-current");
      activeButton = null;
    }
    if (!href) {
      if (currentButton) currentButton.disabled = true;
      return;
    }
    activeButton = [...panel.querySelectorAll(".toc-entry-link")].find(button => button.dataset.href === href) || null;
    if (currentButton) currentButton.disabled = !activeButton;
    if (!activeButton) return;
    activeButton.classList.add("active");
    activeButton.setAttribute("aria-current", "location");
    if (activeButton !== previous) {
      const drawer = tocDrawer();
      if (drawer && !drawer.classList.contains("open")) {
        expandAncestorsOf(activeButton);
        revealActiveButton(activeButton);
      }
    }
  }

  return { render, setPageResolver, chapterForLocation, setActiveForLocation, openSearch, cancelSearch: () => bookSearch?.cancel?.() };
}
