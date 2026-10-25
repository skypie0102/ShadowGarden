const keyFor = (cursor, voice) => `${cursor.spineIndex}:${cursor.index}:${voice}`;
const before = (a, b) =>
  a.spineIndex < b.spineIndex ||
  (a.spineIndex === b.spineIndex && a.index < b.index);

// Audio stays in memory for this narration session. Source traversal leases EPUB
// sections; it never displays a chapter or moves the user's reading position.
export function createSpeechBuffer({ source, fetchAudio }) {
  const entries = new Map(), active = new Set();
  let voice = "", anchor = "", generation = 0, planning = null;
  function cancel(candidate) {
    candidate.controller.abort();
    candidate.resolve(null);
  }
  function clear() {
    generation++;
    planning?.abort();
    planning = null;
    for (const candidate of entries.values()) cancel(candidate);
    for (const candidate of active) cancel(candidate);
    entries.clear();
    voice = anchor = "";
  }
  function start(candidate) {
    if (candidate.state !== "queued") return;
    candidate.state = "loading";
    active.add(candidate);
    void Promise.resolve()
      .then(() => {
        candidate.controller.signal.throwIfAborted();
        return fetchAudio(candidate.cursor.entries[candidate.cursor.index].text,
          candidate.voice, candidate.controller.signal);
      })
      .then(blob => candidate.resolve(candidate.controller.signal.aborted ? null : blob),
        () => candidate.resolve(null))
      .finally(() => {
        active.delete(candidate);
        candidate.state = "done";
        pump();
      });
  }
  function pump() {
    let count = [...active].filter(candidate => candidate.generation === generation).length;
    for (const candidate of entries.values()) {
      if (count >= 2) break;
      if (candidate.state === "queued") { start(candidate); count++; }
    }
  }
  function align(cursor, selectedVoice) {
    const key = keyFor(cursor, selectedVoice);
    if (voice !== selectedVoice || (anchor !== key && !entries.has(key))) clear();
    planning?.abort();
    const cached = entries.get(key);
    entries.delete(key);
    for (const [key, candidate] of entries) {
      if (before(candidate.cursor, cursor)) {
        cancel(candidate);
        entries.delete(key);
      }
    }
    voice = selectedVoice;
    anchor = key;
    return cached;
  }
  function fill(cursor) {
    const controller = new AbortController(), selectedVoice = voice;
    planning = controller;
    // A speculative failure is retried only if playback reaches that passage.
    // It must not stop the audio that is already playing.
    void (async () => {
      let next = cursor;
      for (let i = 0; i < 4; i++) {
        next = await source.move(next, 1, { signal: controller.signal });
        controller.signal.throwIfAborted();
        if (!next) break;
        const key = keyFor(next, selectedVoice);
        if (!entries.has(key)) {
          const candidate = {
            cursor: next, voice: selectedVoice, generation,
            controller: new AbortController(), state: "queued", resolve: null,
          };
          candidate.promise = new Promise(resolve => { candidate.resolve = resolve; });
          entries.set(key, candidate);
        }
        pump();
      }
    })().catch(() => {}).finally(() => {
      if (planning === controller) planning = null;
    });
  }
  return {
    clear,
    prefetch(cursor, selectedVoice) {
      align(cursor, selectedVoice);
      fill(cursor);
    },
    async read(cursor, selectedVoice, { signal, preload = true }) {
      signal.throwIfAborted();
      const cached = align(cursor, selectedVoice);
      const abort = () => { if (cached) cancel(cached); };
      signal.addEventListener("abort", abort, { once: true });
      try {
        // A requested passage takes priority over speculative work.
        if (cached) start(cached);
        if (preload) fill(cursor);
        const blob = cached ? await cached.promise : null;
        signal.throwIfAborted();
        return blob || await fetchAudio(cursor.entries[cursor.index].text, selectedVoice, signal);
      } finally {
        signal.removeEventListener("abort", abort);
      }
    },
  };
}
