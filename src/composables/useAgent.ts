import { ref } from 'vue'
import type { AgentDocumentInput, AgentImageInput } from '../ai/types'
import type { WorkerRequest, WorkerResponse } from '../ai/worker'
import type { ChatAttachment, ChatMessage } from '../types/chat'

let counter = 0
function nextId() {
  counter += 1
  return `msg_${Date.now()}_${counter}`
}

function isPlainText(attachment: ChatAttachment): boolean {
  return attachment.type.startsWith('text/') || /\.txt$/i.test(attachment.name)
}

function createWorker() {
  return new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' })
}

export function useAgent() {
  const booting = ref(true)
  const bootProgress = ref(0)

  const messages = ref<ChatMessage[]>([])
  const isProcessing = ref(false)
  const processingLabel = ref('')

  let worker: Worker = createWorker()
  let activeRequestId: string | null = null
  let activeIndex = -1

  attach(worker)

  function attach(w: Worker) {
    w.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const message = event.data

      if (message.type === 'boot-progress') {
        bootProgress.value = Math.max(bootProgress.value, Math.round(message.progress))
        return
      }
      if (message.type === 'boot-ready') {
        bootProgress.value = 100
        setTimeout(() => {
          booting.value = false
        }, 300)
        return
      }
      if (message.requestId !== activeRequestId || activeIndex === -1) return

      switch (message.type) {
        case 'step':
          processingLabel.value = message.label
          break
        case 'progress':
          processingLabel.value = `Chargement d'un modèle… ${Math.round(message.progress)}%`
          break
        case 'token':
          isProcessing.value = false
          messages.value[activeIndex].content += message.token
          break
        case 'done':
          messages.value[activeIndex].streaming = false
          isProcessing.value = false
          activeRequestId = null
          activeIndex = -1
          break
        case 'error':
          console.error('[Localia agent]', message.message)
          if (!messages.value[activeIndex].content) {
            messages.value[activeIndex].content = "Désolé, une erreur est survenue pendant le traitement."
          }
          messages.value[activeIndex].streaming = false
          isProcessing.value = false
          activeRequestId = null
          activeIndex = -1
          break
      }
    })

    w.postMessage({ type: 'preload' } satisfies WorkerRequest)
  }

  async function buildPayload(attachments: ChatAttachment[]) {
    const images: AgentImageInput[] = []
    const documents: AgentDocumentInput[] = []
    const unsupported: string[] = []

    for (const attachment of attachments) {
      if (attachment.kind === 'image') {
        images.push({ name: attachment.name, blob: attachment.file })
      } else if (attachment.kind === 'pdf') {
        documents.push({ name: attachment.name, kind: 'pdf', data: await attachment.file.arrayBuffer() })
      } else if (attachment.kind === 'document' && isPlainText(attachment)) {
        documents.push({ name: attachment.name, kind: 'text', data: await attachment.file.text() })
      } else {
        unsupported.push(attachment.name)
      }
    }

    return { images, documents, unsupported }
  }

  async function sendMessage(text: string, attachments: ChatAttachment[] = []) {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return

    messages.value.push({
      id: nextId(),
      role: 'user',
      content: trimmed,
      attachments,
      createdAt: Date.now(),
    })

    const { images, documents, unsupported } = await buildPayload(attachments)
    const note = unsupported.length
      ? `\n\n(Remarque : je ne sais pas encore lire ${unsupported.join(', ')} — seuls les images, PDF et fichiers texte sont pris en charge pour l'instant.)`
      : ''

    activeIndex =
      messages.value.push({
        id: nextId(),
        role: 'assistant',
        content: '',
        streaming: true,
        createdAt: Date.now(),
      }) - 1
    activeRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    isProcessing.value = true
    processingLabel.value = "L'IA parcourt votre demande…"

    const request: WorkerRequest = {
      type: 'run',
      requestId: activeRequestId,
      text: trimmed + note,
      images,
      documents,
    }
    const transfer = documents
      .map((d) => d.data)
      .filter((data): data is ArrayBuffer => data instanceof ArrayBuffer)

    worker.postMessage(request, transfer)
  }

  function cancel() {
    if (activeIndex !== -1) {
      messages.value[activeIndex].streaming = false
    }
    isProcessing.value = false
    activeRequestId = null
    activeIndex = -1

    // transformers.js generation isn't cooperatively abortable mid-run, so a
    // hard stop means tearing down the worker; cached model weights make
    // the next load fast again, it just isn't instant.
    worker.terminate()
    worker = createWorker()
    attach(worker)
  }

  function reset() {
    cancel()
    messages.value = []
  }

  return {
    booting,
    bootProgress,
    messages,
    isProcessing,
    processingLabel,
    sendMessage,
    cancel,
    reset,
  }
}
