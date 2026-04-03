import { ArrowDown, Loader2, SendHorizontal, Sparkles } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { type ChatMessage, streamCareerChat } from "@/lib/chat-api"
import { cn } from "@/lib/utils"

const WELCOME =
  "你好，我是你的职业规划助手。可以告诉我你的专业、年级，以及最近在实习、考研、就业之间的纠结吗？"

export function CareerChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME },
  ])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true) // 是否应该自动滚动

  // 检查是否在底部
  const isAtBottom = useCallback(() => {
    const container = scrollRef.current
    if (!container) return true
    
    // 允许 50px 的误差（因为滚动行为不是完全精确的）
    const threshold = 50
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceToBottom <= threshold
  }, [])

  // 滚动到底部
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if(!scrollRef.current) return
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior
    })
  }, [])

  // 监听用户滚动
  const handleScroll = useCallback(() => {
    if (isAtBottom()) {
      // 用户滚动到底部时，恢复自动滚动
      shouldAutoScrollRef.current = true
      setShowScrollButton(false)
    } else {
      // 用户离开底部时，停止自动滚动
      shouldAutoScrollRef.current = false
      setShowScrollButton(true)
    }
  }, [isAtBottom])

  // 监听内容变化，智能滚动
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      // 用户没有主动向上滚动，自动滚动到底部
      scrollToBottom("smooth")
    }
  }, [messages, streaming, scrollToBottom])

  // 初始化滚动到底部
  useEffect(() => {
    scrollToBottom("auto")
  }, [scrollToBottom])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput("")
    setError(null)
    
    // 发送消息前，强制开启自动滚动
    shouldAutoScrollRef.current = true
    
    const next: ChatMessage[] = [...messages, { role: "user", content: text }]
    setMessages(next)
    setStreaming(true)

    let assistant = ""
    setMessages((prev) => [...prev, { role: "assistant", content: "" }])

    try {
      await streamCareerChat([...messages, { role: "user", content: text }], (chunk: string) => {
        assistant += chunk
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { role: "assistant", content: assistant }
          }
          return copy
        })
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "发送失败"
      setError(msg)
      setMessages((prev) => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last?.role === "assistant" && !last.content.trim()) {
          copy.pop()
        }
        return copy
      })
    } finally {
      setStreaming(false)
    }
  }, [input, messages, streaming])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const [showScrollButton, setShowScrollButton] = useState(false)

  return (
    <div className="mt-2 flex h-[95vh] flex-col">
      <Card className="flex h-full flex-col border-border/80 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/60 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-lg">大学生职业规划智能体</CardTitle>
          </div>
          <CardDescription>
            基于 LangChain 与对话模型，辅助你理清方向、制定下一步行动。请先在后端配置{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">OPENAI_API_KEY</code>。
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          {/* 消息列表容器 */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn(
              "flex-1 overflow-y-auto",
              // 美化滚动条（Webkit浏览器）
              "[&::-webkit-scrollbar]:w-1.5",
              "[&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30",
              "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50",
              // Firefox 滚动条样式
              "scrollbar-width: thin",
              "scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent"
            )}
            role="log"
            aria-live="polite"
          >
            {/* 内层容器 - 负责间距 */}
            <div className="flex flex-col gap-3 px-4 py-4">
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role.slice(0, 1)}`}
                  className={cn(
                    "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed md:max-w-[85%]",
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto border border-border bg-muted/60 text-foreground"
                  )}
                >
                  {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
                </div>
              ))}
              
              {streaming && messages[messages.length - 1]?.role === "user" && (
                <div className="mr-auto flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  正在思考…
                </div>
              )}
              
              {/* 底部留白 */}
              <div className="h-2" />
            </div>
          </div>

          {/* 可选：添加一个"滚动到底部"按钮 */}
          {/* 错误提示 */}
          {error && (
            <p className="px-4 py-2 text-sm text-destructive border-t border-border/60" role="alert">
              {error}
            </p>
          )}

          {showScrollButton && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute bottom-24 right-4 rounded-full shadow-lg"
              onClick={() => {
                shouldAutoScrollRef.current = true
                scrollToBottom("smooth")
                setShowScrollButton(false)
              }}
            >
              <ArrowDown className="size-4" />
            </Button>
          )}

          {/* 输入区域 */}
          <div className="flex-shrink-0 border-t border-border/60 p-4">
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="描述你的情况或问题，Enter 发送，Shift+Enter 换行"
                disabled={streaming}
                maxRows={5}
                className="min-h-[60px] bg-background/80 pr-24 resize-none"
                aria-label="消息输入"
              />
              <Button
                type="button"
                onClick={() => void send()}
                disabled={streaming || !input.trim()}
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8"
              >
                {streaming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizontal className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}