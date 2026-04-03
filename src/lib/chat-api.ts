export type ChatRole = "user" | "assistant"

export type ChatMessage = {
  role: ChatRole
  content: string
}

function parseSseLine(line: string): string | null {
  if (!line.startsWith("data: ")) return null
  const data = line.slice(6).trim()
  if (data === "[DONE]") return ""
  try {
    const j = JSON.parse(data) as { text?: string }
    return j.text ?? null
  } catch {
    return null
  }
}

/** Stream assistant reply; calls onDelta for each token; resolves when stream ends. */
export async function streamCareerChat(
  messages: ChatMessage[],
  onDelta: (chunk: string) => void
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
      const piece = parseSseLine(line)
      if (piece === "") return
      if (piece) onDelta(piece)
    }
  }
}
