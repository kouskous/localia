import { ref } from 'vue'
import type { ChatAttachment, ChatMessage } from '../types/chat'

const PROCESSING_PHRASES = [
  "L'IA parcourt votre demande…",
  'Elle rassemble ses idées…',
  'Presque prêt…',
]

const DEMO_REPLIES = [
  "Voici ce que j'ai trouvé. Le montant total s'élève à **CHF 1 180**, TVA comprise.\n\nLe document mentionne également une échéance de paiement à 30 jours.",
  "D'après l'image fournie, il s'agit d'un reçu daté du 12 mars. Le commerçant, les articles et le sous-total sont clairement lisibles.\n\nSouhaitez-vous que j'en extraie le détail ligne par ligne ?",
  "J'ai résumé le contenu en trois points clés :\n\n1. Le contexte général du sujet\n2. Les chiffres les plus importants\n3. Une recommandation finale\n\nDites-moi si vous voulez que j'approfondisse un point en particulier.",
]

let counter = 0
function nextId() {
  counter += 1
  return `msg_${Date.now()}_${counter}`
}

export function useChat() {
  const messages = ref<ChatMessage[]>([])
  const isProcessing = ref(false)
  const processingLabel = ref(PROCESSING_PHRASES[0])
  let cancelled = false

  function reset() {
    messages.value = []
    isProcessing.value = false
    cancelled = false
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

    await runAssistantTurn()
  }

  async function runAssistantTurn() {
    cancelled = false
    isProcessing.value = true

    for (const phrase of PROCESSING_PHRASES) {
      if (cancelled) {
        isProcessing.value = false
        return
      }
      processingLabel.value = phrase
      await wait(420)
    }

    if (cancelled) {
      isProcessing.value = false
      return
    }

    isProcessing.value = false

    const reply = DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)]
    const index =
      messages.value.push({
        id: nextId(),
        role: 'assistant',
        content: '',
        streaming: true,
        createdAt: Date.now(),
      }) - 1

    const words = reply.split(' ')
    for (let i = 0; i < words.length; i += 1) {
      if (cancelled) break
      messages.value[index].content += (i === 0 ? '' : ' ') + words[i]
      await wait(18 + Math.random() * 30)
    }
    messages.value[index].streaming = false
  }

  function cancel() {
    cancelled = true
    isProcessing.value = false
  }

  return {
    messages,
    isProcessing,
    processingLabel,
    sendMessage,
    cancel,
    reset,
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
