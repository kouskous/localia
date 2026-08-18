interface SearchResponse {
  query?: {
    search?: { title: string }[]
  }
}

interface ExtractResponse {
  query?: {
    pages?: Record<string, { title?: string; extract?: string; missing?: boolean }>
  }
}

export interface WikipediaResult {
  title: string
  extract: string
}

// French Wikipedia on purpose: the user types their query in French, and
// searching it against an English-language index would score poorly on
// French question wording — matching the query's own language matters
// more here than matching chat's answer language (English). Qwen3 reads
// French fine even though it's asked to keep writing English, same as it
// already does for French conversation history.
const API_BASE = 'https://fr.wikipedia.org/w/api.php'

/**
 * Looks up the single most relevant Wikipedia article for a free-text
 * query, to ground the chat model's answer in real external knowledge
 * beyond what a small local model already knows on its own. Uses the
 * MediaWiki Action API with `origin=*` — the documented way to call it
 * cross-origin from client-side JS, no key required.
 *
 * Best-effort: any network or parsing failure resolves to `null` rather
 * than throwing — this is optional grounding, not a required part of the
 * turn, and mustn't be able to fail an otherwise-fine reply.
 */
export async function searchWikipedia(query: string): Promise<WikipediaResult | null> {
  try {
    const searchUrl = new URL(API_BASE)
    searchUrl.search = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '1',
      format: 'json',
      origin: '*',
    }).toString()

    const searchResponse = await fetch(searchUrl)
    if (!searchResponse.ok) return null
    const search = (await searchResponse.json()) as SearchResponse
    const title = search.query?.search?.[0]?.title
    if (!title) return null

    const extractUrl = new URL(API_BASE)
    extractUrl.search = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      exintro: 'true',
      explaintext: 'true',
      exchars: '1200',
      titles: title,
      format: 'json',
      origin: '*',
    }).toString()

    const extractResponse = await fetch(extractUrl)
    if (!extractResponse.ok) return null
    const extractData = (await extractResponse.json()) as ExtractResponse
    const page = Object.values(extractData.query?.pages ?? {})[0]
    if (!page || page.missing || !page.extract) return null

    return { title: page.title ?? title, extract: page.extract }
  } catch (error) {
    console.error('[Localia agent] Wikipedia lookup failed (non-fatal)', error)
    return null
  }
}
