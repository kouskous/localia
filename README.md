# Localia

A premium, minimal AI chat interface built with Vue 3, TypeScript and Vite.

## Design system

The UI follows a warm, neutral, restrained design language — one accent
color used sparingly, generous whitespace, and typography-led hierarchy
instead of boxes and gradients. All shared values (color, spacing, radius,
shadow, typography, motion) live as CSS custom properties in
[`src/styles/tokens.css`](src/styles/tokens.css); components consume those
tokens rather than hard-coded values.

Key building blocks:

- `src/components/ui/` — primitives: buttons, icon buttons, the AI "spark"
  identity mark, progress bar, typing-dots indicator, file chips.
- `src/components/chat/` — the empty state, suggestion chips, composer
  (auto-growing textarea, attachments, drag & drop), message list and
  bubbles, streaming/processing indicator, drop overlay.
- `src/components/LoadingScreen.vue` — the first-run intro screen, driven
  by real `chat` model download progress (see below), not a fake timer.

Motion respects `prefers-reduced-motion`, and the layout is designed for
desktop, tablet and mobile (keyboard-safe composer, full-height
conversation, touch-friendly targets).

## AI: small local models, orchestrated by domain

There is no backend and no API key. Everything runs **in the visitor's own
browser** via [Transformers.js](https://huggingface.co/docs/transformers.js),
using small, task-specialized ONNX models pulled from the Hugging Face Hub
and cached by the browser after first use.

- `src/ai/specialists.ts` — the model registry, one small model per domain:
  - `chat` — `onnx-community/Qwen3-0.6B-ONNX` (default quantization for the
    device), the generalist that composes the final answer — in English (see
    below), with up to 1000 new tokens per reply so longer questions get a
    fuller answer instead of being cut short
  - `caption` — `Xenova/vit-gpt2-image-captioning`, describes attached images
  - `summarize` — `Xenova/distilbart-cnn-6-6`, summarizes long documents
  - `qa` — `Xenova/distilbert-base-uncased-distilled-squad`, extractive
    question-answering over document text
- `src/ai/tools.ts` — the tools the agent can choose to call: `search_wikipedia`
  (always on offer), plus `search_document` / `summarize_document` once at
  least one document is attached, each described as an OpenAI/Hermes-style
  JSON-Schema function definition (`ToolSchema` — name, description,
  typed `parameters`). `runTool(name, args, documents)` executes one,
  reading structured `args` (e.g. `args.query`), and returns a plain-text
  observation — a Wikipedia extract, an extractive-QA answer with
  confidence, or a document summary.
- `src/ai/planner.ts` — `planNextAction(question, observations, tools)`,
  the decision core of the agentic loop: one small `chat` call that reads
  the user's message and what's been gathered so far, and replies with
  either a Hermes-style `<tool_call>{"name": "...", "arguments": {...}}</tool_call>`
  JSON block or `READY`. This is the model itself choosing which tool to
  call, if any — not a keyword list, not a separate fixed "extract search
  concepts" step — it can ask for `search_wikipedia` with `{"query":
  "soleil"}`, read the result, then ask again with `{"query": "lune"}`,
  then decide it's ready. The system prompt spells out a concrete filled-in
  example call per tool (generated from each `ToolSchema`) rather than
  only an abstract format description, since a small model imitates a
  literal example far more reliably than it follows prose instructions.
  Every round's raw model output and parsed result is logged via
  `console.debug('[Localia planner] round output:', ...)` — with nothing
  else surfacing what the model actually said, "no tool got called" and
  "the model correctly decided none was needed" were indistinguishable
  from outside the browser console. Best-effort parsing: a reply with no
  well-formed `<tool_call>` block — including the model just answering
  directly, which small models occasionally do despite instructions —
  falls back to "ready", same fail-safe philosophy as the rest of this
  pipeline.
- `src/ai/orchestrator.ts` — the agentic loop. Attached images are always
  described (captioning isn't a "choice" — if it's attached, look at it)
  and document text is always read, but from there `chat` drives itself:
  each round, `planNextAction` decides whether to call a tool or answer,
  `runTool` executes it, the result is appended to the observations the
  next round sees, up to `MAX_TOOL_ROUNDS` (3) rounds. Includes a simple
  loop guard — an identical tool+args call twice ends the loop early —
  since nothing stops a small model from asking the same thing again.
  Once the planner says `READY` (or the round budget runs out), `chat`
  composes and streams the final English reply directly from everything
  gathered — no separate translation stage. `useAgent.ts` builds
  conversation history from the last `MAX_HISTORY_MESSAGES` (10)
  non-empty messages each turn — it's just past message text, not re-run
  attachment processing, so a follow-up that references an earlier image
  relies on that image having been described in the assistant's own prior
  reply.
  **Second attempt at the wire format:** the first version of this loop
  asked the planner for a bespoke `TOOL: <name>` / `ARGS: <arguments>` /
  `READY` text format. Live testing showed it never actually triggered a
  Wikipedia call — with no logging at the time, a parse failure and a
  genuine "no tool needed" were indistinguishable, so this was hard to
  diagnose from the outside. The current `<tool_call>` JSON format is a
  second, hopefully more reliable attempt, for two reasons: it mirrors the
  Hermes-style function-calling format Qwen models are widely instruction-
  tuned to produce, so there's a reasonable chance the model already
  "knows" this shape from training rather than needing to learn a novel
  one from scratch; and the `console.debug` logging above means a repeat
  of "it's not working" is now diagnosable from the browser console
  instead of a black box. `planNextAction` also passes the `ToolSchema[]`
  through as the `tools` field in `generate_kwargs` — Transformers.js
  forwards that straight into `apply_chat_template`'s Jinja rendering
  (`tokenizer_encode_kwargs` sibling option), so *if*
  `onnx-community/Qwen3-0.6B-ONNX`'s own bundled chat template supports
  structured tool use, this gets it for free; if it doesn't, the option is
  simply ignored per Transformers.js's own docs. Either way the loop
  doesn't depend on it — the system prompt's own spelled-out example
  carries the whole instruction on its own, which is what makes this
  testable without needing to inspect that template (a Hub-hosted file
  this sandbox has no network access to — see known limitations).
- `src/ai/wikipedia.ts` — `searchWikipedia(query)`, a single most-relevant
  article lookup via the MediaWiki Action API (`fr.wikipedia.org`, CORS via
  the documented `origin=*` param, no key needed), called by the
  `search_wikipedia` tool. French, not English, Wikipedia — queries come out
  of a French conversation, and matching that language scores far better
  than searching French wording against an English-language index.
  Best-effort: any failure resolves to no result rather than breaking the
  turn. Not runtime-tested from this sandbox (see known limitations) —
  needs a live test pass once deployed.
- `src/ai/pdf.ts` — text-layer extraction for PDFs via `pdfjs-dist` (no OCR:
  scanned/image-only PDFs come back empty and the assistant says so).
- `src/ai/worker.ts` + `src/composables/useAgent.ts` — all model loading and
  inference runs in a Web Worker, off the main thread, so the UI (and its
  animations) never freezes during a heavy generation. `useAgent` owns the
  worker, mirrors its events into reactive chat state, and recreates the
  worker on cancel (generation isn't cooperatively abortable, so a hard stop
  means terminating and respawning it — cached weights make the respawn
  quick, just not instant). At boot, the worker downloads `chat` (used on
  every turn) and reports its real progress for the loading screen.

**Caching:** every specialist loads once per session and stays cached from
then on — `src/ai/pipelines.ts` caches each as a singleton keyed by id, so a
repeat call just returns the already-initialized pipeline instantly, no
re-download and no re-initialization. On top of that, `env.useBrowserCache =
true` (`src/ai/env.ts`) persists the raw downloaded weights in the browser's
Cache Storage, so even a fresh page load (a new worker, which can't share
the previous one's in-memory session) skips the network and only pays the
cost of re-parsing already-downloaded bytes into a session.

An earlier version disposed `caption`/`summarize`/`qa` (via each pipeline's
own `.dispose()`) right after use to cap memory, since a loaded specialist's
weights sit decompressed in the worker's memory (RAM for WASM, VRAM for
WebGPU) for as long as they're cached — that's unavoidable, disk caching
only speeds up *downloads*, not what a *running* model occupies. That
traded a smaller memory footprint for re-initializing those three specialists
on every subsequent use, which felt like repeated loading — removed in favor
of "load once, stay cached" for the whole session. Worth knowing if a long
conversation touching lots of images/documents ever becomes a real memory
problem on lower-end mobile devices: this is the first place to revisit.

**Why `chat` answers in English, not French — the full history:** the
assistant's reply language went through three iterations.

1. **English draft + separate translation model.** `chat` (0.6B) drafted in
   English — its most reliable language at that size — and a dedicated
   translation specialist converted that into French, since direct French
   generation from the 0.6B checkpoint was noticeably weaker than its
   English. This worked, but cost a second sequential generation every
   turn, a second model download, and several rounds chasing translation-
   specific issues. Finding a translation model alone took three tries:
   `opus-mt-en-fr` (~74M, bilingual, too basic — grammar mistakes),
   `nllb-200-distilled-600M` (better, too heavy a download), `m2m100_418M`
   (NLLB's predecessor, a lighter middle ground).
2. **A bigger, French-native `chat` model.** Rather than keep tuning the
   translation stage, `chat` was upgraded to `onnx-community/Qwen3-1.7B-
   ONNX` and asked to answer in French directly — multilingual quality
   scales favorably with size within a model family, and 0.6B is the
   weakest tier for that specifically. **This failed in the browser**:
   `Error: Can't create a session. ERROR_CODE: 6, ERROR_MESSAGE:
   std::bad_alloc` — the WASM backend couldn't allocate enough memory to
   even initialize a session for a model that size, independent of
   quantization (q4f16 didn't save it). A hard crash, not a quality
   problem — the whole app stopped working.
3. **Back to `chat` (0.6B), answering in English.** Both attempts to get
   French had traded the original weak-French problem for a worse one
   (translation-specific failures, then an out-of-memory crash). Simplest
   fix: keep the small, proven-working model, and let it answer in the one
   language it's actually reliable at. Kept the simplified single-
   generation-pass architecture from step 2 (no translation stage, direct
   token streaming) since that part was sound — only the model size and
   target language were the problem.

**Net result:** the assistant currently replies in English. The UI chrome
(buttons, placeholders, the loading screen) is still French, so this is a
deliberate, known trade-off — not a bug — until a better-fitting solution
for French quality at this scale is found (a smaller multilingual-balanced
model, rather than either a same-family upsize or a bolted-on translation
stage, would be the next thing worth trying).

**Known limitations, honestly:** these are genuinely small models, chosen to
keep downloads light rather than for peak accuracy. `caption`/`summarize`/`qa`
were trained on English data, so accuracy on French source documents may be
lower than on English ones. The assistant's replies are in English (see
above) while the rest of the UI is French. There's no OCR, so
scanned PDFs and `.docx`/`.rtf` files aren't read (the assistant is told to
say so rather than guess). The agentic tool-calling loop (`planner.ts`)
asks a 0.6B model to reliably emit a `<tool_call>`/`READY` protocol every
round — small models are less consistent at following formatting
instructions than larger ones, so expect occasional rounds where it just
answers directly instead of asking for a tool it arguably needed, or asks
for one it didn't; the fallback in both cases is simply "proceed as if
ready," never a broken turn. Check the browser console for `[Localia
planner]` logs to see exactly what happened on any given turn. None of this was
runtime-tested against the real Hugging Face CDN or `fr.wikipedia.org`
from the environment this was built in — its network egress is sandboxed
to a small allowlist that excludes both; the code is correct against each
API's own documented behavior, but give it a real test pass once
deployed, since actual model downloads, in-browser inference, and the
agentic loop's tool calls couldn't be exercised end-to-end here.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build for production
npm run preview  # preview the production build
```
