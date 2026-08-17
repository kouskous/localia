export type MessageRole = 'user' | 'assistant'

export interface ChatAttachment {
  id: string
  name: string
  size: number
  type: string
  kind: 'image' | 'pdf' | 'document' | 'file'
  previewUrl?: string
  /** The original file, kept for the agent to actually read — not for display. */
  file: File
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  attachments?: ChatAttachment[]
  streaming?: boolean
  createdAt: number
}

export interface Suggestion {
  id: string
  label: string
  icon: string
}
