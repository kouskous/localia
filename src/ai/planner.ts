import type { Message } from '@huggingface/transformers'
import { loadSpecialist } from './pipelines'
import type { ToolDescriptor } from './tools'

export type PlannedAction = { type: 'tool'; name: string; args: string } | { type: 'ready' }

function buildSystemPrompt(tools: ToolDescriptor[]): string {
  const toolList = tools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n')
  return (
    "You are Localia's planner: decide the single next step before answering the user. " +
    'You may call one tool to gather information, or say you are ready to answer if you ' +
    'already have enough. Only call a tool when it would genuinely help — greetings and ' +
    "small talk never need one, and don't call the same tool with the same arguments twice.\n\n" +
    `Available tools:\n${toolList}\n\n` +
    'Reply with EXACTLY one of the following, and nothing else:\n' +
    'TOOL: <tool name>\nARGS: <arguments>\n\n' +
    'or, if no tool is needed:\nREADY'
  )
}

/**
 * The decision core of the agentic loop (see orchestrator.ts): asks `chat`
 * itself which tool to call next, if any, given the user's message and
 * what's been gathered so far — rather than a fixed routing rule deciding
 * for it. Runs once per round of the loop, capped at a small number of
 * rounds there.
 */
export async function planNextAction(
  question: string,
  observations: string[],
  tools: ToolDescriptor[],
): Promise<PlannedAction> {
  const chat = await loadSpecialist('chat')

  const observationsBlock = observations.length
    ? `Gathered so far:\n${observations.map((observation) => `- ${observation}`).join('\n')}\n\n`
    : ''

  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(tools) },
    { role: 'user', content: `${observationsBlock}User's message: ${question}` },
  ]

  const [result] = await chat(messages, {
    max_new_tokens: 60,
    do_sample: false,
    tokenizer_encode_kwargs: { enable_thinking: false },
  })

  const content = result?.generated_text.at(-1)?.content
  return parseAction(typeof content === 'string' ? content : '')
}

/**
 * Best-effort parsing of a small model's free-form reply: anything that
 * doesn't match the requested TOOL:/ARGS: format — including the model
 * just answering directly instead of following instructions, which small
 * models occasionally do — falls back to "ready to answer" rather than
 * throwing, same fail-safe philosophy as the rest of this pipeline.
 */
function parseAction(raw: string): PlannedAction {
  const clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const match = /TOOL:\s*(\S+)[\s\S]*?ARGS:\s*(.+)/i.exec(clean)
  if (!match) return { type: 'ready' }
  return { type: 'tool', name: match[1].toLowerCase(), args: match[2].trim() }
}
