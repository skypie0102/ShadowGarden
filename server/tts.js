import { bodyJson, fail, json, method, sameOrigin } from "./http.js";
import { cookies, HUMAN_COOKIE, verified, rateLimit } from "./security.js";
import {
  EDGE_DEFAULT_VOICE,
  EDGE_TEXT_LIMIT,
  listEdgeVoices,
  synthesizeEdgeSpeech,
  validEdgeVoice,
} from "./edge-speech.js";

export async function tts(context) {
  const { request } = context;
  method(request, ["GET", "POST"]);
  sameOrigin(request);
  if (request.method === "GET") {
    const key = new Request(new URL("/tts-voices-v2", request.url));
    const cache = globalThis.caches?.default,
      cached = await cache?.match(key);
    if (cached) return cached;
    try {
      const voices = await listEdgeVoices({
        signal: AbortSignal.timeout(15000),
      });
      const response = json(
        {
          ok: true,
          provider: "edge",
          defaultVoice: EDGE_DEFAULT_VOICE,
          voices,
        },
        200,
        { "cache-control": "public, max-age=3600" },
      );
      if (cache) context.waitUntil(cache.put(key, response.clone()));
      return response;
    } catch {
      fail(
        503,
        "tts_unavailable",
        "Edge voices are temporarily unavailable. Try again shortly.",
      );
    }
  }
  const body = await bodyJson(request, 12000);
  if (
    typeof body.text !== "string" ||
    !body.text.trim() ||
    body.text.length > EDGE_TEXT_LIMIT
  )
    fail(400, "invalid_tts_text", "Choose a shorter passage to read aloud.");
  if (!validEdgeVoice(body.voice))
    fail(400, "invalid_tts_voice", "Choose a valid Edge voice.");
  if (!(await verified(context.env, cookies(request)[HUMAN_COOKIE], "human")))
    fail(
      428,
      "human_verification_required",
      "Reopen the volume to renew your Garden Pass before reading aloud.",
    );
  await rateLimit(context, "tts", 240, 600);
  try {
    const audio = await synthesizeEdgeSpeech(body.text, body.voice, {
      signal: request.signal,
    });
    return new Response(audio, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    fail(
      503,
      "tts_unavailable",
      "Edge TTS could not read this passage. Check your connection and try again.",
    );
  }
}
