# Reader read aloud

Edge TTS is the first and default speech provider. Optional offline models are
deferred to a later release. This is an unofficial online Read
Aloud service, not an Azure Speech subscription, and it has no service guarantee.

## Reader behavior

- Open the themed headphone control to select an English voice and speed, then Play.
  Voices are grouped by region. BrianMultilingual · Male is the default. Saved
  English selections are retained; invalid or non-English selections fall back to Brian.
- Play starts at the current passage. Read from here restarts from the current
  reading position. Pause/Resume retains the current audio offset.
- Previous/Next changes passages. Playback advances through linear EPUB spine
  sections, skips image-only sections, and stops at the end of the volume.
- Follow reading position centers the spoken passage in both Pages and Continuous.
  Its highlight follows Garden, Night, Black and Paper, including Adult rose.
  Pausing keeps the highlight; Exit (X) and leaving the reader remove it. Browsing
  with touch, a wheel, the scrollbar or scroll keys inside the book suspends
  screen-following while narration and preloading continue. Following stays
  suspended across passage/chapter changes and Pause/Resume until the status
  control is tapped or Follow reading position is enabled in settings. The status
  control smoothly returns to the current spoken passage and enables following
  without restarting audio or resuming an explicitly paused recording. Explicit
  page buttons and TOC/seek navigation still stop narration; Pages-mode wheel
  and swipe browsing keep it playing. Closing the speech drawer keeps
  controls in a floating bar, ordered status/return to passage, Previous,
  Play/Pause, Next, Exit (X), settings cog. On narrow screens, the status occupies
  the first row and five icon controls share the second; all targets remain 44px.
- Playback controls use theme-colored SVGs in the drawer and floating bar:
  Play has a triangle, Pause has two bars, Previous/Next use skip icons with end
  bars, and Exit uses an X. Playback state changes preserve the SVGs while
  updating the visible drawer label and accessible floating-button action.
- Following a loaded passage in the current chapter uses one eased scroll rather than navigating to its
  top and then centering it. Pause, Stop, manual input and newer navigation cancel
  pending animation. Browsing suspension is separate from the persisted Follow
  preference and resets for a new Read from here session. Reduced-motion
  preferences use immediate positioning.
- Starting or resuming playback closes the Read aloud options. Reopening options
  during playback keeps them open across automatic passage changes.
- Voice, speed and follow preferences persist in `sg-reader-speech-settings`.
  Reloading never starts playback automatically. Speech does not use or override
  paragraph alignment, typography, or page-map settings.
- Leaving/disposal closes requests, pauses audio and revokes object URLs.
  Audio advancement does not await page rendering. Hidden tabs defer position
  following until visible again, including the final passage after completion.
  Hiding the page or locking the screen does not explicitly pause narration.
  Media Session exposes the book title, play, pause, previous passage, next
  passage and stop where supported, including lock-screen/headset controls.
  A requested playback session stays marked playing during preparation rather
  than briefly disappearing between passages. The optional Audio Session API
  declares narration as `playback`; Exit, completion, errors and disposal restore
  its prior type. Pause retains the session and audio offset.
  Background playback still depends on the browser/OS. A website cannot override
  a browser that suspends its tab, a force-closed browser, calls/audio-focus
  interruptions or device power restrictions. Physical Android/Soul and iOS
  screen-lock acceptance is separate from browser emulation.

Platform contracts: [Media Session](https://www.w3.org/TR/mediasession/),
[Audio Session](https://www.w3.org/TR/audio-session/) and
[MPEG audio byte streams](https://w3c.github.io/mse-byte-stream-format-mpeg-audio/).

## Preparing speech

The Reader extracts bounded text passages from the EPUB and sends each passage
with its selected voice to the same-origin `POST /tts` Function. The Function
requests an MP3 from Microsoft's online Edge Read Aloud service, waits for a complete
audio turn, then returns the clip to the Reader's single reusable audio element.
When the browser supports MPEG audio through Media Source Extensions, successive
clips are appended to one native media timeline. The element keeps the same
source across automatic passage and chapter boundaries, allowing buffered speech
to continue without a JavaScript `ended`/reload/play handoff for every paragraph.
Passage highlighting follows media time. The decoder holds the current passage
plus up to four upcoming passages and one second of retained prior audio.
It evicts older audio before each append, including after slow synthesis,
and shares the existing
synthesis buffer. Unsupported engines retain clip playback, with no explicit
pause, source removal or `load()` at natural passage boundaries.
Decorative-only paragraphs and chapters, including scene breaks such as `❦`,
`✦` and `***`, are omitted from the speech cursor and preload window. Inline
fleurons/star ornaments are removed from the synthesis copy. Discretionary
hyphens and invisible word breaks are joined, incompatible XML characters are
removed, and ordinary punctuation, accents, non-Latin letters, numbers, units,
currency and mathematical symbols in readable text are preserved. The original
publication text, markup and highlight/CFI ranges stay intact. The same text
preparation runs before browser requests and in the provider adapter; requests
with no readable text are rejected before authentication/rate-limit writes or
opening a synthesis connection. Genuine provider/network errors still surface
for Retry rather than silently skipping readable content.

The following passages are generated in parallel with listening and held only in
this narration session. They are not downloaded as a whole audiobook.

“Preparing speech” means the current clip is still being fetched or loaded for
playback. The initial passage, a restarted position or a new voice can still need
a network round trip. If playback exhausts the four-passage buffer because the
network/provider is slower than narration, preparation will still be visible.
Preloading reduces those waits; it cannot guarantee uninterrupted or gapless audio.

## Boundaries

`speech-source.js` reads leased EPUB section sources and emits paragraph CFIs
and bounded text chunks. It excludes scripts, ruby pronunciation, hidden markup,
navigation and semantic footnotes. Long paragraphs split at sentence/word
boundaries without splitting Unicode surrogate pairs. Each chunk has its own
original-text CFI range, including normalized whitespace and inline markup. Source extraction is
semantic; it cannot resolve every arbitrary publisher CSS visibility rule.

`speech-controller.js` owns one audio element, an abort/revision boundary and the
active blob or stream. `speech-stream.js` owns the feature-detected MPEG timeline,
serialized append/remove operations, passage timestamps and its disposable URL.
It does not use animation frames or visible-page layout to feed playback.
`speech-buffer.js` maintains a rolling window of four upcoming
passages, with at most two background synthesis requests at once. Preloading starts
while the current passage is being prepared and crosses linear chapter boundaries,
including illustration-only sections. Advancing consumes an existing ready or
in-flight request and immediately refills the window. Pause/Resume and speed
changes retain buffered audio. Previous, Read from here, voice changes, Stop and
disposal cancel and clear it. In clip playback, a failed speculative request is
retried when playback reaches that passage, without stopping the current audio. Streaming
reads the same four future entries without advancing the synthesis anchor; only
audible passage advancement refills that window. A future stream preparation
failure lets already appended speech finish, then offers Retry at the unread
passage instead of skipping prose. Late fetches and playback
promises cannot resume a stopped/replaced session. No synthesized audio is
persisted to local storage or sent to object storage. At most four queued
1 MiB blobs plus the current blob are retained, with at most five passages in
the native decoder's rolling buffer, plus one second of retained prior audio.
Chapter extraction and audio
preparation do not await rendition navigation or animation frames.
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

The parent viewport also detects browsing when a sandboxed EPUB suppresses
document input callbacks, as WebKit does. It compares both the scroll offset and
the spoken range's viewport position with the last owned placement. Follow
navigation and animation are excluded; Continuous buffer prepends/trims that
preserve the visible anchor are not browsing. EPUB scripts remain disabled.

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
errors without replacing media methods. A native hidden-page case also plays
through passage/chapter boundaries with animation frames frozen, checking a
stable source on streaming engines and final-passage progression on fallback
engines. Platform action/category tests verify buffering intent, remote controls,
Exit cleanup and safe behavior if the optional audio category setter rejects.
These checks cannot simulate an operating system locking a physical device.
Firefox's headless test mutes output
to avoid requiring a physical audio device. These are distinct from real
provider/audio checks. A successful live provider
probe must also verify the voice list and generated MP3, then a deployed Pages
probe must establish that the Cloudflare egress path is accepted. Android/Soul
hardware testing is separate from browser emulation.
