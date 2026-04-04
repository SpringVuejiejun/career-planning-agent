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
  data?: Record<string, any>
  is_final?: boolean
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
  onEvent: (event: StructuredChunk) => void
): Promise<void> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
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