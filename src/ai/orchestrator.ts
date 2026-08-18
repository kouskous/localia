import { TextStreamer, type Message } from '@huggingface/transformers'
import { extractPdfText } from './pdf'
import { loadSpecialist } from './pipelines'
import { SPECIALISTS, type SpecialistId } from './specialists'
import type { AgentEvent, AgentTurnInput } from './types'
import { searchWikipedia } from './wikipedia'

const QUESTION_HINTS = [
  '?',
  'combien',
  'quel',
  'quelle',
  'quels',
  'quelles',
  'quand',
  'qui',
  'où',
  'pourquoi',
  'comment',
  'total',
  'montant',
  'date',
]

function looksLikeQuestion(text: string): boolean {
  const lower = text.toLowerCase()
  return QUESTION_HINTS.some((hint) => lower.includes(hint))
}

function reportLoad(id: SpecialistId, emit: (event: AgentEvent) => void) {
  return (info: { status: string; progress?: number }) => {
    if (info.status === 'progress_total' && typeof info.progress === 'number') {
      emit({ type: 'progress', specialist: id, progress: info.progress })
    }
  }
}

/** How many trailing characters of `str` could be the start of `tag`. */
function trailingPartialTagLength(str: string, tag: string): number {
  const max = Math.min(str.length, tag.length - 1)
  for (let len = max; len > 0; len -= 1) {
    if (str.endsWith(tag.slice(0, len))) return len
  }
  return 0
}

const THINK_OPEN = '<think>'
const THINK_CLOSE = '</think>'

/**
 * Qwen3 "thinks out loud" as literal `<think>…</think>` text before its
 * real answer — `enable_thinking: false` (passed at the call site) is
 * supposed to turn that off, but this filter is a defensive backstop in
 * case a given quantized build doesn't honour the flag: it strips
 * anything between the tags (streamed token-by-token, so tags can split
 * across chunks) and only forwards the visible answer.
 */
function createThinkFilter(onVisible: (text: string) => void) {
  let buffer = ''
  let thinking = false

  return (chunk: string) => {
    buffer += chunk
    for (;;) {
      if (!thinking) {
        const start = buffer.indexOf(THINK_OPEN)
        if (start === -1) {
          const keep = trailingPartialTagLength(buffer, THINK_OPEN)
          if (keep < buffer.length) onVisible(buffer.slice(0, buffer.length - keep))
          buffer = buffer.slice(buffer.length - keep)
          return
        }
        onVisible(buffer.slice(0, start))
        buffer = buffer.slice(start + THINK_OPEN.length)
        thinking = true
      } else {
        const end = buffer.indexOf(THINK_CLOSE)
        if (end === -1) {
          buffer = buffer.slice(buffer.length - trailingPartialTagLength(buffer, THINK_CLOSE))
          return
        }
        buffer = buffer.slice(end + THINK_CLOSE.length)
        thinking = false
      }
    }
  }
}

/**
 * Runs one agentic turn: inspect what the user attached, dispatch each
 * piece to the small specialist model suited to it, then hand everything
 * gathered to the generalist chat model to compose the final, grounded
 * reply directly in French — streamed back token by token.
 */
export async function runAgentTurn(input: AgentTurnInput, emit: (event: AgentEvent) => void): Promise<void> {
  const observations: string[] = []

  for (const image of input.images) {
    emit({ type: 'step', label: SPECIALISTS.caption.actionLabel })
    const captioner = await loadSpecialist('caption', reportLoad('caption', emit))
    const [result] = await captioner(image.blob)
    if (result?.generated_text) {
      observations.push(`Image "${image.name}": ${result.generated_text.trim()}`)
    }
  }

  for (const doc of input.documents) {
    emit({ type: 'step', label: `Lecture de ${doc.name}…` })
    const text = doc.kind === 'pdf' ? await extractPdfText(doc.data as ArrayBuffer) : (doc.data as string)

    if (!text.trim()) {
      observations.push(`Document "${doc.name}": aucun texte lisible n'a été trouvé (probablement un scan sans texte).`)
      continue
    }

    if (looksLikeQuestion(input.text)) {
      emit({ type: 'step', label: SPECIALISTS.qa.actionLabel })
      const answerer = await loadSpecialist('qa', reportLoad('qa', emit))
      const result = await answerer(input.text, text)
      if (result?.answer) {
        observations.push(
          `Dans "${doc.name}", réponse trouvée : "${result.answer}" (confiance ${Math.round(result.score * 100)}%).`,
        )
      }
    } else {
      emit({ type: 'step', label: SPECIALISTS.summarize.actionLabel })
      const summarizer = await loadSpecialist('summarize', reportLoad('summarize', emit))
      const [result] = await summarizer(text, { max_new_tokens: 120 })
      if (result?.summary_text) {
        observations.push(`Résumé de "${doc.name}": ${result.summary_text.trim()}`)
      }
    }
  }

  // Only reach for Wikipedia when there's nothing else grounding the
  // answer already (an attached image/document) and the message actually
  // looks like a question — not on every "salut" or "merci".
  if (input.images.length === 0 && input.documents.length === 0 && looksLikeQuestion(input.text)) {
    emit({ type: 'step', label: 'Recherche sur Wikipédia…' })
    const wiki = await searchWikipedia(input.text)
    if (wiki) {
      observations.push(`Wikipedia — "${wiki.title}": ${wiki.extract}`)
    }
  }

  emit({ type: 'step', label: SPECIALISTS.chat.actionLabel })
  const chat = await loadSpecialist('chat', reportLoad('chat', emit))

  // English on purpose: at this model size, French generation was
  // noticeably weaker (grammar mistakes), and the two attempts at fixing
  // that — a separate translation stage, then a bigger French-native
  // model — each traded that problem for a worse one (translation-specific
  // failures, then an out-of-memory crash). English is simply what this
  // small model is reliably good at.
  const systemPrompt =
    'You are Localia, a minimal AI assistant having an ongoing conversation. Answer in English, ' +
    'clearly and concisely, based on the conversation so far and the information provided below ' +
    'if it exists. Do not invent anything.'

  const contextBlock = observations.length
    ? `Gathered information:\n${observations.map((o) => `- ${o}`).join('\n')}\n\n`
    : ''

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...input.history,
    { role: 'user', content: `${contextBlock}${input.text || 'Describe what you observe.'}` },
  ]

  let streamed = ''
  const emitVisible = createThinkFilter((visible) => {
    if (!visible) return
    streamed += visible
    emit({ type: 'token', token: visible })
  })
  const streamer = new TextStreamer(chat.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: emitVisible,
  })

  await chat(messages, {
    max_new_tokens: 300,
    do_sample: false,
    streamer,
    // Qwen3 defaults to a reasoning pass before answering; we want the
    // direct answer, not the reasoning transcript.
    tokenizer_encode_kwargs: { enable_thinking: false },
  })

  if (!streamed.trim()) {
    // Extremely unlikely fallback: streamer produced nothing usable.
    emit({ type: 'token', token: "Désolé, je n'ai pas réussi à formuler de réponse." })
  }

  emit({ type: 'done' })
}
