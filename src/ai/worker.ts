import './env'
import { runAgentTurn } from './orchestrator'
import { loadSpecialist } from './pipelines'
import type { AgentEvent, AgentDocumentInput, AgentImageInput } from './types'

export interface WorkerRunRequest {
  type: 'run'
  requestId: string
  text: string
  images: AgentImageInput[]
  documents: AgentDocumentInput[]
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

async function preload() {
  try {
    await loadSpecialist('chat', (info) => {
      if (info.status === 'progress_total' && typeof info.progress === 'number') {
        post({ type: 'boot-progress', progress: info.progress })
      }
    })
  } catch {
    // Swallow: the chat model will simply be retried (and its error
    // surfaced properly) the first time the user actually sends a message.
  }
  post({ type: 'boot-ready' })
}

async function handleRun(message: WorkerRunRequest) {
  try {
    await runAgentTurn(
      { text: message.text, images: message.images, documents: message.documents },
      (event) => post({ requestId: message.requestId, ...event }),
    )
  } catch (error) {
    post({
      requestId: message.requestId,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
