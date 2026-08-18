import type { DataType, PipelineType } from '@huggingface/transformers'

export type SpecialistId = 'chat' | 'caption' | 'summarize' | 'qa' | 'translate'

export interface SpecialistConfig<T extends PipelineType = PipelineType> {
  id: SpecialistId
  task: T
  model: string
  dtype?: DataType
  /** French, user-facing description of what this specialist is doing right now. */
  actionLabel: string
}

// Small, specialized, single-purpose models — each one loaded lazily, on
// first use, and cached by the browser afterwards. `chat` doubles as the
// generalist that plans the turn and drafts the final reply; the others
// are narrow domain experts the orchestrator calls out to when relevant.
// `satisfies` (rather than a `: Record<...>` annotation) keeps each entry's
// `task` as its own literal type instead of widening to `PipelineType`, so
// callers get back the specific pipeline type for the id they asked for.
export const SPECIALISTS = {
  chat: {
    id: 'chat',
    task: 'text-generation',
    model: 'onnx-community/Qwen3-0.6B-ONNX',
    dtype: 'q4f16',
    actionLabel: 'Rédaction de la réponse…',
  },
  caption: {
    id: 'caption',
    task: 'image-to-text',
    model: 'Xenova/vit-gpt2-image-captioning',
    actionLabel: "Lecture de l'image…",
  },
  summarize: {
    id: 'summarize',
    task: 'summarization',
    model: 'Xenova/distilbart-cnn-6-6',
    actionLabel: 'Résumé du document…',
  },
  qa: {
    id: 'qa',
    task: 'question-answering',
    model: 'Xenova/distilbert-base-uncased-distilled-squad',
    actionLabel: 'Recherche de la réponse…',
  },
  // `chat` reasons and drafts in English — by far its strongest language at
  // this size — and this specialist turns that into fluent French, which a
  // small generalist chat model can't reliably do on its own. M2M100 is
  // NLLB's direct predecessor (same Meta research lineage) — still a
  // modern multilingual model, well ahead of the small bilingual
  // opus-mt-en-fr on fluency for a high-resource pair like EN→FR. Same
  // 418M-param model as before, but q4f16-quantized (like `chat` above)
  // rather than the default ~q8, to land closer to a 100-200MB download —
  // unverified whether this repo publishes a q4f16 ONNX file; if it
  // doesn't, loading fails cleanly (visible in the console) rather than
  // silently, and we'd fall back to the unquantized default.
  translate: {
    id: 'translate',
    task: 'translation',
    model: 'Xenova/m2m100_418M',
    dtype: 'q4f16',
    actionLabel: 'Traduction en français…',
  },
} satisfies Record<SpecialistId, SpecialistConfig>
