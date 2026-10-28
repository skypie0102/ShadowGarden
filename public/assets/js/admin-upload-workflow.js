/* Shadow Garden — reviewed stateful New Books workflow. */
(() => {
  const dialog = document.querySelector("#addBooksDialog"),
    addView = document.querySelector("#addView");
  const q = state?.batch,
    list = document.querySelector("#batchList"),
    panel = document.querySelector("#batchPanel");
  const uploadState = document.querySelector("#uploadState"),
    uploadButton = document.querySelector("#uploadButton");
  const fileInput = document.querySelector("#epubFile"),
    preflight = document.querySelector("#preflightCard");
  if (
    !dialog ||
    !addView ||
    !q ||
    !list ||
    !panel ||
    !uploadState ||
    !uploadButton ||
    !fileInput ||
    !preflight
  )
    return;

  const esc = v =>
    String(v ?? "").replace(
      /[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  const arr = v => (Array.isArray(v) ? v : []);
  const trashSvg =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M7 7l1 13h8l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>';
  let mode = "edit",
    sessionIds = [],
    completedSeries = [],
    completionSnapshot = { successes: [], failures: [], items: [] },
    finishing = false;

  if (!document.querySelector('link[href*="/assets/css/admin-components.css?v=2.11.0"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/admin-components.css?v=2.11.0";
    link.dataset.adminComponents = "1";
    document.head.appendChild(link);
  }
  document.querySelector("#openSeries")?.classList.add("sg-legacy-open-series");

  const stage = document.createElement("section");
  stage.id = "uploadWorkflowStage";
  stage.className = "upload-workflow-stage hidden";
  stage.setAttribute("aria-live", "polite");
  addView.before(stage);

  const actionable = () =>
    q.items.filter(
      i =>
        i.metaReady && i.validation?.status !== "fail" && i.action !== "skip" && i.status !== "done"
    );

  function queueSummary() {
    const ready = actionable().length,
      failed = q.items.filter(i => i.validation?.status === "fail" || i.status === "failed").length,
      dupes = q.items.filter(i => i.duplicate).length;
    const summary = document.querySelector("#batchSummary");
    if (summary)
      summary.textContent = q.items.length
        ? `${q.items.length} selected · ${ready} upload · ${dupes} duplicate${dupes === 1 ? "" : "s"}${failed ? ` · ${failed} failed` : ""}`
        : "";
    panel.classList.toggle("hidden", !q.items.length);
    if (!q.running) {
      uploadButton.disabled = q.preparing || !ready;
      uploadButton.textContent = q.preparing
        ? "Checking selected EPUBs…"
        : ready
          ? `Upload ${ready} ${ready === 1 ? "Book" : "Books"}`
          : "Nothing to upload";
      document.querySelector("#uploadCard")?.classList.toggle("hidden", !q.items.length);
    }
    if (q.items.length) {
      const title = document.querySelector("#filePickerTitle"),
        meta = document.querySelector("#filePickerMeta");
      if (title)
        title.textContent = `${q.items.length} EPUB${q.items.length === 1 ? "" : "s"} in batch`;
      if (meta) meta.textContent = "Review duplicates and metadata, then upload the queue.";
    }
  }

  function batchReasons(a, b) {
    const reasons = [];
    if (a.sha256 && b.sha256 && a.sha256 === b.sha256) reasons.push("same file hash");
    if (
      typeof slug === "function" &&
      slug(a.series) === slug(b.series) &&
      Number(a.number) === Number(b.number)
    )
      reasons.push(`same series volume ${a.number}`);
    if (
      typeof slug === "function" &&
      slug(a.series) === slug(b.series) &&
      String(a.title || "")
        .trim()
        .toLowerCase() ===
        String(b.title || "")
          .trim()
          .toLowerCase()
    )
      reasons.push("same title");
    return [...new Set(reasons)];
  }

  function reconcileBatchDuplicates() {
    q.items.forEach(i => {
      if (i.duplicate?.batch) i.duplicate = null;
    });
    for (let a = 0; a < q.items.length; a++)
      for (let b = a + 1; b < q.items.length; b++) {
        const left = q.items[a],
          right = q.items[b];
        if (!left.metaReady || !right.metaReady) continue;
        const reasons = batchReasons(left, right);
        if (!reasons.length) continue;
        if (!left.duplicate) left.duplicate = { batch: true, reasons };
        if (!right.duplicate) right.duplicate = { batch: true, reasons };
      }
    q.items.forEach(i => {
      if (i.duplicate?.batch && i.action === "new") i.action = "skip";
      else if (
        !i.duplicate &&
        i.action === "skip" &&
        !i.userChoseSkip &&
        i.validation?.status !== "fail" &&
        i.status !== "failed"
      )
        i.action = "new";
    });
  }

  function duplicateCopy(item) {
    const d = item.duplicate;
    if (!d) return "";
    if (d.batch) return arr(d.reasons).join(" · ");
    return `${d.series?.title || "Existing series"} · ${d.volume?.title || `Volume ${d.volume?.number ?? "?"}`} · ${d.scope === "adult" ? "18+" : "Main"} · ${arr(d.reasons).join(", ")}`;
  }

  function destinationCopy(item) {
    const target = state.addBookTarget;
    const adult = target ? target.scope === "adult" : Boolean(item.adult);
    const title = target?.title || item.series || "Choose a series";
    const id = target?.id || `${adult ? "adult-" : ""}${slug(title)}`;
    const library = q.library || state.management;
    const existing = Boolean(target) || arr(library?.[adult ? "adult" : "main"])
      .some(series => series.id === id);
    return `Destination: ${adult ? "Adult Library" : "Main Library"} · ${title} · Volume ${item.number || "?"}${library || target ? ` · ${existing ? "Existing series" : "New series"}` : ""}`;
  }

  function actionCopy(item) {
    if (item.action === "skip") return "Skip this file. Nothing will be uploaded or replaced.";
    if (item.action === "replace")
      return "Replace the matched volume’s EPUB and metadata. Keep its book identity and reading links.";
    if (item.action === "separate")
      return "Add a separate volume entry. Keep any existing matched volume unchanged.";
    return "Add this EPUB to the destination above. Matching volumes are never replaced automatically.";
  }

  function itemOutcome(item) {
    if (item.status === "done") return { label: "Uploaded", kind: "done" };
    if (item.validation?.status === "fail") return {
      label: "Blocked · Invalid EPUB", kind: "blocked",
      detail: "Not uploaded. Repair or replace the EPUB before trying again."
    };
    if (item.status === "failed") return {
      label: "Upload failed · Retry available", kind: "failed",
      detail: `${item.error || "The upload did not finish."} Review the queue and retry. Uploaded files will not be sent again.`
    };
    if (item.status === "checking") return { label: "Checking EPUB", kind: "checking" };
    if (item.action === "skip") return { label: "Skipped · Not uploaded", kind: "skipped" };
    if (item.status === "uploading") return { label: item.progressLabel || "Uploading EPUB", kind: "uploading" };
    return { label: "Waiting to upload", kind: "waiting" };
  }

  function fileResults(items) {
    return `<ul class="upload-file-results" role="list" aria-label="Per-file upload results">${items.map(item => {
      const outcome = itemOutcome(item);
      return `<li data-upload-file="${esc(item.id)}" data-outcome="${outcome.kind}"><strong>${esc(item.title || item.file?.name || "EPUB")}</strong><small>${esc(destinationCopy(item))}</small><span class="upload-file-state">${esc(outcome.label)}</span>${outcome.detail ? `<p>${esc(outcome.detail)}</p>` : ""}</li>`;
    }).join("")}</ul>`;
  }

  function actionGuidance(item) {
    return `<p id="batch-action-help-${esc(item.id)}" class="batch-action-guidance">${esc(destinationCopy(item))}<br>${esc(actionCopy(item))}</p>`;
  }

  function decorateDuplicate(article, item) {
    const block = article.querySelector(".batch-duplicate");
    if (!block) return;
    if (!item.duplicate) {
      article.classList.remove("has-duplicate");
      block.hidden = !item.metaReady || item.status === "done";
      if (!block.hidden)
        block.innerHTML = `<label>Queue action<select data-batch-action="${esc(item.id)}" aria-describedby="batch-action-help-${esc(item.id)}" ${q.running ? "disabled" : ""}><option value="new"${item.action !== "skip" ? " selected" : ""}>Upload</option><option value="skip"${item.action === "skip" ? " selected" : ""}>Skip</option></select></label>${actionGuidance(item)}`;
      return;
    }
    article.classList.add("has-duplicate");
    block.hidden = false;
    const options = item.duplicate.batch
      ? `<option value="skip"${item.action === "skip" ? " selected" : ""}>Skip</option><option value="separate"${item.action === "separate" ? " selected" : ""}>Add separate</option>`
      : `<option value="skip"${item.action === "skip" ? " selected" : ""}>Skip</option><option value="replace"${item.action === "replace" ? " selected" : ""}>Replace existing</option><option value="separate"${item.action === "separate" ? " selected" : ""}>Add separate</option>`;
    block.innerHTML = `<label>Duplicate action<select data-batch-action="${esc(item.id)}" aria-describedby="batch-action-help-${esc(item.id)}" ${q.running || item.status === "done" ? "disabled" : ""}>${options}</select></label><p>${esc(duplicateCopy(item))}</p>${actionGuidance(item)}`;
  }

  function enhanceQueue() {
    for (const article of list.querySelectorAll(":scope > .batch-item")) {
      const item = q.items.find(i => i.id === article.dataset.batchId);
      if (!item) continue;
      const actions = article.querySelector(".batch-actions");
      if (actions && !actions.querySelector("[data-batch-remove]")) {
        const remove = document.createElement("button");
        remove.className = "batch-remove";
        remove.type = "button";
        remove.dataset.batchRemove = item.id;
        remove.innerHTML = trashSvg;
        remove.title = "Remove from upload queue";
        remove.setAttribute("aria-label", "Remove EPUB from upload queue");
        actions.appendChild(remove);
      }
      const remove = actions?.querySelector("[data-batch-remove]");
      if (remove) remove.disabled = q.running || item.status === "uploading";
      decorateDuplicate(article, item);
    }
    queueSummary();
    window.ShadowGardenKeeper.events.dispatchEvent(new Event("upload:view-rendered"));
  }

  function emptyEditor() {
    document.querySelector("#metadataCard")?.classList.add("hidden");
    preflight.classList.add("hidden");
    document.querySelector("#uploadCard")?.classList.add("hidden");
    document.querySelector("#batchEditorPicker")?.classList.add("hidden");
    if (typeof setFileState === "function") setFileState("WAITING");
    fileInput.value = "";
    const title = document.querySelector("#filePickerTitle"),
      meta = document.querySelector("#filePickerMeta");
    if (title) title.textContent = "Choose EPUBs from this device";
    if (meta) meta.textContent = "Select one or many EPUBs · 50 MB maximum per file";
  }

  function removeItem(id) {
    if (q.running) return;
    const index = q.items.findIndex(i => i.id === id);
    if (index < 0) return;
    const active = q.activeId === id;
    q.items.splice(index, 1);
    if (active) {
      q.activeId = null;
      if (q.objectUrl) {
        try {
          URL.revokeObjectURL(q.objectUrl);
        } catch {}
        q.objectUrl = "";
      }
    }
    list.querySelector(`[data-batch-id="${CSS.escape(id)}"]`)?.remove();
    reconcileBatchDuplicates();
    enhanceQueue();
    window.ShadowGardenKeeper.events.dispatchEvent(new Event("upload:queue-rendered"));
    if (!q.items.length) {
      emptyEditor();
      return;
    }
    if (active) {
      const next = q.items.find(i => i.metaReady);
      if (next)
        queueMicrotask(() =>
          list.querySelector(`[data-batch-edit="${CSS.escape(next.id)}"]`)?.click()
        );
    }
  }
  list.addEventListener(
    "click",
    event => {
      const button = event.target.closest("[data-batch-remove]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      removeItem(button.dataset.batchRemove);
    },
    true
  );

  const pHead = preflight.querySelector(".admin-card-head"),
    pToggle = document.createElement("button");
  pToggle.className = "preflight-collapse-toggle";
  pToggle.type = "button";
  pToggle.setAttribute("aria-controls", "preflightChecks");
  pHead?.appendChild(pToggle);
  function collapsePreflight(collapsed = true) {
    preflight.classList.toggle("sg-preflight-collapsed", collapsed);
    pToggle.setAttribute("aria-expanded", String(!collapsed));
    pToggle.title = collapsed ? "Show preflight details" : "Hide preflight details";
    pToggle.setAttribute("aria-label", pToggle.title);
    pToggle.innerHTML = `<span aria-hidden="true">${collapsed ? "▼" : "▲"}</span><b>Details</b>`;
  }
  collapsePreflight(true);
  pToggle.addEventListener("click", () =>
    collapsePreflight(!preflight.classList.contains("sg-preflight-collapsed"))
  );
  list.addEventListener(
    "click",
    e => {
      if (e.target.closest("[data-batch-edit]")) queueMicrotask(() => collapsePreflight(true));
    },
    true
  );
  document
    .querySelector("#batchEditorSelect")
    ?.addEventListener("change", () => queueMicrotask(() => collapsePreflight(true)));

  const showStage = () => {
    dialog.classList.add("sg-workflow-stage");
    stage.classList.remove("hidden");
    const scroller = dialog.querySelector(".dialog-scroll");
    if (scroller) scroller.scrollTop = 0;
  };
  function showEditor() {
    mode = "edit";
    dialog.classList.remove("sg-workflow-stage");
    stage.classList.add("hidden");
    stage.innerHTML = "";
    if (!q.items.length) {
      emptyEditor();
      if (typeof setUploadState === "function") setUploadState("WAITING");
      if (typeof setStatus === "function")
        setStatus("Ready to upload", "Choose one or more EPUBs to begin.", "✦");
    } else if (typeof setUploadState === "function") {
      const ready = actionable().length;
      setUploadState(ready ? "READY" : "WAITING", ready ? "ready" : "");
      const editor = q.items.find(item => item.id === q.activeId && item.metaReady)
        || q.items.find(item => item.metaReady);
      if (editor) queueMicrotask(() => list.querySelector(`[data-batch-edit="${CSS.escape(editor.id)}"]`)?.click());
    }
  }

  function renderUploading() {
    showStage();
    stage.innerHTML = `<div class="upload-state-card upload-state-uploading"><div class="upload-state-mark" aria-hidden="true">✦</div><p class="kicker">PLANTING BOOKS</p><h2>Uploading to the Garden</h2><p id="uploadStageDetail">Preparing the batch for private storage…</p><div class="upload-stage-progress" role="progressbar" aria-label="Batch processing progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="upload-stage-meta"><span id="uploadStagePercent">0%</span><span id="uploadStageCount">0 / ${sessionIds.length}</span></div><div id="uploadFileResults">${fileResults(q.items)}</div></div>`;
    updateUploading();
  }

  function updateUploading() {
    if (mode !== "uploading") return;
    const items = sessionIds.map(id => q.items.find(i => i.id === id)).filter(Boolean),
      total = Math.max(1, items.length);
    const progress =
        items.reduce((n, i) => n + (["done", "failed"].includes(i.status) ? 100 : Math.max(0, Math.min(100, Number(i.progress) || 0))), 0) / total,
      done = items.filter(i => i.status === "done").length,
      failed = items.filter(i => i.status === "failed").length,
      current =
        items.find(i => i.status === "uploading") ||
        items.find(i => i.status !== "done" && i.status !== "failed");
    const track = stage.querySelector(".upload-stage-progress");
    track?.style.setProperty("--upload-stage-progress", `${progress.toFixed(1)}%`);
    track?.setAttribute("aria-valuenow", String(Math.round(progress)));
    const results = stage.querySelector("#uploadFileResults");
    if (results) results.innerHTML = fileResults(q.items);
    const pct = stage.querySelector("#uploadStagePercent"),
      count = stage.querySelector("#uploadStageCount"),
      detail = stage.querySelector("#uploadStageDetail");
    if (pct) pct.textContent = `${Math.round(progress)}%`;
    if (count) count.textContent = `${done} uploaded · ${failed} failed · ${items.length - done - failed} remaining`;
    if (detail)
      detail.textContent = current?.progressLabel
        ? `${current.title || current.file?.name || "EPUB"} — ${current.progressLabel}`
        : done + failed === items.length
          ? "Finishing batch results…"
          : "Preparing the next EPUB…";
  }

  function seriesFrom(items) {
    const map = new Map();
    for (const item of items) {
      const id = item.result?.seriesId;
      if (!id) continue;
      if (!map.has(id))
        map.set(id, {
          id,
          title: state.addBookTarget?.title || item.series || item.result?.seriesTitle || "Uploaded series",
          adult: state.addBookTarget ? state.addBookTarget.scope === "adult" : Boolean(item.adult),
          books: 0
        });
      map.get(id).books++;
    }
    return [...map.values()];
  }

  function clearSuccessfulQueue() {
    const remaining = q.items.filter(item => item.status !== "done");
    q.items.splice(0, q.items.length, ...remaining);
    if (!remaining.some(item => item.id === q.activeId)) q.activeId = null;
    q.library = null;
    if (q.objectUrl) {
      try {
        URL.revokeObjectURL(q.objectUrl);
      } catch {}
      q.objectUrl = "";
    }
    for (const article of list.querySelectorAll(":scope > .batch-item")) {
      if (!remaining.some(item => item.id === article.dataset.batchId)) article.remove();
    }
    if (!remaining.length) list.innerHTML = "";
    panel.classList.toggle("hidden", !remaining.length);
    fileInput.value = "";
    const summary = document.querySelector("#batchSummary");
    if (summary) summary.textContent = "";
    document.querySelector("#metadataCard")?.classList.add("hidden");
    preflight.classList.add("hidden");
    document.querySelector("#uploadCard")?.classList.add("hidden");
    document.querySelector("#batchEditorPicker")?.classList.add("hidden");
    window.ShadowGardenKeeper.events.dispatchEvent(new Event("upload:queue-rendered"));
  }

  function renderComplete(successes, failures) {
    const success = failures.length === 0 && successes.length === sessionIds.length;
    const remaining = q.items.filter(item => item.status !== "done");
    const allDone = success && remaining.length === 0;
    mode = allDone ? "complete" : "partial";
    completedSeries = seriesFrom(successes);
    showStage();
    const summary = success
      ? `${successes.length} book${successes.length === 1 ? " was" : "s were"} uploaded successfully${allDone ? " and the upload queue has been cleared." : "."}`
      : `${successes.length} uploaded · ${failures.length} failed.`;
    const remainingCopy = remaining.length
      ? ` ${remaining.length} file${remaining.length === 1 ? " remains" : "s remain"} in the queue for review. Uploaded files will not be sent again.` : "";
    stage.innerHTML = `<div class="upload-state-card ${allDone ? "upload-state-complete" : "upload-state-partial"}"><div class="upload-state-mark" aria-hidden="true">${allDone ? "✓" : "△"}</div><p class="kicker">${allDone ? "UPLOAD COMPLETE" : "BATCH FINISHED"}</p><h2>${allDone ? "The new books have taken root." : failures.length ? "Some books need attention." : "Uploads finished."}</h2><p>${esc(summary + remainingCopy)}</p><div class="upload-state-actions">${completedSeries.length ? '<button id="workflowOpenSeries" class="admin-primary" type="button">Open uploaded series</button>' : ""}<button id="workflowNextBatch" class="admin-secondary" type="button">${allDone ? "Upload another batch" : "Review upload queue"}</button></div>${fileResults(completionSnapshot.items)}</div>`;
    if (success) clearSuccessfulQueue();
    window.ShadowGardenKeeper.events.dispatchEvent(new Event("upload:view-rendered"));
    stage
      .querySelector("#workflowOpenSeries")
      ?.addEventListener("click", () =>
        completedSeries.length === 1
          ? location.assign(`/series.html?id=${encodeURIComponent(completedSeries[0].id)}&scope=${completedSeries[0].adult ? "adult" : "main"}`)
          : renderChooser()
      );
    stage.querySelector("#workflowNextBatch")?.addEventListener("click", showEditor);
  }

  function renderChooser() {
    mode = "chooser";
    showStage();
    stage.innerHTML = `<div class="upload-state-card upload-state-complete"><div class="upload-state-mark" aria-hidden="true">✦</div><p class="kicker">UPLOADED SERIES</p><h2>Choose a series to open</h2><p>This batch added books to ${completedSeries.length} series.</p><div class="upload-series-grid">${completedSeries.map(s => `<button class="upload-series-choice" type="button" data-open-uploaded-series="${esc(s.id)}"><strong>${esc(s.title)}</strong><span>${s.adult ? "18+ Library" : "Main Library"} · ${s.books} uploaded book${s.books === 1 ? "" : "s"}</span></button>`).join("")}</div><div class="upload-state-actions"><button id="workflowChooserBack" class="admin-secondary" type="button">◀ Back</button><button id="workflowChooserNext" class="admin-secondary" type="button">${q.items.some(item => item.status !== "done") ? "Review upload queue" : "Upload another batch"}</button></div></div>`;
    window.ShadowGardenKeeper.events.dispatchEvent(new Event("upload:view-rendered"));
    stage
      .querySelectorAll("[data-open-uploaded-series]")
      .forEach(b =>
        b.addEventListener("click", () =>
          location.assign(`/series.html?id=${encodeURIComponent(b.dataset.openUploadedSeries)}&scope=${completedSeries.find(series => series.id === b.dataset.openUploadedSeries)?.adult ? "adult" : "main"}`)
        )
      );
    stage
      .querySelector("#workflowChooserBack")
      ?.addEventListener("click", () =>
        renderComplete(completionSnapshot.successes, completionSnapshot.failures)
      );
    stage.querySelector("#workflowChooserNext")?.addEventListener("click", showEditor);
  }

  function beginUpload() {
    if (mode === "uploading") return;
    const items = actionable();
    if (!items.length) return;
    sessionIds = items.map(i => i.id);
    completedSeries = [];
    finishing = false;
    mode = "uploading";
    renderUploading();
  }
  function finishUpload() {
    if (mode !== "uploading" || finishing) return;
    finishing = true;
    const items = sessionIds.map(id => q.items.find(i => i.id === id)).filter(Boolean),
      successes = items.filter(i => i.status === "done"),
      failures = items.filter(i => i.status === "failed" || i.validation?.status === "fail");
    completionSnapshot = { successes: [...successes], failures: [...failures], items: [...q.items] };
    renderComplete(successes, failures);
    finishing = false;
  }
  function syncState() {
    const text = String(
      window.ShadowGardenKeeper.state.uploadStatus?.label || uploadState.textContent || ""
    )
      .trim()
      .toUpperCase();
    if (text === "UPLOADING") {
      beginUpload();
      updateUploading();
      return;
    }
    if (text.startsWith("COMPLETE")) {
      finishUpload();
      return;
    }
  }

  window.ShadowGardenKeeper.events.addEventListener("upload:queue-rendered", () =>
    queueMicrotask(() => {
      enhanceQueue();
      updateUploading();
      syncState();
    })
  );
  window.ShadowGardenKeeper.events.addEventListener("upload:state", () =>
    queueMicrotask(syncState)
  );
  dialog.addEventListener("close", () => {
    if (mode !== "uploading") showEditor();
  });
  dialog.addEventListener("cancel", e => {
    if (mode === "uploading") e.preventDefault();
  });
  enhanceQueue();
})();
