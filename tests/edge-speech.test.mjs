import { test } from "node:test";
import assert from "node:assert/strict";
import { edgeToken } from "../server/edge-token.js";
import {
  EDGE_DEFAULT_VOICE,
  audioFrame,
  listEdgeVoices,
  speechMessages,
  synthesizeEdgeSpeech,
} from "../server/edge-speech.js";
import { tts } from "../server/tts.js";
import { endpoint } from "../server/http.js";
import { fixture, context } from "./helpers.mjs";
import { HUMAN_COOKIE, signed } from "../server/security.js";

// Golden v2 results produced by the pinned upstream Python implementation.
test("Edge protocol v2 hashes match upstream across five-minute boundaries", () => {
  assert.equal(
    edgeToken(0),
    "52BC7A17B50DFEC9-28C4394775C8751CD2F6859C030C06DB1489ACAB3B3A7651831FC26895177ED6",
  );
  assert.equal(
    edgeToken(1700000000),
    "2CD23A2CA0B2595A-F3C846C370E05F9CC83ACC5F995C5F5D87A4D0F14CE8936A0F902E64099E38A2",
  );
  assert.equal(
    edgeToken(1792886400),
    "2F2D8708751D5556-8E32DB36070AE20B4B78221E6018B8275D7603FAE03023A4F46F3CA613A5EB8A",
  );
  assert.equal(edgeToken(1792886699), edgeToken(1792886400));
  assert.equal(
    edgeToken(1792886700),
    "6D3D73CA516994D3-C47EC8BCECD688904BBC5E1768E0223CC4848561C68AC2F1FC33CA778C49C56D",
  );
});
function frame(data = [1, 2, 3]) {
  const header = new TextEncoder().encode(
    "Path:audio\r\nContent-Type:audio/mpeg\r\n",
  );
  const bytes = new Uint8Array(2 + header.length + data.length);
  new DataView(bytes.buffer).setUint16(0, header.length);
  bytes.set(header, 2);
  bytes.set(data, 2 + header.length);
  return bytes.buffer;
}
class Socket extends EventTarget {
  closed = false;
  commands = [];
  onSend = () => {};
  accept() {}
  send(command) {
    this.commands.push(command);
    if (this.commands.length === 2) queueMicrotask(() => this.onSend());
  }
  close() {
    this.closed = true;
  }
  message(data) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}
test("speech escapes EPUB text, accepts regional voices, and parses only bounded MP3 frames", () => {
  const commands = speechMessages(
    '<voice name="bad"> & café\u0000',
    "zh-CN-liaoning-XiaobeiNeural",
  );
  assert.match(commands[1], /zh-CN-liaoning, XiaobeiNeural/);
  assert.match(commands[1], /&lt;voice name=&quot;bad&quot;&gt; &amp; café<\/prosody>/);
  assert.deepEqual([...audioFrame(frame())], [1, 2, 3]);
  assert.throws(() => audioFrame(new Uint8Array([1]).buffer));
  assert.throws(() => audioFrame(new Uint8Array([255, 255, 1]).buffer));
});
test("speech waits for turn.end, assembles frames and releases the socket", async () => {
  const socket = new Socket();
  socket.onSend = () => {
    socket.message(frame());
    socket.message(frame([4]));
    socket.message("Path:turn.end\r\n\r\n");
  };
  const audio = await synthesizeEdgeSpeech(
    "Hello",
    "en-US-EmmaMultilingualNeural",
    { fetcher: async () => ({ status: 101, webSocket: socket }) },
  );
  assert.deepEqual([...audio], [1, 2, 3, 4]);
  assert.equal(socket.closed, true);
  assert.equal(socket.binaryType, "arraybuffer");
});
test("unspeakable input is rejected before opening a provider connection", async () => {
  let connections = 0;
  for (const text of ["❦", "✦ ❧ ⁂", "***", "\u0000\ud800", "a".repeat(1201)])
    await assert.rejects(synthesizeEdgeSpeech(text, EDGE_DEFAULT_VOICE, {
      fetcher: async () => { connections++; throw Error("Unexpected connection"); },
    }), TypeError);
  assert.equal(connections, 0);
});
test("speech fails closed on early close, no audio, oversized audio and timeout", async () => {
  for (const scenario of ["close", "empty", "large", "timeout"]) {
    const socket = new Socket();
    socket.onSend = () => {
      if (scenario === "close") socket.dispatchEvent(new Event("close"));
      if (scenario === "empty") socket.message("Path:turn.end\r\n\r\n");
      if (scenario === "large")
        socket.message(frame(new Uint8Array(1024 * 1024 + 1)));
    };
    await assert.rejects(
      synthesizeEdgeSpeech("Hello", "en-US-EmmaMultilingualNeural", {
        fetcher: async () => ({ status: 101, webSocket: socket }),
        timeout: scenario === "timeout" ? 5 : 1000,
      }),
    );
    assert.equal(socket.closed, true);
  }
});
test("aborting a pending speech request closes its socket", async () => {
  const controller = new AbortController(),
    socket = new Socket();
  socket.onSend = () => controller.abort();
  await assert.rejects(
    synthesizeEdgeSpeech("Hello", "en-US-EmmaMultilingualNeural", {
      signal: controller.signal,
      fetcher: async () => ({ status: 101, webSocket: socket }),
    }),
    { name: "AbortError" },
  );
  assert.equal(socket.closed, true);
});
test("clock correction retries once using the provider date and discards its error body", async () => {
  const socket = new Socket(),
    urls = [];
  socket.onSend = () => {
    socket.message(frame());
    socket.message("Path:turn.end\r\n\r\n");
  };
  await synthesizeEdgeSpeech("Hello", "en-US-EmmaMultilingualNeural", {
    fetcher: async (url) => {
      urls.push(new URL(url));
      return urls.length === 1
        ? new Response("Rejected", {
            status: 403,
            headers: { date: new Date(1700000000000).toUTCString() },
          })
        : { status: 101, webSocket: socket };
    },
  });
  assert.equal(urls.length, 2);
  assert.equal(urls[1].searchParams.get("Sec-MS-GEC"), edgeToken(1700000000));
});
test("voice catalogue strips upstream fields and rejects invalid payloads", async () => {
  assert.deepEqual(
    await listEdgeVoices({
      fetcher: async () =>
        Response.json([
          {
            ShortName: "en-US-EmmaMultilingualNeural",
            Locale: "en-US",
            Gender: "Female",
            Secret: "not returned",
          },
        ]),
    }),
    [
      {
        id: "en-US-EmmaMultilingualNeural",
        name: "en-US-EmmaMultilingualNeural",
        locale: "en-US",
        gender: "Female",
      },
    ],
  );
  await assert.rejects(
    listEdgeVoices({ fetcher: async () => new Response("[]") }),
  );
});
test("TTS endpoint rejects cross-origin, unauthenticated and unbounded requests before synthesis", async (t) => {
  const env = fixture();
  t.after(() => env.DB.sqlite.close());
  const call = endpoint(tts),
    body = { text: "Hello", voice: "en-US-EmmaMultilingualNeural" };
  assert.equal(
    (
      await call(
        context(env, "/tts", "POST", body, { origin: "https://other.test" }),
      )
    ).status,
    403,
  );
  assert.equal((await call(context(env, "/tts", "POST", body))).status, 428);
  for (const text of ["❦", "✦ ❧ ⁂", "***", "\u0000\ud800"])
    assert.equal((await call(context(env, "/tts", "POST", { ...body, text }))).status, 400);
  assert.equal(
    (
      await call(
        context(env, "/tts", "POST", { ...body, text: "a".repeat(1201) }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        context(env, "/tts", "POST", { ...body, voice: "en-US-<xml>Neural" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await call(context(env, "/tts", "POST", "a".repeat(12001)))).status,
    413,
  );
  assert.equal((await call(context(env, "/tts", "PUT", body))).status, 405);
  assert.equal(
    env.DB.sqlite.prepare("SELECT COUNT(*) count FROM rate_limits").get().count,
    0,
  );
});
test("voice metadata publishes Brian as the default without reusing the old cached default", async (t) => {
  const env = fixture();
  t.after(() => env.DB.sqlite.close());
  let cacheKey = "";
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "caches", descriptor);
    else delete globalThis.caches;
  });
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
    async match(key) { cacheKey = key.url; return undefined; },
    async put() {},
  } } });
  t.mock.method(globalThis, "fetch", async () => Response.json([
    { ShortName: EDGE_DEFAULT_VOICE, Locale: "en-US", Gender: "Male" },
  ]));
  const background = [];
  const response = await endpoint(tts)({ ...context(env, "/tts"), waitUntil: task => background.push(task) });
  await Promise.all(background);
  const body = await response.json();
  assert.equal(body.defaultVoice, "en-US-BrianMultilingualNeural");
  assert.ok(body.voices.some(v => v.id === body.defaultVoice && v.gender === "Male"));
  assert.equal(new URL(cacheKey).pathname, "/tts-voices-v2");
});
test("authenticated TTS returns private audio and increments only the speech rate limit", async (t) => {
  const env = fixture();
  t.after(() => env.DB.sqlite.close());
  const socket = new Socket();
  socket.onSend = () => {
    socket.message(frame());
    socket.message("Path:turn.end\r\n\r\n");
  };
  t.mock.method(globalThis, "fetch", async () => ({
    status: 101,
    webSocket: socket,
  }));
  const human = await signed(env, "human", {}, 3600);
  const response = await endpoint(tts)(
    context(
      env,
      "/tts",
      "POST",
      { text: "❦ Hello\u0000 ❧", voice: "en-US-EmmaMultilingualNeural" },
      { cookie: `${HUMAN_COOKIE}=${human}` },
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.match(socket.commands[1], />Hello<\/prosody>/);
  assert.doesNotMatch(socket.commands[1], /[❦❧\u0000]/u);
  assert.deepEqual(
    [...new Uint8Array(await response.arrayBuffer())],
    [1, 2, 3],
  );
  assert.equal(
    env.DB.sqlite.prepare("SELECT COUNT(*) count FROM rate_limits").get().count,
    1,
  );
});
