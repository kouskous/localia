import type { Message } from '@huggingface/transformers'
import { loadSpecialist } from './pipelines'

export interface TurnIntent {
  isQuestion: boolean
  concepts: string[]
}

const SYSTEM_PROMPT =
  'You analyze a single user message. Decide if it is a factual question that would ' +
  'benefit from a knowledge lookup, and extract up to 3 short key search terms ' +
  '(entities, names, topics) worth looking up, written in the same language as the ' +
  'message. Reply with EXACTLY two lines and nothing else:\n' +
  'QUESTION: yes or no\n' +
  'CONCEPTS: comma-separated terms, or none'

/**
 * Asks `chat` itself to read the user's message and decide (a) whether it's
 * a factual question worth grounding, and (b) which specific concepts to
 * look up — e.g. "qui est plus grand le soleil ou la lune" yields two
 * focused terms, "soleil" and "lune", each searched separately, instead of
 * one noisy Wikipedia query on the whole sentence. Replaces a fixed French
 * keyword list, which only ever covered phrasings someone thought to
 * hardcode in advance.
 */
export async function analyzeIntent(text: string): Promise<TurnIntent> {
  const chat = await loadSpecialist('chat')

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: text },
  ]

  const [result] = await chat(messages, {
    max_new_tokens: 60,
    do_sample: false,
    tokenizer_encode_kwargs: { enable_thinking: false },
  })

  const content = result?.generated_text.at(-1)?.content
  return parseIntent(typeof content === 'string' ? content : '')
}

/**
 * Best-effort parsing of a small model's free-form reply: any line that
 * doesn't match the requested format is simply ignored rather than thrown,
 * falling back to "not a question, nothing to look up" — same fail-safe
 * philosophy as the rest of the grounding pipeline (see wikipedia.ts).
 */
function parseIntent(raw: string): TurnIntent {
  const clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const isQuestion = /QUESTION:\s*yes/i.test(clean)
  const conceptsLine = /CONCEPTS:\s*(.+)/i.exec(clean)?.[1] ?? ''
  const concepts = conceptsLine
    .split(',')
    .map((concept) => concept.trim())
    .filter((concept) => concept.length > 0 && !/^none$/i.test(concept))
    .slice(0, 3)

  return { isQuestion, concepts }
}
