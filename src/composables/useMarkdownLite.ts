// Minimal, safe formatter for demo assistant replies: bold + paragraphs + numbered lists.
// Not a full markdown parser — deliberately narrow surface, escapes HTML first.

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export function formatMessage(raw: string): string {
  const escaped = escapeHtml(raw)
  const blocks = escaped.split(/\n{2,}/)

  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.length > 0)
      const isList = lines.length > 0 && lines.every((l) => /^\d+\.\s/.test(l))

      if (isList) {
        const items = lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s/, ''))}</li>`).join('')
        return `<ol>${items}</ol>`
      }

      return `<p>${lines.map(inline).join('<br>')}</p>`
    })
    .join('')
}
