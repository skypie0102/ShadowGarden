import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSpeechText } from "../public/assets/js/reader/speech-source.js";
import { speechSettings } from "../public/assets/js/reader/speech-controller.js";
import { prepareSpeechText } from "../public/assets/js/reader/speech-text.js";

test("speech skips decorative-only text while keeping every script and meaningful symbols", () => {
  for (const text of ["❦", "❧ ☙ ✦ ⁂", "***", "— … —", "😀", "\u0301", "\u0000\ud800\uffff", " "])
    assert.equal(prepareSpeechText(text), "");
  for (const text of ["café — ‘hello’…", "e\u0301", "漢字。العربية हिन्दी", "𐐀", "Ⅻ ⑴", "20°C, $5, 2 × 3 = 6 & 25%", "Hello 😀!"])
    assert.equal(prepareSpeechText(text), text);
  assert.equal(prepareSpeechText("After ❦ the ❧ divider."), "After the divider.");
  assert.equal(prepareSpeechText("Hello❦\ufe0fworld"), "Hello world");
});
test("speech removes incompatible XML characters and joins discretionary word breaks", () => {
  assert.equal(prepareSpeechText("A\u0000B\u000bC\ud800D\udc00E\ufffeF\uffffG"), "A B C D E F G");
  assert.equal(prepareSpeechText("Inter\u00adna\u200btional\u2060\ufeff text.\nNext\tline."), "International text. Next line.");
  assert.equal(prepareSpeechText(null), "");
  assert.equal(prepareSpeechText(42), "");
});

test("speech chunks preserve text, bound long paragraphs and avoid broken surrogate pairs", () => {
  for (const text of [
    "A short sentence.",
    "One sentence. ".repeat(200),
    "漢字".repeat(2000),
    "😀".repeat(1400),
    "<voice> & punctuation?\nNext line.",
  ]) {
    const chunks = splitSpeechText(text);
    assert.ok(chunks.every((c) => c.length > 0 && c.length <= 1000));
    assert.ok(
      chunks.every(
        (c) => !/[\uD800-\uDBFF]$/.test(c) && !/^[\uDC00-\uDFFF]/.test(c),
      ),
    );
    assert.equal(chunks.join("").replace(/\s/g, ""), text.replace(/\s/g, ""));
  }
  assert.deepEqual(splitSpeechText("  \n "), []);
});
test("read aloud preferences have an Edge default, bounded speed and no autoplay state", () => {
  assert.deepEqual(speechSettings(), {
    voice: "en-US-BrianMultilingualNeural",
    speed: 1,
    follow: true,
  });
  assert.deepEqual(
    speechSettings({ voice: "<bad>", speed: 99, follow: false, playing: true }),
    { voice: "en-US-BrianMultilingualNeural", speed: 2, follow: false },
  );
  assert.equal(speechSettings({ speed: "bad" }).speed, 1);
  assert.deepEqual(speechSettings(null), speechSettings());
});
test("read aloud keeps English regional voices and replaces saved non-English voices", () => {
  for (const voice of ["en-US-EmmaMultilingualNeural", "en-US-GuyNeural", "en-GB-SoniaNeural", "en-AU-NatashaNeural"])
    assert.equal(speechSettings({ voice }).voice, voice);
  for (const voice of ["fr-FR-DeniseNeural", "ja-JP-NanamiNeural", "ar-SA-ZariyahNeural"])
    assert.equal(speechSettings({ voice }).voice, speechSettings().voice);
});
