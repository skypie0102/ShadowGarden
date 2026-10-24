/* File-only EPUB replacement keeps Series Editor drafts and volume identity intact. */
(() => {
  const keeper = window.ShadowGardenKeeper;
  if (!keeper) return;

  keeper.registerWorkflow("volumeReplacement", () => {
    const root = document.querySelector("#manageVolumes"),
      library = keeper.workflows.get("library")?.instance,
      { client } = keeper;
    if (!root || !library) return {};
    let active = null;

    function status(card, message, kind = "") {
      const node = card.querySelector("[data-volume-replacement-status]");
      node.textContent = message;
      node.hidden = !message;
      node.dataset.kind = kind;
    }

    async function replace(card, file) {
      const context = library.editorContext();
      if (!context || !root.contains(card) || !client.isAuthorized()) return;
      if (active?.context === context) return;
      const bookId = card.dataset.volumeBookId,
        volume = library.findSeries(context.id)?.series.volumes.find(v => v.bookId === bookId);
      if (!volume) return;
      if (!/\.epub$/i.test(file.name)) {
        status(card, "Choose an EPUB file (.epub).", "error");
        return;
      }

      const operation = { context, card };
      active = operation;
      const current = () => active === operation && library.isCurrentEditor(context) &&
        root.contains(card) && library.findSeries(context.id)?.series.volumes.some(v => v.bookId === bookId);
      root.querySelectorAll("[data-volume-replace]").forEach(button => { button.disabled = true; });
      try {
        status(card, `Checking ${file.name}…`);
        const metadata = await keeper.epubInspection.inspect(file);
        if (!current()) return;
        if (!metadata.sha256 || metadata.validation?.status === "fail") {
          const detail = metadata.validation?.fatal?.map(issue => issue.message).join("; ");
          status(card, detail || "This EPUB failed structural preflight.", "error");
          return;
        }
        const warnings = metadata.validation?.warnings || [],
          warningText = warnings.length
            ? `\n\nEPUB warnings:\n${warnings.map(issue => `• ${issue.message}`).join("\n")}`
            : "";
        if (!confirm(`Replace the EPUB for “${volume.title || "this volume"}” with “${file.name}”?\n\nThe volume’s details and artwork will stay the same.${warningText}`)) {
          status(card, "Replacement cancelled.");
          return;
        }
        if (!current()) return;
        const epubKey = `shadow-garden/books/replacement_${crypto.randomUUID()}.epub`;
        status(card, `Uploading ${file.name}…`);
        await client.uploadObject(epubKey, file, "application/epub+zip");
        if (!current()) return;
        status(card, "Saving replacement…");
        const result = await client.request("/admin-api/library", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "replace-volume-file", id: context.id, bookId,
            epubKey, size: file.size, sha256: metadata.sha256, originalFilename: file.name })
        });
        if (!current()) return;
        library.update(result);
        const saved = library.findSeries(context.id)?.series.volumes.find(v => v.bookId === bookId);
        if (saved) card.querySelector(".volume-summary-copy span").textContent =
          [saved.date || "", keeper.util.fmtSize(saved.size)].filter(Boolean).join(" · ") || "No extra metadata";
        status(card, `EPUB replaced: ${file.name}`);
      } catch (error) {
        if (current()) status(card, error.message || "Could not replace this EPUB. Try again.", "error");
      } finally {
        if (active === operation) {
          active = null;
          if (library.isCurrentEditor(context))
            root.querySelectorAll("[data-volume-replace]").forEach(button => { button.disabled = false; });
        }
      }
    }

    root.addEventListener("click", event => {
      const button = event.target.closest("[data-volume-replace]");
      if (!button || button.disabled) return;
      const input = button.closest(".manage-volume").querySelector("[data-volume-epub]");
      input.value = "";
      input.click();
    });
    root.addEventListener("change", event => {
      const input = event.target.closest("[data-volume-epub]");
      if (!input?.files?.length) return;
      const file = input.files[0];
      input.value = "";
      void replace(input.closest(".manage-volume"), file);
    });
    keeper.events.addEventListener("session:locked", () => { active = null; });
    return {};
  });
})();
