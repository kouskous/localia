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
  // small generalist chat model can't reliably do on its own. NLLB is a
  // modern, well-regarded multilingual model — noticeably more fluent and
  // grammatically consistent on high-resource pairs like EN→FR than the
  // older bilingual opus-mt-en-fr, at the cost of a heavier (~600M param)
  // download. Chosen deliberately over the lighter option: translation
  // quality (no grammar mistakes) matters more here than download size.
  translate: {
    id: 'translate',
    task: 'translation',
    model: 'Xenova/nllb-200-distilled-600M',
    actionLabel: 'Traduction en français…',
  },
} satisfies Record<SpecialistId, SpecialistConfig>
