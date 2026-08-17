import type { Message } from '@huggingface/transformers'
import './env'
import { runAgentTurn } from './orchestrator'
import { loadSpecialist } from './pipelines'
import type { SpecialistId } from './specialists'
import type { AgentEvent, AgentDocumentInput, AgentImageInput } from './types'

export interface WorkerRunRequest {
  type: 'run'
  requestId: string
  text: string
  images: AgentImageInput[]
  documents: AgentDocumentInput[]
  history: Message[]
}

export type WorkerRequest = { type: 'preload' } | WorkerRunRequest

export type WorkerResponse =
  | { type: 'boot-progress'; progress: number }
  | { type: 'boot-ready' }
  | ({ requestId: string } & AgentEvent)

// `self` inside a module worker is a DedicatedWorkerGlobalScope, but the
// project's single tsconfig already pulls in the DOM lib (for the rest of
// the app), and DOM + WebWorker lib types can't coexist in one program.
// The Worker interface's postMessage/addEventListener shapes line up with
// what we actually use here, so this cast is the pragmatic way through.
const ctx = self as unknown as Worker

function post(response: WorkerResponse) {
  ctx.postMessage(response)
}

ctx.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  if (message.type === 'preload') {
    void preload()
    return
  }

  void handleRun(message)
})

/**
 * `chat` and `translate` are the two specialists used on every turn, so
 * both are downloaded in parallel at boot rather than making the user
 * wait for `translate` mid-conversation on their first reply.
 */
async function preload() {
  const bytes = new Map<SpecialistId, { loaded: number; total: number }>()

  const reportCombined = (id: SpecialistId) => (info: { status: string; loaded?: number; total?: number }) => {
    if (info.status !== 'progress_total' || typeof info.loaded !== 'number' || typeof info.total !== 'number') return
    bytes.set(id, { loaded: info.loaded, total: info.total })
    let loaded = 0
    let total = 0
    for (const b of bytes.values()) {
      loaded += b.loaded
      total += b.total
    }
    if (total > 0) post({ type: 'boot-progress', progress: (loaded / total) * 100 })
  }

  // allSettled, not all: a failure on one shouldn't block the other, and
  // either way we still want to reach boot-ready — a failed specialist
  // here just gets retried (with its error surfaced properly) the first
  // time the user actually needs it.
  await Promise.allSettled([
    loadSpecialist('chat', reportCombined('chat')),
    loadSpecialist('translate', reportCombined('translate')),
  ])

  post({ type: 'boot-ready' })
}

async function handleRun(message: WorkerRunRequest) {
  try {
    await runAgentTurn(
      { text: message.text, images: message.images, documents: message.documents, history: message.history },
      (event) => post({ requestId: message.requestId, ...event }),
    )
  } catch (error) {
    console.error('[Localia agent worker]', error)
    post({
      requestId: message.requestId,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
