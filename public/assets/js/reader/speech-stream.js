// Keep narration on one native media timeline instead of ending/reloading the
// media element after every paragraph. Unsupported engines use clip playback.
export function createSpeechStream({ audio, signal, readNext, onPassage }) {
  const Type = globalThis.MediaSource;
  let media;
  try {
    if (!Type?.isTypeSupported?.("audio/mpeg")) return null;
    media = new Type();
  } catch { return null; }
  const url = URL.createObjectURL(media), controller = new AbortController();
  const lifetime = AbortSignal.any([signal, controller.signal]);
  let source, records = [], working = null, finished = false, failure = null, failedCursor = null;

  function wait(target, event, operation) {
    lifetime.throwIfAborted();
    return new Promise((resolve, reject) => {
      const clear = () => {
        target.removeEventListener(event, done);
        target.removeEventListener("error", failed);
        lifetime.removeEventListener("abort", aborted);
      };
      const done = () => { clear(); resolve(); };
      const failed = () => { clear(); reject(new Error("Audio could not play. Tap Retry.")); };
      const aborted = () => { clear(); reject(lifetime.reason); };
      target.addEventListener(event, done, { once: true });
      target.addEventListener("error", failed, { once: true });
      lifetime.addEventListener("abort", aborted, { once: true });
      try { operation?.(); } catch (error) { clear(); reject(error); }
    });
  }
  async function append(cursor, blob) {
    const bytes = await blob.arrayBuffer();
    lifetime.throwIfAborted();
    // Playback can advance while a slow future clip is being fetched. Trim
    // again at every append, even when a single pump spans many passages.
    const cutoff = Math.max(0, (records[0]?.start || 0) - 1);
    if (cutoff && source.buffered.length && source.buffered.start(0) < cutoff)
      await wait(source, "updateend", () => source.remove(0, cutoff));
    const start = records.at(-1)?.end || 0;
    await wait(source, "updateend", () => source.appendBuffer(bytes));
    lifetime.throwIfAborted();
    const end = source.buffered.length && source.buffered.end(source.buffered.length - 1);
    if (!(end > start)) throw new Error("Audio could not play. Tap Retry.");
    records.push({ cursor, start, end });
  }
  function finish(error) {
    failure = error || null;
    finished = true;
    // A future fetch failure is reported when listening reaches it. Already
    // buffered speech keeps playing; readable passages are never skipped.
    if (media.readyState === "open" && !source.updating) {
      try { media.endOfStream(); } catch (error) { failure ||= error; }
    }
  }
  function pump() {
    if (working || finished || lifetime.aborted) return;
    working = (async () => {
      // The same four-passage synthesis window feeds the native decoder. It
      // does not generate a second queue or download the entire publication.
      while (!finished && records.length < 5) {
        const next = await readNext(records.at(-1).cursor, lifetime);
        lifetime.throwIfAborted();
        if (!next) { finish(); break; }
        if (next.error) { failedCursor = next.cursor; finish(next.error); break; }
        failedCursor = next.cursor;
        await append(next.cursor, next.blob);
        failedCursor = null;
      }
    })().catch(error => {
      if (!lifetime.aborted) finish(error);
    }).finally(() => { working = null; });
  }
  function update() {
    if (lifetime.aborted || !records.length) return;
    let index = 0;
    while (index + 1 < records.length && audio.currentTime >= records[index + 1].start)
      index++;
    if (index) {
      records.splice(0, index);
      onPassage(records[0].cursor);
    }
    pump();
  }
  audio.addEventListener("timeupdate", update);
  lifetime.addEventListener("abort", () => audio.removeEventListener("timeupdate", update), { once: true });
  return {
    url,
    get error() { return failure; },
    get failedCursor() { return failedCursor; },
    async start(cursor, blob) {
      const opened = wait(media, "sourceopen");
      audio.src = url;
      await opened;
      lifetime.throwIfAborted();
      source = media.addSourceBuffer("audio/mpeg");
      source.mode = "sequence";
      await append(cursor, blob);
      pump();
    },
    dispose() {
      if (controller.signal.aborted) return;
      controller.abort();
      records = [];
      if (source?.updating && media.readyState === "open") {
        try { source.abort(); } catch {}
      }
      URL.revokeObjectURL(url);
    },
  };
}
