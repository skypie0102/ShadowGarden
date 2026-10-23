/* EPUB preflight owns local archive inspection and produces data-only reports.
   It never reads queue/editor DOM or performs uploads. */
(() => {
  const keeper = window.ShadowGardenKeeper;
  if (!keeper) return;
  const {
    fmtSize,
    dirName,
    firstText,
    texts,
    cleanHtml,
    metaByName,
    metaByProperty,
    inferSeries,
    detectVolume,
    mimeExt,
    mimeForExt
  } = keeper.util;
  const MAX_BYTES = 50 * 1024 * 1024;
  const KNOWN_FONT_OBFUSCATION = new Set([
    "http://www.idpf.org/2008/embedding",
    "http://ns.adobe.com/pdf/enc#RC"
  ]);
  const readableTypes = new Set(["application/xhtml+xml", "text/html", "image/svg+xml"]);
  const taxonomyPromise = import("/assets/js/domain/catalog-taxonomy.js?v=2.11.0");
  function safeDecode(v) {
    try {
      return decodeURIComponent(String(v || ""));
    } catch {
      return String(v || "");
    }
  }
  function normalizeText(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }
  function hex(buffer) {
    return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  function localElements(root, name) {
    return root ? [...root.getElementsByTagName("*")].filter(el => el.localName === name) : [];
  }
  function xml(text) {
    return new DOMParser().parseFromString(String(text || ""), "application/xml");
  }
  function broken(doc) {
    return Boolean(doc?.querySelector?.("parsererror"));
  }
  function zipText(zip, path) {
    const entry = zip.file(path);
    return entry ? entry.async("string") : Promise.resolve(null);
  }
  function report() {
    return {
      status: "pass",
      fatal: [],
      warnings: [],
      checks: {
        container: "pending",
        package: "pending",
        spine: "pending",
        navigation: "pending",
        cover: "pending",
        security: "pending"
      },
      stats: { manifest: 0, spine: 0, brokenRefs: 0, mediaOverlays: 0 }
    };
  }
  function addIssue(r, severity, message, detail = "") {
    const list = severity === "fatal" ? r.fatal : r.warnings;
    if (!list.some(x => x.message === message && x.detail === detail))
      list.push({ message, detail });
  }
  function finish(r) {
    r.status = r.fatal.length ? "fail" : r.warnings.length ? "warning" : "pass";
    return r;
  }
  function failed(message, detail = "") {
    const r = report();
    addIssue(r, "fatal", message, detail);
    r.checks.container = "fail";
    r.checks.package = "fail";
    return finish(r);
  }
  function resolveLocal(base, reference) {
    const raw = String(reference || "").trim();
    if (!raw || raw.startsWith("#") || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw))
      return { skip: true, path: "" };
    // Separate URI components before decoding filename data such as %23.
    const clean = safeDecode(raw.split("#")[0].split("?")[0]);
    const stack = clean.startsWith("/")
      ? []
      : String(base || "")
          .split("/")
          .filter(Boolean);
    for (const part of clean.replace(/^\/+/, "").split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (!stack.length) return { invalid: true, path: "" };
        stack.pop();
      } else stack.push(part);
    }
    return { skip: false, invalid: false, path: stack.join("/") };
  }
  function collectRefs(doc) {
    const refs = [];
    for (const [selector, attr] of [
      ["a[href]", "href"],
      ["img[src]", "src"],
      ["link[href]", "href"],
      ["source[src]", "src"],
      ["audio[src]", "src"],
      ["video[src]", "src"],
      ["object[data]", "data"]
    ]) {
      for (const el of doc.querySelectorAll?.(selector) || []) {
        const value = el.getAttribute(attr);
        if (value) refs.push(value);
      }
    }
    return refs;
  }

  function epubTranslatorNames(opf) {
    const refinedRoles = new Map();
    for (const meta of localElements(opf, "meta")) {
      if (normalizeText(meta.getAttribute("property")) !== "role") continue;
      const refines = String(meta.getAttribute("refines") || "").trim();
      if (refines.startsWith("#"))
        refinedRoles.set(refines.slice(1), normalizeText(meta.textContent));
    }
    const translatorRole = value => {
      const role = normalizeText(value);
      if (!role) return false;
      const tail =
        role
          .split(/[:\/#]/)
          .filter(Boolean)
          .pop() || "";
      return role === "trl" || role === "translator" || tail === "trl" || tail === "translator";
    };
    const names = [],
      seen = new Set();
    for (const node of localElements(opf, "contributor")) {
      const id = node.getAttribute("id") || "";
      const nsRole =
        typeof node.getAttributeNS === "function"
          ? node.getAttributeNS("http://www.idpf.org/2007/opf", "role")
          : "";
      const role =
        node.getAttribute("role") ||
        node.getAttribute("opf:role") ||
        nsRole ||
        refinedRoles.get(id) ||
        "";
      if (!translatorRole(role)) continue;
      const name = String(node.textContent || "").trim();
      if (!name) continue;
      const key = normalizeText(name);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names;
  }
  async function inspect(file) {
    if (file.size > MAX_BYTES)
      return {
        file,
        validation: failed("File exceeds the 50 MB mobile upload limit", fmtSize(file.size))
      };
    const bytes = await file.arrayBuffer();
    const digestPromise = crypto.subtle.digest("SHA-256", bytes);
    let zip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch {
      return { file, validation: failed("This file is not a readable EPUB/ZIP archive.") };
    }
    const r = report();

    const mimetype = await zipText(zip, "mimetype");
    if (mimetype === null) addIssue(r, "warning", "Missing EPUB mimetype file");
    else if (mimetype.trim() !== "application/epub+zip")
      addIssue(r, "warning", "Unexpected EPUB mimetype", mimetype.trim());

    const containerText = await zipText(zip, "META-INF/container.xml");
    if (containerText === null)
      return { file, validation: failed("This EPUB is missing META-INF/container.xml.") };
    const container = xml(containerText);
    if (broken(container))
      return { file, validation: failed("META-INF/container.xml is malformed.") };
    const rootfile = localElements(container, "rootfile")[0]?.getAttribute("full-path") || "";
    if (!rootfile)
      return {
        file,
        validation: failed("The EPUB container does not identify a package document.")
      };
    r.checks.container = "pass";

    const opfText = await zipText(zip, rootfile);
    if (opfText === null)
      return {
        file,
        validation: failed("The package document referenced by container.xml is missing.")
      };
    const opf = xml(opfText);
    if (broken(opf))
      return { file, validation: failed("The EPUB package document is malformed XML.") };
    r.checks.package = "pass";
    const opfDir = dirName(rootfile);

    const title = firstText(opf, "title") || file.name.replace(/\.epub$/i, "");
    const author = firstText(opf, "creator"),
      date = firstText(opf, "date"),
      language = firstText(opf, "language"),
      publisher = firstText(opf, "publisher");
    const translatorNames = epubTranslatorNames(opf);
    const description = cleanHtml(firstText(opf, "description")),
      rawSubjects = [...new Set(texts(opf, "subject"))];
    const taxonomy = await taxonomyPromise,
      classifiedSubjects = taxonomy.classifySubjects(rawSubjects),
      genres = classifiedSubjects.genres,
      tags = classifiedSubjects.tags;
    const series =
      metaByName(opf, "calibre:series") ||
      metaByProperty(opf, "belongs-to-collection") ||
      inferSeries(title);
    const number = detectVolume(title, file.name, opf);
    if (!firstText(opf, "title"))
      addIssue(r, "warning", "Missing title metadata", "The filename will be used.");
    if (!language) addIssue(r, "warning", "Missing language metadata");

    const manifestNodes = localElements(opf, "item"),
      manifestById = new Map(),
      manifest = [];
    r.stats.manifest = manifestNodes.length;
    for (const node of manifestNodes) {
      const id = node.getAttribute("id") || "",
        href = node.getAttribute("href") || "",
        resolved = resolveLocal(opfDir, href);
      const item = {
        id,
        href,
        path: resolved.path,
        invalid: resolved.invalid,
        external: resolved.skip && /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href),
        mediaType: node.getAttribute("media-type") || "",
        properties: String(node.getAttribute("properties") || "")
          .split(/\s+/)
          .filter(Boolean),
        overlay: node.getAttribute("media-overlay") || ""
      };
      manifest.push(item);
      if (!id) addIssue(r, "warning", "Manifest item without an id", href);
      else if (manifestById.has(id)) addIssue(r, "fatal", "Duplicate manifest id", id);
      else manifestById.set(id, item);
      if (item.invalid) addIssue(r, "warning", "Manifest path escapes the EPUB root", href);
      else if (!item.external && item.path && !zip.file(item.path)) {
        addIssue(r, "warning", "Manifest resource is missing", href);
        r.stats.brokenRefs++;
      }
    }

    const spineNode = localElements(opf, "spine")[0],
      spineRefs = spineNode ? localElements(spineNode, "itemref") : [];
    r.stats.spine = spineRefs.length;
    const spineItems = [];
    if (!spineRefs.length) addIssue(r, "fatal", "No readable spine was found");
    for (const ref of spineRefs) {
      const idref = ref.getAttribute("idref") || "",
        item = manifestById.get(idref);
      if (!idref) {
        addIssue(r, "fatal", "Spine entry is missing idref");
        continue;
      }
      if (!item) {
        addIssue(r, "fatal", "Spine references an unknown manifest id", idref);
        continue;
      }
      if (item.invalid || item.external || !item.path || !zip.file(item.path)) {
        addIssue(r, "fatal", "Spine document is missing or invalid", item.href || idref);
        r.stats.brokenRefs++;
        continue;
      }
      if (readableTypes.has(item.mediaType) || /\.(?:xhtml?|html?|svg)$/i.test(item.path))
        spineItems.push(item);
      else
        addIssue(
          r,
          "warning",
          "Unusual spine media type",
          `${item.href} (${item.mediaType || "unknown"})`
        );
    }
    if (!spineItems.length) addIssue(r, "fatal", "The spine contains no HTML/XHTML/SVG documents");
    let parseable = 0;
    for (const item of spineItems) {
      const text = await zipText(zip, item.path);
      if (text === null) continue;
      let doc = xml(text);
      if (broken(doc)) {
        addIssue(r, "warning", "Malformed XHTML in spine", item.href);
        doc = new DOMParser().parseFromString(text, "text/html");
      } else parseable++;
      for (const href of collectRefs(doc)) {
        const resolved = resolveLocal(dirName(item.path), href);
        if (resolved.invalid || (!resolved.skip && resolved.path && !zip.file(resolved.path))) {
          addIssue(r, "warning", "Broken internal resource reference", `${item.href} → ${href}`);
          r.stats.brokenRefs++;
        }
      }
    }
    if (spineItems.length && !parseable)
      addIssue(r, "fatal", "None of the spine documents parsed as valid XHTML/XML");
    r.checks.spine = r.fatal.some(x => /spine|readable|parsed/i.test(x.message)) ? "fail" : "pass";

    const nav = manifest.filter(x => x.properties.includes("nav"));
    const tocId = spineNode?.getAttribute("toc") || "",
      ncx =
        (tocId && manifestById.get(tocId)) ||
        manifest.find(x => x.mediaType === "application/x-dtbncx+xml");
    if (!nav.length && !ncx) {
      r.checks.navigation = "warn";
      addIssue(r, "warning", "No EPUB navigation document was found");
    } else r.checks.navigation = "pass";

    let coverItem = manifest.find(x => x.properties.includes("cover-image"));
    if (!coverItem) {
      const coverId = metaByName(opf, "cover");
      if (coverId) coverItem = manifestById.get(coverId);
    }
    let coverBlob = null,
      coverExt = ".jpg";
    if (!coverItem) {
      r.checks.cover = "warn";
      addIssue(r, "warning", "No cover image is declared");
    } else if (
      coverItem.invalid ||
      coverItem.external ||
      !coverItem.path ||
      !zip.file(coverItem.path)
    ) {
      r.checks.cover = "warn";
      addIssue(r, "warning", "Declared cover image is unavailable", coverItem.href || coverItem.id);
    } else {
      r.checks.cover = "pass";
      coverExt = mimeExt(coverItem.mediaType, coverItem.href);
      const data = await zip.file(coverItem.path).async("arraybuffer");
      coverBlob = new Blob([data], { type: coverItem.mediaType || mimeForExt(coverExt) });
    }

    const encryptionText = await zipText(zip, "META-INF/encryption.xml");
    if (encryptionText !== null) {
      const enc = xml(encryptionText);
      if (broken(enc)) addIssue(r, "warning", "Malformed encryption metadata");
      else {
        const algorithms = localElements(enc, "EncryptionMethod")
          .map(n => n.getAttribute("Algorithm") || "")
          .filter(Boolean);
        const unknown = algorithms.filter(a => !KNOWN_FONT_OBFUSCATION.has(a));
        if (algorithms.some(a => KNOWN_FONT_OBFUSCATION.has(a)))
          addIssue(r, "warning", "Obfuscated embedded fonts detected");
        if (unknown.length)
          addIssue(
            r,
            "fatal",
            "Encrypted or DRM-protected resources detected",
            unknown.slice(0, 3).join(", ")
          );
      }
    }
    r.checks.security = r.fatal.some(x => /DRM|Encrypted/i.test(x.message)) ? "fail" : "pass";

    const smils = manifest.filter(
      x => x.mediaType === "application/smil+xml" || /\.smil$/i.test(x.path)
    );
    r.stats.mediaOverlays = smils.length;
    for (const item of manifest.filter(x => x.overlay))
      if (!manifestById.has(item.overlay))
        addIssue(
          r,
          "warning",
          "Media-overlay reference is missing",
          `${item.href} → ${item.overlay}`
        );

    const sha256 = hex(await digestPromise);
    return {
      file,
      title,
      author,
      date,
      year: parseInt(date.slice(0, 4)) || "",
      language,
      publisher,
      description,
      genres,
      tags,
      rawSubjects,
      series,
      number,
      coverBlob,
      coverExt,
      sha256,
      translations: translatorNames.slice(0, 1).map(name => ({ name })),
      validation: finish(r)
    };
  }

  keeper.epubInspection = { inspect, failed };
})();
