import { loadSpecialist } from './pipelines'
import { searchWikipedia } from './wikipedia'

export interface DocumentContext {
  name: string
  text: string
}

/** OpenAI/Hermes-style JSON-Schema function definition — see planner.ts for how it's used. */
export interface ToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description: string }>
      required: string[]
    }
  }
}

/** Always on offer, regardless of what's attached to this turn. */
const BASE_TOOLS: ToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'search_wikipedia',
      description:
        'Look up a real-world fact on Wikipedia: people, places, organizations, historical events, dates, ' +
        "or general-knowledge topics. Prefer calling this over guessing or relying on the model's own " +
        'memory whenever the user asks something factual that could be verified this way.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The search term, e.g. "Tour Eiffel".' } },
        required: ['query'],
      },
    },
  },
]

/** What the planner is allowed to call this turn — grows once documents are attached. */
export function availableTools(documents: DocumentContext[]): ToolSchema[] {
  if (documents.length === 0) return BASE_TOOLS

  const names = documents.map((doc) => doc.name).join(', ')
  return [
    ...BASE_TOOLS,
    {
      type: 'function',
      function: {
        name: 'search_document',
        description: `Find a specific fact inside an attached document (${names}).`,
        parameters: {
          type: 'object',
          properties: {
            document: { type: 'string', description: `The document name, one of: ${names}.` },
            question: { type: 'string', description: 'The specific question to answer from that document.' },
          },
          required: ['document', 'question'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'summarize_document',
        description: `Get an overview of an attached document (${names}).`,
        parameters: {
          type: 'object',
          properties: { document: { type: 'string', description: `The document name, one of: ${names}.` } },
          required: ['document'],
        },
      },
    },
  ]
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Runs one tool call and returns a plain-text observation to feed back to the planner. */
export async function runTool(name: string, args: Record<string, unknown>, documents: DocumentContext[]): Promise<string> {
  switch (name) {
    case 'search_wikipedia':
      return runSearchWikipedia(asString(args.query))
    case 'search_document':
      return runSearchDocument(asString(args.document), asString(args.question), documents)
    case 'summarize_document':
      return runSummarizeDocument(asString(args.document), documents)
    default:
      return `Unknown tool "${name}".`
  }
}

async function runSearchWikipedia(query: string): Promise<string> {
  const trimmed = query.trim()
  if (!trimmed) return 'search_wikipedia: no search term given.'
  const wiki = await searchWikipedia(trimmed)
  return wiki ? `Wikipedia — "${wiki.title}": ${wiki.extract}` : `Wikipedia: no article found for "${trimmed}".`
}

async function runSearchDocument(docName: string, question: string, documents: DocumentContext[]): Promise<string> {
  const doc = findDocument(documents, docName)
  if (!doc) return `search_document: unknown document "${docName}".`
  if (!question.trim()) return 'search_document: no question given.'

  const answerer = await loadSpecialist('qa')
  const result = await answerer(question, doc.text)
  return result?.answer
    ? `In "${doc.name}": "${result.answer}" (confidence ${Math.round(result.score * 100)}%).`
    : `search_document: no answer found in "${doc.name}".`
}

async function runSummarizeDocument(docName: string, documents: DocumentContext[]): Promise<string> {
  const doc = findDocument(documents, docName)
  if (!doc) return `summarize_document: unknown document "${docName}".`

  const summarizer = await loadSpecialist('summarize')
  const [result] = await summarizer(doc.text, { max_new_tokens: 120 })
  return result?.summary_text
    ? `Summary of "${doc.name}": ${result.summary_text.trim()}`
    : `summarize_document: could not summarize "${doc.name}".`
}

/** Falls back to the only attached document when the model gets the name slightly wrong. */
function findDocument(documents: DocumentContext[], name: string): DocumentContext | undefined {
  const lower = name.toLowerCase()
  return documents.find((doc) => doc.name.toLowerCase() === lower) ?? (documents.length === 1 ? documents[0] : undefined)
}
