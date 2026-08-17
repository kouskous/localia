import { TextStreamer, type Message } from '@huggingface/transformers'
import { extractPdfText } from './pdf'
import { loadSpecialist } from './pipelines'
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
 * Runs one agentic turn: inspect what the user attached, dispatch each
 * piece to the small specialist model suited to it, then hand everything
 * gathered to the generalist chat model to draft the final, grounded
 * reply — streamed back token by token.
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

  emit({ type: 'step', label: SPECIALISTS.chat.actionLabel })
  const chat = await loadSpecialist('chat', reportLoad('chat', emit))

  const systemPrompt =
    'Tu es Localia, un assistant IA minimaliste. Réponds toujours en français, de façon claire, ' +
    'naturelle et concise, en te basant uniquement sur les informations fournies ci-dessous si ' +
    "elles existent. N'invente rien."

  const contextBlock = observations.length
    ? `Informations recueillies :\n${observations.map((o) => `- ${o}`).join('\n')}\n\n`
    : ''

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${contextBlock}${input.text || 'Décris ce que tu observes.'}` },
  ]

  let streamed = ''
  const streamer = new TextStreamer(chat.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (token: string) => {
      streamed += token
      emit({ type: 'token', token })
    },
  })

  await chat(messages, { max_new_tokens: 260, do_sample: false, streamer })

  if (!streamed.trim()) {
    // Extremely unlikely fallback: streamer produced nothing usable.
    emit({ type: 'token', token: "Désolé, je n'ai pas réussi à formuler de réponse." })
  }

  emit({ type: 'done' })
}
