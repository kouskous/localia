import { loadSpecialist } from './pipelines'
import { searchWikipedia } from './wikipedia'

export interface DocumentContext {
  name: string
  text: string
}

export interface ToolDescriptor {
  name: string
  description: string
}

/** Always on offer, regardless of what's attached to this turn. */
const BASE_TOOLS: ToolDescriptor[] = [
  {
    name: 'search_wikipedia',
    description: 'Look up a topic on Wikipedia. ARGS: the search term, e.g. "Tour Eiffel".',
  },
]

/** What the planner is allowed to call this turn — grows once documents are attached. */
export function availableTools(documents: DocumentContext[]): ToolDescriptor[] {
  if (documents.length === 0) return BASE_TOOLS

  const names = documents.map((doc) => `"${doc.name}"`).join(', ')
  return [
    ...BASE_TOOLS,
    {
      name: 'search_document',
      description: `Find a specific fact inside an attached document (${names}). ARGS: "<document name> | <question>".`,
    },
    {
      name: 'summarize_document',
      description: `Get an overview of an attached document (${names}). ARGS: the document name.`,
    },
  ]
}

/** Runs one tool call and returns a plain-text observation to feed back to the planner. */
export async function runTool(name: string, args: string, documents: DocumentContext[]): Promise<string> {
  switch (name) {
    case 'search_wikipedia':
      return runSearchWikipedia(args)
    case 'search_document':
      return runSearchDocument(args, documents)
    case 'summarize_document':
      return runSummarizeDocument(args, documents)
    default:
      return `Unknown tool "${name}".`
  }
}

async function runSearchWikipedia(args: string): Promise<string> {
  const query = args.trim()
  if (!query) return 'search_wikipedia: no search term given.'
  const wiki = await searchWikipedia(query)
  return wiki ? `Wikipedia — "${wiki.title}": ${wiki.extract}` : `Wikipedia: no article found for "${query}".`
}

async function runSearchDocument(args: string, documents: DocumentContext[]): Promise<string> {
  const [docName, question] = splitArgs(args)
  const doc = findDocument(documents, docName)
  if (!doc) return `search_document: unknown document "${docName}".`
  if (!question) return 'search_document: no question given.'

  const answerer = await loadSpecialist('qa')
  const result = await answerer(question, doc.text)
  return result?.answer
    ? `In "${doc.name}": "${result.answer}" (confidence ${Math.round(result.score * 100)}%).`
    : `search_document: no answer found in "${doc.name}".`
}

async function runSummarizeDocument(args: string, documents: DocumentContext[]): Promise<string> {
  const doc = findDocument(documents, args.trim())
  if (!doc) return `summarize_document: unknown document "${args.trim()}".`

  const summarizer = await loadSpecialist('summarize')
  const [result] = await summarizer(doc.text, { max_new_tokens: 120 })
  return result?.summary_text
    ? `Summary of "${doc.name}": ${result.summary_text.trim()}`
    : `summarize_document: could not summarize "${doc.name}".`
}

function splitArgs(args: string): [string, string] {
  const separator = args.indexOf('|')
  if (separator === -1) return [args.trim(), '']
  return [args.slice(0, separator).trim(), args.slice(separator + 1).trim()]
}

/** Falls back to the only attached document when the model gets the name slightly wrong. */
function findDocument(documents: DocumentContext[], name: string): DocumentContext | undefined {
  const lower = name.toLowerCase()
  return documents.find((doc) => doc.name.toLowerCase() === lower) ?? (documents.length === 1 ? documents[0] : undefined)
}
