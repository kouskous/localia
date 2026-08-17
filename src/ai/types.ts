import type { Message } from '@huggingface/transformers'
import type { SpecialistId } from './specialists'

export interface AgentImageInput {
  name: string
  blob: Blob
}

export interface AgentDocumentInput {
  name: string
  kind: 'pdf' | 'text'
  data: ArrayBuffer | string
}

export interface AgentTurnInput {
  text: string
  images: AgentImageInput[]
  documents: AgentDocumentInput[]
  /** Prior turns (already-capped, oldest first) for conversational memory. */
  history: Message[]
}

/** One step of the agentic loop, streamed back to the UI as it happens. */
export type AgentEvent =
  | { type: 'step'; label: string }
  | { type: 'progress'; specialist: SpecialistId; progress: number }
  | { type: 'token'; token: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
