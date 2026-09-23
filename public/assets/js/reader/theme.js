const DARK_TEXT = "#17151b";
const LIGHT_TEXT = "#f1edf6";
const READER_FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;1,400;1,700&family=Literata:ital,wght@0,400;0,700;1,400;1,700&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap";
const READER_FONT_FAMILIES = Object.freeze({
  "pt-sans": '"PT Sans", Arial, sans-serif',
  literata: 'Literata, Georgia, serif',
  inter: 'Inter, system-ui, sans-serif'
});
const SKIP_TEXT_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IMG", "VIDEO", "AUDIO", "CANVAS",
  "SVG", "MATH", "IFRAME", "OBJECT", "EMBED"
]);

function parseColor(value) {
  const text = String(value || "").trim();
  if (!text || text === "transparent") return null;
  const match = text.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const channel = value => String(value).endsWith("%")
    ? Math.max(0, Math.min(255, parseFloat(value) * 2.55))
    : Math.max(0, Math.min(255, parseFloat(value)));
  const r = channel(parts[0]), g = channel(parts[1]), b = channel(parts[2]);
  if (![r, g, b].every(Number.isFinite)) return null;
  let a = 1;
  if (parts[3] != null) {
    a = String(parts[3]).endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if (!Number.isFinite(a)) a = 1;
  }
  return { r, g, b, a: Math.max(0, Math.min(1, a)) };
}

function solid(hex) {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255, a: 1 };
}

function composite(top, bottom) {
  const a = top.a + bottom.a * (1 - top.a);
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
    g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
    b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
    a
  };
}

function relativeLuminance(color) {
  const convert = value => {
    const x = Math.max(0, Math.min(255, value)) / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * convert(color.r) + 0.7152 * convert(color.g) + 0.0722 * convert(color.b);
}

function contrast(a, b) {
  const l1 = relativeLuminance(a), l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function hasDirectText(element) {
  for (const node of element.childNodes) {
    if (node.nodeType === 3 && node.textContent?.trim()) return true;
  }
  return false;
}

function computedStyle(element, win) {
  if (!element || element.nodeType !== 1 || element.isConnected === false || typeof win?.getComputedStyle !== "function") return null;
  try { return win.getComputedStyle(element) || null; } catch { return null; }
}

function restoreContrast(document) {
  document.querySelectorAll('[data-sg-contrast="1"]').forEach(element => {
    const original = element.getAttribute("data-sg-original-color");
    const priority = element.getAttribute("data-sg-original-priority") || "";
    if (original && original !== "__none__") element.style.setProperty("color", original, priority);
    else element.style.removeProperty("color");
    element.removeAttribute("data-sg-contrast");
    element.removeAttribute("data-sg-original-color");
    element.removeAttribute("data-sg-original-priority");
  });
}

function forceColor(element, color) {
  if (element.getAttribute("data-sg-contrast") === "1") return;
  element.setAttribute("data-sg-contrast", "1");
  element.setAttribute("data-sg-original-color", element.style.getPropertyValue("color") || "__none__");
  element.setAttribute("data-sg-original-priority", element.style.getPropertyPriority("color") || "");
  element.style.setProperty("color", color, "important");
}

export function createThemeController({ getSettings, isAdult }) {
  function themeBase(theme) {
    if (theme === "paper") return solid("#ffffff");
    if (theme === "night") return solid("#0c1020");
    if (theme === "black") return solid("#000000");
    return solid(isAdult ? "#140d10" : "#120e19");
  }

  function effectiveBackground(element, win, theme) {
    const chain = [];
    for (let node = element; node?.nodeType === 1; node = node.parentElement) chain.push(node);
    chain.reverse();
    let result = themeBase(theme);
    for (const node of chain) {
      const style = computedStyle(node, win);
      if (!style) continue;
      const background = parseColor(style.backgroundColor);
      if (background?.a > 0) result = composite(background, result);
    }
    return result;
  }

  function shouldInspect(element, win) {
    if (!element || SKIP_TEXT_TAGS.has(element.tagName) || !hasDirectText(element)) return false;
    const style = computedStyle(element, win);
    if (!style) return false;
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
  }

  function repairText(element, win, theme) {
    const style = computedStyle(element, win);
    if (!style) return;
    const foreground = parseColor(style.color);
    if (!foreground || foreground.a < 0.2) return;
    const background = effectiveBackground(element, win, theme);
    const currentRatio = contrast(foreground, background);
    if (currentRatio >= 4.15) return;

    const dark = solid(DARK_TEXT), light = solid(LIGHT_TEXT);
    const darkRatio = contrast(dark, background), lightRatio = contrast(light, background);
    const replacement = darkRatio >= lightRatio ? DARK_TEXT : LIGHT_TEXT;
    if (Math.max(darkRatio, lightRatio) > currentRatio + 0.35) forceColor(element, replacement);
  }

  function repair(contents) {
    const document = contents?.document;
    if (!document) return;
    restoreContrast(document);
    const settings = getSettings();
    if (settings.theme === "paper") return;
    const win = contents.window || document.defaultView;
    const body = document.body;
    if (!win || !body || body.isConnected === false) return;
    if (shouldInspect(body, win)) repairText(body, win, settings.theme);
    body.querySelectorAll("*").forEach(element => {
      if (shouldInspect(element, win)) repairText(element, win, settings.theme);
    });
  }

  function injectScrollChrome(contents) {
    const document = contents?.document;
    if (!document?.head) return;
    let style = document.getElementById("sg-scrollbar-hide");
    if (!style) {
      style = document.createElement("style");
      style.id = "sg-scrollbar-hide";
      style.textContent = "html,body{scrollbar-width:none!important;-ms-overflow-style:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}";
      document.head.appendChild(style);
    }
  }

  function injectReaderFonts(contents) {
    const document = contents?.document;
    if (!document?.head || document.getElementById("sg-reader-fonts")) return;
    const link = document.createElement("link");
    link.id = "sg-reader-fonts";
    link.rel = "stylesheet";
    link.href = READER_FONT_STYLESHEET;
    link.referrerPolicy = "no-referrer";
    document.head.appendChild(link);
  }

  function applyTypeface(contents) {
    const document = contents?.document;
    if (!document?.head) return;
    const family = READER_FONT_FAMILIES[getSettings()?.font] || "";
    let style = document.getElementById("sg-reader-typeface");
    if (!family) {
      style?.remove();
      return;
    }
    injectReaderFonts(contents);
    if (!style) {
      style = document.createElement("style");
      style.id = "sg-reader-typeface";
      document.head.appendChild(style);
    }
    style.textContent = `body{font-family:${family}!important}`;
  }

  function prepare(contents) {
    const settings = getSettings();
    applyTypeface(contents);
    if (settings.flow === "scrolled-doc") injectScrollChrome(contents);
    requestAnimationFrame(() => repair(contents));
  }

  function refresh(rendition) {
    if (!rendition?.getContents) return;
    requestAnimationFrame(() => {
      try {
        rendition.getContents().forEach(contents => {
          applyTypeface(contents);
          if (getSettings().flow === "scrolled-doc") injectScrollChrome(contents);
          repair(contents);
        });
      } catch (error) {
        console.warn("Reader theme refresh skipped", error);
      }
    });
  }

  function css(settings) {
    const themes = {
      garden: isAdult
        ? { bg: "#140d10", text: "#eadde1", link: "#d29aa9" }
        : { bg: "#120e19", text: "#e8e1f1", link: "#b9a8e3" },
      night: { bg: "#0c1020", text: "#e1e7f5", link: "#9db0ea" },
      black: { bg: "#000000", text: "#d7d7d7", link: isAdult ? "#d29aa9" : "#b9a8e3" },
      paper: { bg: "#ffffff", text: "#292a25", link: "#536e55" }
    };
    const theme = themes[settings.theme] || themes.garden;
    const paginated = settings.flow === "paginated";
    const body = {
      background: `${theme.bg} !important`,
      color: `${theme.text} !important`,
      "font-size": `${settings.fontSize}% !important`,
      "line-height": `${settings.lineHeight} !important`,
      margin: paginated ? "0 !important" : "0 auto !important",
      /* v2.6.4 owner decision (#160 item 2): the Continuous reading canvas itself ends
         where the seek rail begins (reader-continuous-rail.css sets .viewer{right}).
         v2.6.5 owner follow-up: the reserved rail column read as an extra-wide bar next
         to body side padding, so Continuous bodies drop horizontal padding entirely and
         media can bleed to the rail boundary; readable prose insets move to the text
         selectors below so full-page artwork is never indented twice. */
      padding: paginated ? "max(2.5em, 60px) 4vw max(2.5em, 54px) !important" : "2.5em 0 !important",
      "touch-action": paginated ? "pan-y pinch-zoom !important" : "auto !important",
      "box-sizing": "border-box !important"
    };
    if (paginated) {
      /* EPUB.js writes the exact page/column width inline. Never override that width in
         paginated mode or the content columns drift beyond the mobile viewport. */
      body["max-width"] = "none !important";
    } else {
      body["max-width"] = `${settings.width}px !important`;
      body.width = "auto !important";
      /* min-width overrides max-width in CSS resolution, so a publication rule such as
         body{min-width:600px} recreates a canvas wider than the viewport and every
         downstream width cap with it (#160). Reset it on the publication root. */
      body["min-width"] = "0 !important";
      /* No body-level overflow guard: the text-width body is a centered prose column, and
         Continuous artwork legitimately paints through the slack beside it. Containment
         (#160) is owned by the canvas boundaries instead — the iframe viewport, the html
         overflow guard, and the .epub-container/.viewer clipping, all of which end exactly
         where the structurally excluded seek-rail column begins. */
    }
    const blockCap = paginated ? {} : {
      /* Real books rarely wrap artwork in figure/picture alone; plain divs/sections/
         tables can carry fixed or viewport widths that keep feeding oversized boxes to
         nested media. Capping every common publication wrapper keeps the max-width chain
         intact from the padded body down to any nested media element (#160). min-width
         resets matter just as much: a single {min-width:900px} wrapper overrides this
         max-width cap outright and recreates an oversized canvas (#160). Media-only
         containers escape this cap through the bleed rules below, so the cap continues to
         own prose-carrying wrappers without re-imposing the text width on artwork. */
      "max-width": "100% !important",
      "min-width": "0 !important",
      "box-sizing": "border-box !important"
    };
    const mediaSanity = paginated ? {} : {
      /* Replaced media escapes every width cap when publication CSS positions it against
         the iframe viewport (position:absolute/fixed ignores body padding) or shifts it
         rightward with transforms. Full-bleed positioning of media is exactly the #160
         violation, so Continuous mode renders replaced media statically and untransformed;
         text-level decorations elsewhere are untouched. */
      position: "static !important",
      transform: "none !important",
      "min-width": "0 !important",
      "box-sizing": "border-box !important"
    };
    /* Continuous media is deliberately independent of the text-width setting: the column
       cap shapes prose, while artwork expands to the full reading canvas (100vw inside the
       EPUB iframe). Because a box wider than its containing block would otherwise stick out
       only to the right and be clipped by the canvas guards, the expansion re-centers with
       symmetric negative margins. The 100vw cap ends every expanded box exactly at the
       canvas edge, which structurally excludes the seek-rail column, so the #160
       containment contract still holds at any text width. Selectors are body-prefixed so
       the bleed outranks publication !important width rules at equal specificity. */
    const mediaBleed = {
      "max-width": "100vw !important",
      "width": "auto !important",
      "min-width": "0 !important",
      "margin-left": "calc((100% - 100vw) / 2) !important",
      "margin-right": "calc((100% - 100vw) / 2) !important",
      "padding-left": "0 !important",
      "padding-right": "0 !important",
      "box-sizing": "border-box !important"
    };
    const mediaBleedBlock = { ...mediaBleed, display: "block !important" };
    const supportsMediaOnlyBleed = (() => {
      try {
        return typeof window !== "undefined" && typeof window.CSS?.supports === "function"
          && window.CSS.supports("selector(div:has(> img:only-child))");
      } catch { return false; }
    })();
    /* epub.js's default content hook caps img/svg at 95% of the body height measured
       before the theme applies — a column-pagination helper that shrinks or letterboxes
       tall artwork in a scrolling canvas. Continuous mode releases that cap; Paginated
       keeps it because a page really cannot overflow vertically. */
    const mediaRelease = { "max-height": "none !important" };
    const mediaOnlySelectors = supportsMediaOnlyBleed
      ? ["div", "section", "article", "aside", "main", "p", "li"]
        .flatMap(tag => ["img", "svg", "video", "canvas", "object", "embed"].map(media => `body ${tag}:has(> ${media}:only-child)`))
        .join(", ")
      : "";
    const mediaOnlyCanvas = mediaOnlySelectors ? { [mediaOnlySelectors]: mediaBleed } : {};
    return {
      html: {
        background: `${theme.bg} !important`,
        /* The canvas-edge horizontal guard lives on the root: its clip boundary is the
           iframe viewport itself, so the text-width slack beside the prose column stays
           paintable for full-canvas artwork while nothing can reach past the canvas (#160). */
        ...(paginated ? {} : { "overflow-x": "clip !important", "min-width": "0 !important" })
      },
      body,
      p: { "line-height": `${settings.lineHeight} !important` },
      a: { color: `${theme.link} !important` },
      ...(paginated ? {} : {
        "div, section, article, aside, main, table, td, th": blockCap,
        "body figure, body picture": mediaBleedBlock,
        ...mediaOnlyCanvas,
        "body > img, body > svg, body > video, body > canvas, body > object, body > embed": mediaBleedBlock,
        "svg, video, canvas, object, embed": {
          ...mediaSanity,
          "max-width": "100% !important",
          ...mediaRelease
        },
        img: {
          ...mediaSanity,
          /* Inside a bleeded wrapper the 100% now resolves against the full canvas, so
             artwork scales to the reading canvas instead of the text-width column. */
          "max-width": "100% !important",
          ...mediaRelease,
          "height": "auto !important",
          "box-sizing": "border-box !important"
        },
        /* v2.6.5: prose keeps readable insets while artwork bleeds to the rail boundary;
           applying insets only to text selectors avoids double-indenting full-page media. */
        "p, li, dd, dt, blockquote, figcaption": {
          "padding-left": "14px !important",
          "padding-right": "14px !important"
        }
      })
    };
  }

  return { css, prepare, refresh, repair };
}
