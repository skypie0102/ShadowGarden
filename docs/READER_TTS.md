# Reader read aloud

Edge TTS is the first and default speech provider. Optional offline models are
deferred to a later release. This is an unofficial online Read
Aloud service, not an Azure Speech subscription, and it has no service guarantee.

## Reader behavior

- Open the themed headphone control to select an English voice and speed, then Play.
  Voices are grouped by region. Saved non-English voices fall back to Emma.
- Play starts at the current passage. Read from here restarts from the current
  reading position. Pause/Resume retains the current audio offset.
- Previous/Next changes passages. Playback advances through linear EPUB spine
  sections, skips image-only sections, and stops at the end of the volume.
- Follow reading position centers the spoken passage in both Pages and Continuous.
  Its highlight follows Garden, Night, Black and Paper, including Adult rose.
  Pausing keeps the highlight; Stop and leaving the reader remove it. Manual navigation
  stops narration; touching or scrolling EPUB content pauses narration. Closing
  the speech drawer keeps playback controls in a compact floating bar, ordered
  Play/Pause, Previous passage, settings, Next passage, Stop.
- Following a loaded passage in the current chapter uses one eased scroll rather than navigating to its
  top and then centering it. Pause, Stop, manual input and newer navigation cancel
  pending animation. Reduced-motion preferences use immediate positioning.
- Starting or resuming playback closes the Read aloud options. Reopening options
  during playback keeps them open across automatic passage changes.
- Voice, speed and follow preferences persist in `sg-reader-speech-settings`.
  Reloading never starts playback automatically. Speech does not use or override
  paragraph alignment, typography, or page-map settings.
- Leaving/disposal closes requests, pauses audio and revokes object URLs.
  Audio advancement does not await page rendering. Hidden tabs defer position
  following until visible again, including the final passage after completion.
  Browser background/Bluetooth playback depends on the browser/OS. Media Session
  exposes play, pause, previous passage, next passage and stop where supported.

## Boundaries

`speech-source.js` reads leased EPUB section sources and emits paragraph CFIs
and bounded text chunks. It excludes scripts, ruby pronunciation, hidden markup,
navigation and semantic footnotes. Long paragraphs split at sentence/word
boundaries without splitting Unicode surrogate pairs. Each chunk has its own
original-text CFI range, including normalized whitespace and inline markup. Source extraction is
semantic; it cannot resolve every arbitrary publisher CSS visibility rule.

`speech-controller.js` owns one audio element, an abort/revision boundary, the
active blob and at most one prefetched passage. Late fetches and playback
promises cannot resume a stopped/replaced session. No synthesized audio is
persisted to local storage or sent to object storage.
`speech-position.js` paints live ranges with Custom Highlight, with the existing
EPUB SVG annotation API as its compatibility fallback. It leaves publisher text,
source CFIs and page measurement intact. Continuous uses owned scroll restoration;
Pages temporarily offset the rendered viewport. Continuous adds outer viewport
gutters so the first and last passages can be centered too. Those offsets/gutters
are released when following is disabled, speech stops or the rendition closes.
The navigation owner first asks the position controller to follow an already
rendered range in the current chapter; chapter changes and off-page ranges retain
EPUB display so background-return location and chapter state stay authoritative.
Animation interpolates the semantic range position using owned scroll restoration,
so viewport gutters and Continuous buffering do not introduce a preliminary jump.

Position following has its own abortable navigation scope; suspended animation
frames cannot block the audio queue. Pausing, hiding the page or stopping cancels
an in-flight follow without cancelling speech merely because layout is delayed.

`GET /tts` returns a sanitized voice list cached for an hour. `POST /tts` accepts
only same-origin JSON, a current Garden Pass human session, a valid voice and
at most 1,200 UTF-16 code units. Existing D1 rate-limit storage bounds synthesis
to 240 requests per ten minutes per network client. The body is capped at 12 KB;
audio at 1 MiB; synthesis at 45 seconds. No book catalog or media storage changes
are required. Audio responses are private and `no-store`.

`server/edge-speech.js` translates the public Edge protocol to bounded MP3
responses. It handles one clock-corrected retry after 403 and requires a completed
audio turn. `server/edge-token.js` is an isolated LGPL-3.0-only JavaScript port of
the upstream v2 protocol hash; see `licenses/edge-tts/UPSTREAM.md` and licenses.
No Azure key, Python service, new bucket or extra hosting service is required.

The drawer explains that passages are sent to Microsoft. Service/network failures
keep the reader usable and offer Retry. Custom Azure emotion/SSML controls are
not exposed because this endpoint does not support arbitrary SSML.

## Validation

Run `npm run check` and the five-profile Playwright suite. The audit verifies
that every Function is covered by the published Pages invocation manifest.
Production acceptance also checks live voice metadata and the Garden Pass,
text-length, origin and method rejection guards without book text or credentials. The speech browser
fixture uses deterministic media events to check ownership and navigation;
an additional native MP3 test checks decoding, paused offsets and invalid-media
errors without replacing media methods. Firefox's headless test mutes output
to avoid requiring a physical audio device. These are distinct from real
provider/audio checks. A successful live provider
probe must also verify the voice list and generated MP3, then a deployed Pages
probe must establish that the Cloudflare egress path is accepted. Android/Soul
hardware testing is separate from browser emulation.
