import {
  createReaderScope,
  readerContentsScope,
  readerInstanceScope,
} from "./lifecycle.js";
import { readJSON, writeJSON } from "./storage.js";
import { createSpeechSource } from "./speech-source.js";
import { recordReaderDiagnostic } from "./diagnostics.js";

const KEY = "sg-reader-speech-settings",
  DEFAULT_VOICE = "en-US-EmmaMultilingualNeural";
const SILENCE =
  "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==";
export function speechSettings(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) value = {};
  return {
    voice:
      typeof value.voice === "string" &&
      /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9-]+Neural$/.test(value.voice)
        ? value.voice
        : DEFAULT_VOICE,
    speed: Number.isFinite(Number(value.speed))
      ? Math.max(0.5, Math.min(2, Number(value.speed)))
      : 1,
    follow: value.follow !== false,
  };
}
export function createSpeechController({
  elements,
  getBook,
  getCfi,
  getSpineIndex,
  navigate,
  openDrawer,
}) {
  const scope = createReaderScope(),
    audio = elements.speechAudio;
  const source = createSpeechSource({ getBook, getCfi, getSpineIndex });
  let settings = speechSettings(readJSON(KEY, {})),
    cursor = null,
    status = "idle",
    wantPlay = false,
    revision = 0,
    request = null,
    objectUrl = "",
    pending = null,
    followAbort = null,
    followTarget = "",
    followedCfi = "",
    voiceLoad = null,
    voicesLoaded = false,
    ahead = null;
  const entry = () => cursor?.entries[cursor.index];
  const active = () =>
    ["loading", "playing", "paused", "error"].includes(status);
  function render(message) {
    const running = wantPlay && ["playing", "loading"].includes(status);
    elements.speechPlay.textContent = running
      ? "Pause"
      : status === "paused"
        ? "Resume"
        : status === "error"
          ? "Retry"
          : "Play";
    elements.speechMiniPlay.textContent = running ? "Ⅱ" : "▶";
    elements.speechMiniPlay.setAttribute(
      "aria-label",
      running ? "Pause read aloud" : "Resume read aloud",
    );
    elements.speechToggle.setAttribute("aria-pressed", String(active()));
    elements.speechMini.hidden = !active();
    elements.speechStop.disabled = !active();
    elements.speechMiniStop.disabled = !active();
    elements.speechPrevious.disabled = !cursor;
    elements.speechNext.disabled = !cursor;
    elements.speechStatus.textContent =
      message ||
      {
        idle: "Ready to read from your current position.",
        loading: wantPlay ? "Preparing speech…" : "Paused.",
        playing: "Reading aloud",
        paused: "Paused.",
        error: "Speech stopped. Try again.",
        complete: "Volume finished.",
      }[status];
    elements.speechMiniLabel.textContent =
      status === "error"
        ? "Read aloud needs attention"
        : status === "loading"
          ? "Preparing speech…"
          : status === "paused"
            ? "Read aloud paused"
            : "Reading aloud";
    elements.speechPassage.textContent = entry()?.text || "";
    audio.playbackRate = settings.speed;
    audio.preservesPitch = true;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState =
        status === "playing"
          ? "playing"
          : status === "paused"
            ? "paused"
            : "none";
      const title = elements.bookTitle?.textContent || document.title;
      if (
        active() &&
        typeof MediaMetadata === "function" &&
        navigator.mediaSession.metadata?.title !== title
      )
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist: "Shadow Garden",
          album: "Read aloud",
        });
      if (!active()) navigator.mediaSession.metadata = null;
    }
  }
  function save() {
    writeJSON(KEY, settings);
  }
  function releaseAudio() {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = "";
  }
  function invalidate() {
    revision++;
    cancelFollow();
    request?.abort();
    request = null;
    pending = null;
    ahead?.controller.abort();
    ahead = null;
  }
  function stop(message) {
    invalidate();
    wantPlay = false;
    cursor = null;
    followedCfi = "";
    status = "idle";
    releaseAudio();
    render(message);
  }
  function pause() {
    if (!active()) return;
    cancelFollow();
    followedCfi = "";
    wantPlay = false;
    audio.pause();
    status = "paused";
    render();
  }
  function unlock() {
    // Reuse one media element across chunks, including mobile gesture priming.
    if (audio.getAttribute("src")) return;
    audio.src = SILENCE;
    const started = audio.play();
    started
      ?.then(() => {
        if (audio.getAttribute("src") === SILENCE) audio.pause();
      })
      .catch(() => {});
  }
  async function fetchAudio(text, voice, signal) {
    const response = await fetch("/tts", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, voice }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(50000)]),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(
        error?.error ||
          "Edge TTS is unavailable. Check your connection and try again.",
      );
    }
    if (!response.headers.get("content-type")?.startsWith("audio/mpeg"))
      throw new Error("Edge TTS returned no audio. Try again.");
    const blob = await response.blob();
    if (!blob.size || blob.size > 1024 * 1024)
      throw new Error("Edge TTS returned invalid audio. Try again.");
    return blob;
  }
  const keyFor = (position, voice) =>
    `${position.spineIndex}:${position.index}:${voice}`;
  function prefetch() {
    ahead?.controller.abort();
    ahead = null;
    if (!cursor || cursor.index + 1 >= cursor.entries.length || !wantPlay)
      return;
    const next = { ...cursor, index: cursor.index + 1 },
      controller = new AbortController();
    const candidate = {
      key: keyFor(next, settings.voice),
      controller,
      promise: null,
    };
    candidate.promise = fetchAudio(
      next.entries[next.index].text,
      settings.voice,
      controller.signal,
    ).then(
      (blob) => ({ blob }),
      () => ({ blob: null }),
    );
    ahead = candidate;
  }
  function cancelFollow() {
    followAbort?.abort();
    followAbort = null;
    followTarget = "";
  }
  function followPassage() {
    const selected = entry();
    if (
      !selected ||
      (!objectUrl && status !== "complete") ||
      !settings.follow ||
      document.hidden ||
      !["playing", "paused", "complete"].includes(status) ||
      followedCfi === selected.cfi ||
      (followAbort && followTarget === selected.cfi)
    )
      return;
    cancelFollow();
    const controller = new AbortController(),
      serial = revision;
    followAbort = controller;
    followTarget = selected.cfi;
    // Audio does not await rendering: animation frames may stop in a hidden tab.
    void Promise.resolve()
      .then(() => {
        if (scope.disposed || serial !== revision || controller.signal.aborted)
          return false;
        return navigate(selected.cfi, {
          speech: true,
          signal: controller.signal,
        });
      })
      .then((moved) => {
        if (moved && serial === revision && !controller.signal.aborted)
          followedCfi = selected.cfi;
      })
      .catch(() => {
        if (!scope.disposed && !controller.signal.aborted)
          recordReaderDiagnostic("speech.followFailed");
      })
      .finally(() => {
        if (followAbort === controller) {
          followAbort = null;
          followTarget = "";
        }
      });
  }
  async function resumeAudio(serial) {
    if (!wantPlay || serial !== revision || scope.disposed) return;
    try {
      await audio.play();
      if (serial !== revision || scope.disposed) return;
      // A pause can arrive while play() is waiting for the browser.
      if (!wantPlay) {
        audio.pause();
        status = "paused";
      } else status = "playing";
      render();
      if (wantPlay) {
        prefetch();
        followPassage();
      }
    } catch (error) {
      if (serial !== revision || scope.disposed) return;
      wantPlay = false;
      status = error.name === "NotAllowedError" ? "paused" : "error";
      render(
        error.name === "NotAllowedError"
          ? "Tap Resume to allow audio playback."
          : "Audio could not play. Tap Retry.",
      );
    }
  }
  async function prepare({ fromCurrent = false, direction = 0 } = {}) {
    const cached = ahead;
    ahead = null;
    invalidate();
    releaseAudio();
    const serial = revision,
      controller = new AbortController();
    request = controller;
    const cancelCached = () => cached?.controller.abort();
    controller.signal.addEventListener("abort", cancelCached, { once: true });
    const current = () =>
      serial === revision && !scope.disposed && !controller.signal.aborted;
    status = "loading";
    render();
    const task = (async () => {
      try {
        const next =
          fromCurrent || !cursor
            ? await source.current({ signal: controller.signal })
            : direction
              ? await source.move(cursor, direction, {
                  signal: controller.signal,
                })
              : cursor;
        if (!current()) return;
        if (!next) {
          wantPlay = false;
          status = direction < 0 ? "paused" : "complete";
          render(
            direction < 0
              ? "Beginning of the volume."
              : cursor
                ? "Volume finished."
                : "No readable text found.",
          );
          followPassage();
          return;
        }
        cursor = next;
        render();
        const selected = entry(),
          voice = settings.voice;
        const matching = cached?.key === keyFor(cursor, voice);
        if (cached && !matching) cached.controller.abort();
        const blob =
          (matching ? (await cached.promise).blob : null) ||
          (await fetchAudio(selected.text, voice, controller.signal));
        if (!current()) return;
        objectUrl = URL.createObjectURL(blob);
        audio.src = objectUrl;
        audio.playbackRate = settings.speed;
        if (status === "error") return;
        if (wantPlay) await resumeAudio(serial);
        else {
          status = "paused";
          render();
        }
      } catch (error) {
        if (!current()) return;
        wantPlay = false;
        status = "error";
        render(error.message || "Edge TTS is unavailable. Try again.");
      } finally {
        controller.signal.removeEventListener("abort", cancelCached);
        if (cached && cached !== ahead) cached.controller.abort();
        if (serial === revision) {
          request = null;
          pending = null;
        }
      }
    })();
    pending = task;
    await task;
  }
  function play() {
    if (wantPlay && ["loading", "playing"].includes(status)) {
      pause();
      return;
    }
    unlock();
    wantPlay = true;
    if (pending) {
      status = "loading";
      render();
      return;
    }
    if (cursor && objectUrl && status === "paused") {
      void resumeAudio(revision);
      return;
    }
    void prepare({ fromCurrent: !cursor || status === "complete" });
  }
  function move(direction) {
    unlock();
    wantPlay = true;
    void prepare({ direction });
  }
  async function loadVoices() {
    if (voicesLoaded || voiceLoad) return voiceLoad;
    const task = (async () => {
      elements.speechVoicesRetry.hidden = true;
      try {
        const response = await fetch("/tts", {
          credentials: "same-origin",
          signal: AbortSignal.any([scope.signal, AbortSignal.timeout(18000)]),
        });
        if (!response.ok) throw new Error("Voices unavailable");
        const data = await response.json();
        if (!Array.isArray(data.voices) || !data.voices.length)
          throw new Error("Voices unavailable");
        if (scope.disposed) return;
        const select = elements.speechVoice,
          groups = new Map();
        const voices = data.voices.filter((v) =>
          /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9-]+Neural$/.test(v.id),
        );
        if (!voices.length) throw new Error("Voices unavailable");
        select.replaceChildren();
        voices.sort(
          (a, b) =>
            (a.locale.startsWith("en") ? 0 : 1) -
              (b.locale.startsWith("en") ? 0 : 1) ||
            a.locale.localeCompare(b.locale) ||
            a.id.localeCompare(b.id),
        );
        if (!voices.some((v) => v.id === settings.voice))
          settings.voice =
            voices.find((v) => v.id === DEFAULT_VOICE)?.id ||
            voices[0]?.id ||
            DEFAULT_VOICE;
        for (const voice of voices) {
          let group = groups.get(voice.locale);
          if (!group) {
            group = document.createElement("optgroup");
            group.label = voice.locale;
            groups.set(voice.locale, group);
            select.append(group);
          }
          const option = document.createElement("option");
          option.value = voice.id;
          option.textContent = `${voice.id
            .split("-")
            .slice(2)
            .join("-")
            .replace(/Neural$/, "")} · ${voice.gender || voice.locale}`;
          group.append(option);
        }
        select.value = settings.voice;
        save();
        voicesLoaded = true;
        elements.speechVoiceHint.textContent =
          "English voices appear first. Other languages are available below.";
      } catch {
        if (!scope.disposed) {
          elements.speechVoicesRetry.hidden = false;
          elements.speechVoiceHint.textContent =
            "Could not load the full voice list. The selected voice is still available to try.";
        }
      } finally {
        voiceLoad = null;
      }
    })();
    voiceLoad = task;
    return task;
  }
  scope.listen(elements.speechToggle, "click", () => {
    openDrawer(elements.speechDrawer);
    void loadVoices();
  });
  scope.listen(elements.speechMiniSettings, "click", () => {
    openDrawer(elements.speechDrawer);
    void loadVoices();
  });
  scope.listen(elements.speechVoicesRetry, "click", () => void loadVoices());
  for (const button of [elements.speechPlay, elements.speechMiniPlay])
    scope.listen(button, "click", play);
  for (const button of [elements.speechStop, elements.speechMiniStop])
    scope.listen(button, "click", () => stop());
  scope.listen(elements.speechHere, "click", () => {
    unlock();
    wantPlay = true;
    void prepare({ fromCurrent: true });
  });
  scope.listen(elements.speechNext, "click", () => move(1));
  scope.listen(elements.speechPrevious, "click", () => move(-1));
  scope.listen(audio, "ended", () => {
    if (wantPlay && objectUrl && !pending) void prepare({ direction: 1 });
  });
  scope.listen(audio, "error", () => {
    if (objectUrl && audio.currentSrc === objectUrl && status !== "idle") {
      wantPlay = false;
      status = "error";
      render("Audio could not play. Tap Retry.");
    }
  });
  scope.listen(elements.speechVoice, "change", () => {
    settings.voice = elements.speechVoice.value;
    save();
    if (cursor) {
      wantPlay = false;
      void prepare();
    }
  });
  scope.listen(elements.speechSpeed, "change", () => {
    settings.speed = Number(elements.speechSpeed.value);
    save();
    render();
  });
  scope.listen(elements.speechFollow, "change", () => {
    settings.follow = elements.speechFollow.checked;
    if (settings.follow) followPassage();
    else cancelFollow();
    save();
  });
  scope.listen(document, "visibilitychange", () => {
    if (document.hidden) cancelFollow();
    else followPassage();
  });
  scope.listen(window, "pagehide", () => pause());
  // Only user input cancels follow. Relocation events can arrive late while a
  // new chapter is loading and are not evidence of a manual navigation.
  for (const type of ["wheel", "touchstart", "pointerdown"])
    scope.listen(
      elements.viewer,
      type,
      () => {
        if (wantPlay) pause();
      },
      { passive: true },
    );
  if ("mediaSession" in navigator) {
    const actions = {
      play: () => {
        if (!wantPlay) play();
      },
      pause,
      stop: () => stop(),
      previoustrack: () => move(-1),
      nexttrack: () => move(1),
    };
    for (const [name, handler] of Object.entries(actions)) {
      try {
        navigator.mediaSession.setActionHandler(name, handler);
      } catch {}
    }
    scope.add(() => {
      for (const name of Object.keys(actions)) {
        try {
          navigator.mediaSession.setActionHandler(name, null);
        } catch {}
      }
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.metadata = null;
    });
  }
  elements.speechVoice.replaceChildren(
    new Option(settings.voice, settings.voice),
  );
  elements.speechSpeed.value = String(settings.speed);
  elements.speechFollow.checked = settings.follow;
  render();
  scope.add(() => {
    invalidate();
    releaseAudio();
    elements.speechMini.hidden = true;
    elements.speechToggle.setAttribute("aria-pressed", "false");
  });
  return {
    stop,
    pause,
    dispose: () => scope.dispose(),
    attachRendition(rendition) {
      readerInstanceScope(rendition).hook(
        rendition.hooks.content,
        (contents) => {
          const lifetime = readerContentsScope(rendition, contents);
          for (const type of ["wheel", "touchstart", "pointerdown"])
            lifetime.listen(
              contents.document,
              type,
              () => {
                if (wantPlay) pause();
              },
              { passive: true },
            );
        },
      );
    },
    get state() {
      return {
        status,
        wantPlay,
        spineIndex: cursor?.spineIndex,
        index: cursor?.index,
        settings: { ...settings },
      };
    },
  };
}
