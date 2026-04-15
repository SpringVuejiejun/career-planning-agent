import { ArrowDown, Loader2, SendHorizontal, Sparkles, List, Lightbulb, Square, Plus } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Tooltip } from 'react-tooltip'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { type ChatMessage, streamCareerChatStructured, type StructuredChunk } from "@/lib/chat-api"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/stores/chatStore"

const WELCOME =
  "你好，我是你的职业规划助手。可以告诉我你的专业、年级，以及最近在实习、考研、就业之间的纠结吗？"

// 扩展消息类型，支持富文本内容
type EnhancedChatMessage = ChatMessage & {
  keyPoints?: string[]
  suggestions?: string[]
  isStreaming?: boolean
}

export function CareerChat() {
  const { messages: storeMsg, updateMessages, clearMessages } = useChatStore()
  const [messages, setMessages] = useState(storeMsg)

  useEffect(() => {
    if(messages.length > 0 && JSON.stringify(messages) !== JSON.stringify(storeMsg)){
      updateMessages(messages)
    }
  }, [messages])

  // useEffect(() => {
  //   if(JSON.stringify(messages) !== JSON.stringify(storeMsg)) setMessages(storeMsg)
  // }, [storeMsg])

  useEffect(() => {
    if(messages.length === 0 && storeMsg.length === 0){
      const welcome = [{ role: 'assistant', content: WELCOME, keyPoints: [], suggestions: []}]
      setMessages(welcome)
    }
  }, [messages.length, storeMsg.length])

  const newChat = () => {
    clearMessages()
    setMessages([])
  }


  // 更新为历史记录
  // setMessages(storeMsg)
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  const isAtBottom = useCallback(() => {
    const container = scrollRef.current
    if (!container) return true
    const threshold = 50
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceToBottom <= threshold
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior
    })
  }, [])

  const handleScroll = useCallback(() => {
    if (isAtBottom()) {
      shouldAutoScrollRef.current = true
      setShowScrollButton(false)
    } else {
      shouldAutoScrollRef.current = false
      setShowScrollButton(true)
    }
  }, [isAtBottom])

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom("smooth")
    }
  }, [messages, streaming, scrollToBottom])

  useEffect(() => {
    scrollToBottom("auto")
  }, [scrollToBottom])
  const abortControllerRef = useRef(null)
  const stopStreaming = () => {
    if (abortControllerRef.current) {
    abortControllerRef.current.abort();  // 中断请求
    abortControllerRef.current = null;
    setStreaming(false);
  }
  }
  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput("")
    setError(null)
    
    shouldAutoScrollRef.current = true

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setStreaming(true)

    
    // 添加用户消息
    const userMessage: EnhancedChatMessage = { role: "user", content: text }
    setMessages(prev => [...prev, userMessage])
    
    // 准备临时消息
    let assistantContent = ""
    let assistantKeyPoints: string[] = []
    let assistantSuggestions: string[] = []
    
    // 添加一个临时的 assistant 消息
    setMessages(prev => [...prev, { 
      role: "assistant", 
      content: "", 
      keyPoints: [], 
      suggestions: [],
      isStreaming: true 
    }])
    
    // 构建历史消息（包含刚添加的用户消息）
    const scartchpadMessages: ChatMessage[] = [...messages, userMessage]
    const historyMessages: ChatMessage[] = scartchpadMessages.length > 10 ? scartchpadMessages.slice(-10) : scartchpadMessages 
    
    try {
      await streamCareerChatStructured(historyMessages, (event: StructuredChunk) => {
        switch (event.type) {
          case "streaming":
            // 流式文本
            if (event.content) {
              assistantContent += event.content
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { 
                    ...last, 
                    content: assistantContent,
                    isStreaming: true
                  }
                }
                return copy
              })
            }
            break
             
          case "reply":
            // 最终回复
            if (event.content) {
              assistantContent = event.content
            }
            if (event.key_points) {
              assistantKeyPoints = event.key_points
            }
            if (event.suggestions) {
              assistantSuggestions = event.suggestions
            }
            break
            
          case "error":
            setError(event.content || "未知错误")
            break
            
          case "end":
            // 流结束，保存最终消息
            setMessages(prev => {
              const copy = [...prev]
              const last = copy[copy.length - 1]
              if (last?.role === "assistant") {
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: assistantContent || "抱歉，我没有理解你的问题，请再详细说明一下。",
                  keyPoints: assistantKeyPoints,
                  suggestions: assistantSuggestions,
                  isStreaming: false
                }
              }
              return copy
            })
            setStreaming(false)
            break
        }
      }, abortController.signal)
    } catch (e) {
      // const msg = e instanceof Error ? e.message : "发送失败"
      const msg = e instanceof Error && e.name === 'AbortError' ? '用户主动中断' : '发送失败'
      setError(msg)
      setMessages(prev => {
        const copy = [...prev]
        if (copy[copy.length - 1]?.role === "assistant" && !copy[copy.length - 1].content) {
          copy.pop()
        }
        return copy
      })
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

  // 渲染消息内容（支持富文本）
  const renderMessageContent = (message: EnhancedChatMessage) => {
    return (
      <div>
        {/* 主要内容 */}
        <div className="whitespace-pre-wrap">{message.content || (message.isStreaming ? "…" : "")}</div>
        
        {/* 关键要点 */}
        {message.keyPoints && message.keyPoints.length > 0 && (
          <div className="mt-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <List className="size-4" />
              <span>关键要点</span>
            </div>
            <ul className="space-y-1">
              {message.keyPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-blue-600 dark:text-blue-300">
                  • {point}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 建议 */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
              <Lightbulb className="size-4" />
              <span>建议</span>
            </div>
            <ul className="space-y-1">
              {message.suggestions.map((suggestion, idx) => (
                <li key={idx} className="text-sm text-green-600 dark:text-green-300">
                  • {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2 flex h-[95vh] flex-col max-w-[50rem] mx-auto" >
      <Card className="flex h-full flex-col border-border/80 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/60 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-lg">大学生职业规划智能体</CardTitle>
          </div>
          <CardDescription>
            专注于职业规划，辅助你理清方向、制定下一步行动。支持查询就业数据、技能要求、招聘信息等。 
          </CardDescription>
          <Button 
            type="button"
            size="icon"
            data-tooltip-id="data-newChat"
            data-tooltip-content="开启新对话"
            className="absolute right-2 top-10"
            onClick={newChat}
          ><Plus/></Button>
          <Tooltip id="data-newChat" place="top"></Tooltip>
        </CardHeader>
        
        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn(
              "flex-1 overflow-y-auto",
              "[&::-webkit-scrollbar]:w-1.5",
              "[&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30",
              "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50",
              "scrollbar-width: thin",
              "scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent"
            )}
            role="log"
            aria-live="polite"
          >
            <div className="flex flex-col gap-3 px-4 py-4">
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={cn(
                    "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed md:max-w-[85%]",
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto border border-border bg-muted/60 text-foreground"
                  )}
                >
                  {m.role === 'assistant' ? renderMessageContent(m) : m.content}
                </div>
              ))}
              
              {streaming && messages[messages.length - 1]?.role === "user" && (
                <div className="mr-auto flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  正在思考…
                </div>
              )}
              
              <div className="h-2" />
            </div>
          </div>

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

          <div className="flex-shrink-0 border-t border-border/60 p-4">
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="描述你的情况或问题，Enter 发送，Shift+Enter 换行。例如：'计算机专业在北京就业怎么样？'"
                disabled={streaming}
                maxRows={5}
                className="min-h-[60px] pr-24 resize-none"
                aria-label="消息输入"
              />
              {/* <Tooltip id="chat-tooltip" place="right" /> */}
              <Button
                type="button"
                data-tooltip-id="chat-tooltip"
                data-tooltip-content={streaming ? "停止生成" : "发送消息"}
                onClick={streaming ? stopStreaming : send}
                disabled={streaming ? false : !input.trim()}
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8 cursor-pointer"
                // title={streaming ? '停止生成' : '请输入你的问题'}
              >
                {streaming ? (
                  <Square className="size-4 animate-spin"></Square>
                  // <Loader2 className="size-4 animate-spin" />
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