import type { Message } from '@huggingface/transformers'
import { loadSpecialist } from './pipelines'
import type { ToolSchema } from './tools'

export type PlannedAction = { type: 'tool'; name: string; args: Record<string, unknown> } | { type: 'ready' }

/** A concrete filled-in example, generated from the schema, for the model to imitate. */
function exampleCall(tool: ToolSchema): string {
  const placeholderArgs: Record<string, string> = {}
  for (const key of Object.keys(tool.function.parameters.properties)) {
    placeholderArgs[key] = `<${key}>`
  }
  const call = JSON.stringify({ name: tool.function.name, arguments: placeholderArgs })
  return `<tool_call>${call}</tool_call>`
}

function buildSystemPrompt(tools: ToolSchema[]): string {
  const toolList = tools
    .map((tool) => `- ${tool.function.name}: ${tool.function.description}\n  Example: ${exampleCall(tool)}`)
    .join('\n')
  return (
    "You are Localia's planner: decide the single next step before answering the user. " +
    'You may call one tool to gather information, or say you are ready to answer if you ' +
    'already have enough. Only call a tool when it would genuinely help — greetings and ' +
    "small talk never need one, and don't call the same tool with the same arguments twice. " +
    'If the user asks about a real-world fact — a person, place, organization, historical ' +
    'event, or date — and that fact is not already in "Gathered so far", you MUST call ' +
    "search_wikipedia before answering, rather than relying on your own memory.\n\n" +
    `Available tools:\n${toolList}\n\n` +
    'To call a tool, reply with EXACTLY one tool_call tag like the examples above, filled in ' +
    'with real values, and nothing else. If no tool is needed, reply with exactly: READY'
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
  tools: ToolSchema[],
  round: number,
): Promise<PlannedAction> {
  const chat = await loadSpecialist('chat')

  const observationsBlock = observations.length
    ? `Gathered so far:\n${observations.map((observation) => `- ${observation}`).join('\n')}\n\n`
    : ''

  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(tools) },
    { role: 'user', content: `${observationsBlock}User's message: ${question}` },
  ]

  // Visibility: what the planner actually sees this round, before we know
  // what it will do with it.
  console.debug(`[Localia planner] round ${round} context:`, {
    question,
    observations,
    toolsOffered: tools.map((tool) => tool.function.name),
    messages,
  })

  const startedAt = performance.now()
  const [result] = await chat(messages, {
    max_new_tokens: 120,
    do_sample: false,
    // Best-effort: passed through to the model's own chat template in case
    // it renders its own tool-calling instructions on top of ours — see
    // README for why the ones in buildSystemPrompt above don't depend on it.
    tools,
    tokenizer_encode_kwargs: { enable_thinking: false },
  })
  const elapsedMs = Math.round(performance.now() - startedAt)

  const content = result?.generated_text.at(-1)?.content
  const raw = typeof content === 'string' ? content : ''
  const { action, reason } = parseAction(raw)
  // Visibility fix: a planning round that decides "ready" and one that
  // silently failed to parse used to look identical from the outside.
  console.debug(`[Localia planner] round ${round} output (${elapsedMs}ms):`, { raw, action, reason })
  return action
}

/**
 * Best-effort parsing of a small model's free-form reply: anything that
 * doesn't contain a well-formed <tool_call> JSON block — including the
 * model just answering directly instead of following instructions, which
 * small models occasionally do — falls back to "ready to answer" rather
 * than throwing, same fail-safe philosophy as the rest of this pipeline.
 *
 * Returns the fallback `reason` alongside the action purely for logging —
 * "the model explicitly said READY" and "we couldn't parse its reply" used
 * to be indistinguishable from the outside.
 */
function parseAction(raw: string): { action: PlannedAction; reason: string } {
  const clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const match = /<tool_call>([\s\S]*?)<\/tool_call>/i.exec(clean)
  if (!match) return { action: { type: 'ready' }, reason: 'no <tool_call> tag found in reply' }

  try {
    const parsed = JSON.parse(match[1].trim()) as { name?: unknown; arguments?: unknown }
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) {
      return { action: { type: 'ready' }, reason: 'tool_call JSON had no usable "name"' }
    }
    const args = parsed.arguments && typeof parsed.arguments === 'object' ? (parsed.arguments as Record<string, unknown>) : {}
    return { action: { type: 'tool', name: parsed.name.trim().toLowerCase(), args }, reason: 'parsed tool_call' }
  } catch (error) {
    return { action: { type: 'ready' }, reason: `tool_call JSON failed to parse: ${String(error)}` }
  }
}
