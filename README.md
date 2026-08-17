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
  by real model-download progress (see below), not a fake timer.

Motion respects `prefers-reduced-motion`, and the layout is designed for
desktop, tablet and mobile (keyboard-safe composer, full-height
conversation, touch-friendly targets).

## AI: small local models, orchestrated by domain

There is no backend and no API key. Everything runs **in the visitor's own
browser** via [Transformers.js](https://huggingface.co/docs/transformers.js),
using small, task-specialized ONNX models pulled from the Hugging Face Hub
and cached by the browser after first use.

- `src/ai/specialists.ts` — the model registry, one small model per domain:
  - `chat` — `onnx-community/Qwen3-0.6B-ONNX` (q4f16), the generalist that
    drafts the answer — in English (see below)
  - `caption` — `Xenova/vit-gpt2-image-captioning`, describes attached images
  - `summarize` — `Xenova/distilbart-cnn-6-6`, summarizes long documents
  - `qa` — `Xenova/distilbert-base-uncased-distilled-squad`, extractive
    question-answering over document text
  - `translate` — `Xenova/opus-mt-en-fr` (MarianMT, ~74M params, EN→FR
    only), turns that English draft into the French the user actually sees
- `src/ai/orchestrator.ts` — the agentic loop: inspect what was attached,
  route each piece to the specialist suited to it (image → caption,
  document + question → QA, document alone → summarize), hand the gathered
  observations to `chat` to draft a grounded answer, then hand that draft to
  `translate` for the final, streamed French reply.
- `src/ai/pdf.ts` — text-layer extraction for PDFs via `pdfjs-dist` (no OCR:
  scanned/image-only PDFs come back empty and the assistant says so).
- `src/ai/worker.ts` + `src/composables/useAgent.ts` — all model loading and
  inference runs in a Web Worker, off the main thread, so the UI (and its
  animations) never freezes during a heavy generation. `useAgent` owns the
  worker, mirrors its events into reactive chat state, and recreates the
  worker on cancel (generation isn't cooperatively abortable, so a hard stop
  means terminating and respawning it — cached weights make the respawn
  quick, just not instant).

**Memory:** a loaded specialist's weights sit decompressed in the worker's
memory (RAM for the WASM backend, VRAM for WebGPU) for as long as it stays
cached — this is unavoidable, the browser's disk/HTTP cache only speeds up
future *downloads*, it doesn't reduce what a *running* model occupies.
`src/ai/pipelines.ts` caches each specialist as a singleton so a repeat call
doesn't re-download or re-initialize it, but that means every specialist
used in a session would otherwise stay resident forever. `chat` and
`translate` run on every turn, so they're always kept warm; `caption` /
`summarize` / `qa` are only needed situationally (an attached image or
document), so `runAgentTurn` disposes whichever of those it loaded — via
each pipeline's own `.dispose()` — right after using them, before the two
always-on models run. This trades a bit of latency (redownload-free, but
re-initializing a session takes a moment) for a materially smaller memory
footprint, which matters most on the mobile devices this UI targets.

**Why English → French translation, not French generation directly:** small
generalist chat models like `chat` here are noticeably weaker writing French
than English — that's the language their training data skews toward at this
size. Rather than accept weak French, `chat` drafts in English (its best
language) and a dedicated translation model converts that into French —
translation is a narrower, better-solved problem for a small model than open
generation in a second language, and a model trained specifically for the
EN→FR pair (rather than one multilingual model covering ~200 languages) can
be both much smaller and better at this one pair. The cost is latency: a
turn now runs two sequential generations instead of one, and downloads a
second (much smaller, ~74M-parameter) model on first use.

**Known limitations, honestly:** these are genuinely small models, chosen to
keep downloads light rather than for peak accuracy. `caption`/`summarize`/`qa`
still produce English internally (only visible to `chat`/`translate`, not the
user) — accuracy on French source documents may still be lower than on
English ones, since these models were trained on English data. There's no
OCR, so scanned PDFs and `.docx`/`.rtf` files aren't read (the assistant is
told to say so rather than guess). None of this was runtime-tested against
the real Hugging Face CDN from the environment this was built in (its
network egress is sandboxed); the code is correct against the library's own
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
