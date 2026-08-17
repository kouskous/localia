import { TextStreamer, type Message } from '@huggingface/transformers'
import { extractPdfText } from './pdf'
import { disposeSpecialist, loadSpecialist } from './pipelines'
import { SPECIALISTS, type SpecialistId } from './specialists'
import type { AgentEvent, AgentTurnInput } from './types'

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

/**
 * Qwen3 "thinks out loud" as literal `<think>…</think>` text before its
 * real answer — `enable_thinking: false` (passed at the call site) is
 * supposed to turn that off, but this strips it regardless in case a given
 * quantized build doesn't honour the flag. Handles an unclosed tag too
 * (generation cut off mid-thought by max_new_tokens).
 */
function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .trim()
}

/**
 * Runs one agentic turn: inspect what the user attached, dispatch each
 * piece to the small specialist model suited to it, then hand everything
 * gathered to the generalist chat model to draft the final, grounded
 * reply, and finally have a dedicated translation model turn that draft
 * into the French shown to the user — streamed back token by token.
 */
export async function runAgentTurn(input: AgentTurnInput, emit: (event: AgentEvent) => void): Promise<void> {
  const observations: string[] = []
  // caption/summarize/qa are only used situationally (depending on what was
  // attached) — track which ones this turn actually loaded so their weights
  // can be freed before the two heavier models (chat, translate) run. chat
  // and translate are used on every turn, so they stay cached indefinitely.
  const situational = new Set<SpecialistId>()

  for (const image of input.images) {
    emit({ type: 'step', label: SPECIALISTS.caption.actionLabel })
    const captioner = await loadSpecialist('caption', reportLoad('caption', emit))
    situational.add('caption')
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
      situational.add('qa')
      const result = await answerer(input.text, text)
      if (result?.answer) {
        observations.push(
          `Dans "${doc.name}", réponse trouvée : "${result.answer}" (confiance ${Math.round(result.score * 100)}%).`,
        )
      }
    } else {
      emit({ type: 'step', label: SPECIALISTS.summarize.actionLabel })
      const summarizer = await loadSpecialist('summarize', reportLoad('summarize', emit))
      situational.add('summarize')
      const [result] = await summarizer(text, { max_new_tokens: 120 })
      if (result?.summary_text) {
        observations.push(`Résumé de "${doc.name}": ${result.summary_text.trim()}`)
      }
    }
  }

  await Promise.all([...situational].map(disposeSpecialist))

  emit({ type: 'step', label: SPECIALISTS.chat.actionLabel })
  const chat = await loadSpecialist('chat', reportLoad('chat', emit))

  // Drafted in English on purpose: at this model size, English is by far
  // the most reliable language for a small generalist LLM. The dedicated
  // `translate` specialist below is what actually produces the French the
  // user sees — much better than asking `chat` to write French directly.
  // Prior turns in `history` are in French (what the user actually saw),
  // which Qwen3 reads fine even though it's asked to keep writing English.
  const systemPrompt =
    'You are Localia, a minimal AI assistant having an ongoing conversation. Prior turns may be ' +
    'in French. Answer in English, clearly and concisely, based on the conversation so far and ' +
    'the information provided below if it exists. Do not invent anything.'

  const contextBlock = observations.length
    ? `Gathered information:\n${observations.map((o) => `- ${o}`).join('\n')}\n\n`
    : ''

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...input.history,
    { role: 'user', content: `${contextBlock}${input.text || 'Describe what you observe.'}` },
  ]

  const generation = await chat(messages, {
    max_new_tokens: 260,
    do_sample: false,
    // Qwen3 defaults to a reasoning pass before answering; we want the
    // direct answer, not the reasoning transcript.
    tokenizer_encode_kwargs: { enable_thinking: false },
  })

  const generated = generation[0]?.generated_text
  const rawAnswer = Array.isArray(generated) ? (generated.at(-1)?.content ?? '') : generated
  const englishAnswer = stripThink(typeof rawAnswer === 'string' ? rawAnswer : '')

  emit({ type: 'step', label: SPECIALISTS.translate.actionLabel })
  const translator = await loadSpecialist('translate', reportLoad('translate', emit))

  let streamed = ''
  const streamer = new TextStreamer(translator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (token: string) => {
      if (!token) return
      streamed += token
      emit({ type: 'token', token })
    },
  })

  // opus-mt-en-fr is a fixed EN→FR pair (unlike NLLB/M2M100), so there's no
  // src_lang/tgt_lang to pass — the checkpoint only ever translates that
  // one direction.
  await translator(englishAnswer || "I don't have an answer.", {
    max_new_tokens: 300,
    streamer,
  })

  if (!streamed.trim()) {
    // Extremely unlikely fallback: streamer produced nothing usable.
    emit({ type: 'token', token: "Désolé, je n'ai pas réussi à formuler de réponse." })
  }

  emit({ type: 'done' })
}
