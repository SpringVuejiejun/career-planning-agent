// types.ts
export type ChatRole = "user" | "assistant"

export type ChatMessage = {
  role: ChatRole
  content: string
}

// 结构化响应类型
export type StructuredChunk = {
  type: "streaming" | "reply" | "error" | "end"
  content?: string
  key_points?: string[]
  suggestions?: string[]
  conversation_id?: number
  data?: Record<string, any>
  is_final?: boolean
}

export type ConversationItem = {
  id: number
  title: string
  last_message_at?: string | null
  created_at?: string | null
}

export type ConversationListResponse = {
  items: ConversationItem[]
  total: number
}

export type HistoryMessage = {
  id: number
  role: ChatRole
  content: string
  key_points?: string[]
  suggestions?: string[]
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// 解析 SSE 行，返回结构化对象
function parseSseLine(line: string): StructuredChunk | null {
  if (!line.startsWith("data: ")) return null
  const data = line.slice(6).trim()
  if (data === "[DONE]") return { type: "end", is_final: true }
  
  try {
    const parsed = JSON.parse(data) as StructuredChunk
    return parsed
  } catch {
    return null
  }
}

// 流式输出函数，支持结构化数据
export async function streamCareerChatStructured(
  messages: ChatMessage[],
  conversationId: number | null,
  onEvent: (event: StructuredChunk) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      messages,
      conversation_id: conversationId ?? undefined,
      title: messages.find((m) => m.role === "user")?.content?.slice(0, 20) || "新对话",
    }),
    signal
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(errText || `HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error("无法读取响应流")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      const event = parseSseLine(line)
      if (event) {
        onEvent(event)
        if (event.type === "end") return
      }
    }
  }
}

export async function listConversations(skip = 0, limit = 20): Promise<ConversationListResponse> {
  const query = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  const res = await fetch(`/api/chat/conversations?${query.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(errText || `HTTP ${res.status}`)
  }
  return (await res.json()) as ConversationListResponse
}

export async function createConversation(title?: string): Promise<ConversationItem> {
  const res = await fetch("/api/chat/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(errText || `HTTP ${res.status}`)
  }
  return (await res.json()) as ConversationItem
}

export async function getConversationMessages(conversationId: number): Promise<HistoryMessage[]> {
  const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(errText || `HTTP ${res.status}`)
  }
  return (await res.json()) as HistoryMessage[]
}

export async function deleteConversation(conversationId: number): Promise<void> {
  const res = await fetch(`/api/chat/conversations/${conversationId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(errText || `HTTP ${res.status}`)
  }
}