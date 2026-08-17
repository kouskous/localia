export type MessageRole = 'user' | 'assistant'

export interface ChatAttachment {
  id: string
  name: string
  size: number
  type: string
  kind: 'image' | 'pdf' | 'document' | 'file'
  previewUrl?: string
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
