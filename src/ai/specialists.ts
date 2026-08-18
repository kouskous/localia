import type { DataType, PipelineType } from '@huggingface/transformers'

export type SpecialistId = 'chat' | 'caption' | 'summarize' | 'qa'

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
  // Qwen3-1.7B-ONNX was tried here to get better French directly (see
  // README) but failed to even create an ONNX Runtime session in the
  // browser — "Can't create a session... std::bad_alloc" — the WASM
  // backend couldn't allocate enough memory for a model that size,
  // regardless of quantization. Reverted to the 0.6B checkpoint, which is
  // proven to actually run. French quality at this size is the known
  // trade-off (see README) until a better-fitting solution is found.
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
} satisfies Record<SpecialistId, SpecialistConfig>
