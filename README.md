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
  - `chat` — `onnx-community/Qwen3-1.7B-ONNX` (q4f16), the generalist that
    composes the final answer — directly in French (see below)
  - `caption` — `Xenova/vit-gpt2-image-captioning`, describes attached images
  - `summarize` — `Xenova/distilbart-cnn-6-6`, summarizes long documents
  - `qa` — `Xenova/distilbert-base-uncased-distilled-squad`, extractive
    question-answering over document text
- `src/ai/orchestrator.ts` — the agentic loop: inspect what was attached,
  route each piece to the specialist suited to it (image → caption,
  document + question → QA, document alone → summarize), then hand the
  gathered observations plus recent conversation history to `chat`, which
  composes and streams the final French reply directly — no separate
  translation stage. `useAgent.ts` builds that history from the last
  `MAX_HISTORY_MESSAGES` (10) non-empty messages each turn — it's just past
  message text, not re-run attachment processing, so a follow-up that
  references an earlier image relies on that image having been described in
  the assistant's own prior reply.
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

**Why a single French-native `chat` model, not English-draft-plus-translate:**
earlier versions had `chat` (Qwen3-0.6B) draft in English — its most
reliable language at that size — and a separate translation specialist
convert that into French, since direct French generation from the 0.6B
checkpoint was noticeably weaker than its English. That worked, but cost a
second sequential generation every turn, a second model download, and
several rounds chasing translation-specific issues (quantization
availability, language-code mismatches between model families). Landing on
a translation model alone went through three: `opus-mt-en-fr` (~74M,
bilingual, too basic — grammar mistakes), `nllb-200-distilled-600M`
(better, too heavy a download), `m2m100_418M` (NLLB's predecessor, a
lighter middle ground). Rather than keep tuning that second stage, `chat`
was upgraded to `onnx-community/Qwen3-1.7B-ONNX` and asked to answer in
French directly — multilingual quality scales favorably with size within a
model family, and 0.6B was the weakest tier for that specifically. This
removes the translation stage (and its whole class of failure modes)
entirely, at the cost of one bigger download instead of two smaller ones
(~1.05GB at q4f16 vs. the previous ~635MB combined) — not yet confirmed
against the real Hugging Face CDN from the sandbox this was built in (see
below), so if `onnx-community/Qwen3-1.7B-ONNX` turns out not to exist under
that exact name, that's the first thing to check.

**Known limitations, honestly:** these are genuinely small models, chosen to
keep downloads light rather than for peak accuracy. `caption`/`summarize`/`qa`
still produce English internally (only visible to `chat`, not the user) —
accuracy on French source documents may still be lower than on English
ones, since these models were trained on English data. There's no OCR, so
scanned PDFs and `.docx`/`.rtf` files aren't read (the assistant is told to
say so rather than guess). None of this was runtime-tested against the real
Hugging Face CDN from the environment this was built in (its network
egress is sandboxed); the code is correct against the library's own
documented APIs, but give it a real test pass once deployed, since actual
model downloads and in-browser inference couldn't be exercised end-to-end
here.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build for production
npm run preview  # preview the production build
```
