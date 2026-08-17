import type { ChatAttachment } from '../types/chat'

export function detectFileKind(file: File): ChatAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'pdf'
  if (
    file.type.includes('word') ||
    file.type.includes('document') ||
    /\.(docx?|txt|rtf)$/i.test(file.name)
  ) {
    return 'document'
  }
  return 'file'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  const units = ['Ko', 'Mo', 'Go']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = value >= 10 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function toAttachment(file: File): ChatAttachment {
  const kind = detectFileKind(file)
  return {
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    type: file.type,
    kind,
    previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
    file,
  }
}

export function filesToAttachments(files: FileList | File[]): ChatAttachment[] {
  return Array.from(files).map(toAttachment)
}
