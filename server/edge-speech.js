import { EDGE_CLIENT_TOKEN, edgeToken } from "./edge-token.js";
import { prepareSpeechText } from "../public/assets/js/reader/speech-text.js";

// Public Edge Read Aloud protocol. This is an online, unofficial service; keep
// it isolated so provider changes do not affect reader navigation or EPUB data.
const BASE =
  "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud";
const VERSION = "143.0.3650.75";
const MAX_AUDIO_BYTES = 1024 * 1024;
const decoder = new TextDecoder();
export const EDGE_TEXT_LIMIT = 1200;
export const EDGE_DEFAULT_VOICE = "en-US-BrianMultilingualNeural";
const voicePattern =
  /^[a-z]{2,3}-[A-Z]{2}-(?:[A-Za-z0-9]+-)?[A-Za-z0-9]+Neural$/;
export function validEdgeVoice(value) {
  return (
    typeof value === "string" && value.length <= 100 && voicePattern.test(value)
  );
}
const uid = () => crypto.randomUUID().replaceAll("-", "");
function headers() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
    "Accept-Language": "en-US,en;q=0.9",
    Cookie: `muid=${uid().toUpperCase()};`,
  };
}
function url(path, seconds) {
  const result = new URL(BASE + path);
  result.searchParams.set("TrustedClientToken", EDGE_CLIENT_TOKEN);
  result.searchParams.set("Sec-MS-GEC", edgeToken(seconds));
  result.searchParams.set("Sec-MS-GEC-Version", `2-${VERSION}`);
  return result;
}
export function speechMessages(text, voice) {
  const [, language, region, names] = voice.match(/^([a-z]+)-([A-Z]{2})-(.+)$/);
  // Match the service's long voice name, including regional variants.
  const parts = names.split("-"),
    name = parts.pop();
  const locale = [language, region, ...parts].join("-");
  const escape = (value) =>
    value.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    );
  const timestamp = new Date().toUTCString();
  return [
    `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" }, outputFormat: "audio-24khz-48kbitrate-mono-mp3" } } } })}\r\n`,
    `X-RequestId:${uid()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${locale}'><voice name='Microsoft Server Speech Text to Speech Voice (${locale}, ${name})'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escape(prepareSpeechText(text))}</prosody></voice></speak>`,
  ];
}
export function audioFrame(data) {
  const bytes = new Uint8Array(data);
  if (bytes.length < 2) throw new Error("Invalid speech frame");
  const length = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint16(0);
  if (length + 2 > bytes.length) throw new Error("Invalid speech frame");
  const header = decoder.decode(bytes.subarray(2, length + 2));
  if (!/(?:^|\r\n)Path:audio(?:\r\n|$)/i.test(header))
    throw new Error("Invalid speech frame");
  const audio = bytes.subarray(length + 2);
  if (
    audio.length &&
    !/(?:^|\r\n)Content-Type:audio\/mpeg(?:\r\n|$)/i.test(header)
  )
    throw new Error("Invalid speech audio");
  return audio;
}
async function connect(path, { signal, fetcher, websocket = false }) {
  let seconds = Date.now() / 1000;
  for (let attempt = 0; attempt < 2; attempt++) {
    const target = url(path, seconds);
    if (websocket) target.searchParams.set("ConnectionId", uid());
    const response = await fetcher(target.href, {
      headers: {
        ...headers(),
        ...(websocket
          ? {
              Upgrade: "websocket",
              Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
            }
          : {}),
      },
      signal,
      redirect: "manual",
    });
    if (response.status !== 403 || attempt) return response;
    const date = Date.parse(response.headers.get("date"));
    await response.body?.cancel();
    if (!Number.isFinite(date)) throw new Error("Speech connection rejected");
    seconds = date / 1000;
  }
}
export async function listEdgeVoices({ signal, fetcher = fetch } = {}) {
  const response = await connect("/voices/list", { signal, fetcher });
  if (!response.ok || !response.body)
    throw new Error("Speech voices unavailable");
  // The voice list is bounded independently of an upstream Content-Length.
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error("Speech voice list too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const input = JSON.parse(decoder.decode(bytes));
  if (!Array.isArray(input)) throw new Error("Invalid speech voice list");
  const voices = input
    .filter((v) => validEdgeVoice(v.ShortName))
    .map((v) => ({
      id: v.ShortName,
      name: String(v.FriendlyName || v.ShortName).slice(0, 200),
      locale: String(v.Locale || "").slice(0, 30),
      gender: String(v.Gender || "").slice(0, 20),
    }));
  if (!voices.length) throw new Error("Speech voices unavailable");
  return voices;
}
export async function synthesizeEdgeSpeech(
  text,
  voice,
  { signal, fetcher = fetch, timeout = 45000 } = {},
) {
  if (typeof text !== "string" || text.length > EDGE_TEXT_LIMIT || !validEdgeVoice(voice))
    throw new TypeError("Invalid speech request");
  text = prepareSpeechText(text);
  if (!text)
    throw new TypeError("Invalid speech request");
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(
    () => controller.abort(new Error("Speech timed out")),
    timeout,
  );
  let socket;
  try {
    controller.signal.throwIfAborted();
    const response = await connect("/edge/v1", {
      signal: controller.signal,
      fetcher,
      websocket: true,
    });
    socket = response.webSocket;
    if (response.status !== 101 || !socket) {
      await response.body?.cancel();
      throw new Error("Speech connection unavailable");
    }
    socket.binaryType = "arraybuffer";
    controller.signal.throwIfAborted();
    return await new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0,
        settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        socket.removeEventListener("message", message);
        socket.removeEventListener("close", closed);
        socket.removeEventListener("error", failed);
        controller.signal.removeEventListener("abort", cancelled);
        try {
          socket.close(1000, "Done");
        } catch {}
        if (error) {
          reject(error);
          return;
        }
        if (!size) {
          reject(new Error("No speech audio received"));
          return;
        }
        const audio = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          audio.set(chunk, offset);
          offset += chunk.byteLength;
        }
        resolve(audio);
      };
      const message = (event) => {
        try {
          if (typeof event.data === "string") {
            if (/(?:^|\r\n)Path:turn.end(?:\r\n|$)/.test(event.data)) finish();
          } else {
            const audio = audioFrame(event.data);
            size += audio.byteLength;
            if (size > MAX_AUDIO_BYTES)
              throw new Error("Speech audio too large");
            if (audio.length) chunks.push(audio);
          }
        } catch (error) {
          finish(error);
        }
      };
      const closed = () => finish(new Error("Speech connection closed early"));
      const failed = () => finish(new Error("Speech connection failed"));
      const cancelled = () =>
        finish(
          controller.signal.reason ||
            new DOMException("Cancelled", "AbortError"),
        );
      socket.addEventListener("message", message);
      socket.addEventListener("close", closed);
      socket.addEventListener("error", failed);
      controller.signal.addEventListener("abort", cancelled, { once: true });
      try {
        socket.accept();
        for (const command of speechMessages(text, voice)) socket.send(command);
      } catch (error) {
        finish(error);
      }
      if (controller.signal.aborted) cancelled();
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    try {
      socket?.close(1000, "Done");
    } catch {}
  }
}
