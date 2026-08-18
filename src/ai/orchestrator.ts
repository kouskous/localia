import { TextStreamer, type Message } from '@huggingface/transformers'
import { extractPdfText } from './pdf'
import { loadSpecialist } from './pipelines'
import { planNextAction } from './planner'
import { SPECIALISTS, type SpecialistId } from './specialists'
import { availableTools, runTool, type DocumentContext } from './tools'
import type { AgentEvent, AgentTurnInput } from './types'

/** How many tool calls the planner may make in a row before we force an answer. */
const MAX_TOOL_ROUNDS = 3

const TOOL_STEP_LABELS: Record<string, (args: Record<string, unknown>) => string> = {
  search_wikipedia: (args) => `Recherche sur Wikipédia : ${typeof args.query === 'string' ? args.query : ''}…`,
  search_document: () => 'Recherche dans le document…',
  summarize_document: () => 'Résumé du document…',
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
 * Runs one agentic turn. Attached images are always described (there's no
 * real "choice" involved — if it's attached, look at it) and document text
 * is always read, but from there on `chat` itself drives the loop: given
 * the tools on offer (see tools.ts), it decides — round by round, up to
 * `MAX_TOOL_ROUNDS` — whether it needs to call one to gather more
 * information, or is ready to answer (see planner.ts). Only once it's
 * ready (or the round budget runs out) does it compose the final reply,
 * streamed back token by token.
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

  const documents: DocumentContext[] = []
  for (const doc of input.documents) {
    emit({ type: 'step', label: `Lecture de ${doc.name}…` })
    const text = doc.kind === 'pdf' ? await extractPdfText(doc.data as ArrayBuffer) : (doc.data as string)

    if (!text.trim()) {
      observations.push(`Document "${doc.name}": aucun texte lisible n'a été trouvé (probablement un scan sans texte).`)
      continue
    }
    documents.push({ name: doc.name, text })
  }

  const question = input.text.trim() || (documents.length > 0 ? 'Describe what the attached document(s) contain.' : '')

  if (question) {
    const tools = availableTools(documents)
    const calledBefore = new Set<string>()

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      emit({ type: 'step', label: 'Réflexion…' })
      const action = await planNextAction(question, observations, tools)
      if (action.type === 'ready') break

      const callKey = JSON.stringify({ name: action.name, args: action.args })
      if (calledBefore.has(callKey)) break
      calledBefore.add(callKey)

      const label = TOOL_STEP_LABELS[action.name]?.(action.args) ?? `Utilisation de l'outil « ${action.name} »…`
      emit({ type: 'step', label })
      observations.push(await runTool(action.name, action.args, documents))
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
    'clearly, based on the conversation so far and the information provided below ' +
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
    max_new_tokens: 1000,
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
