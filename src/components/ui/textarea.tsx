import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ 
  className, 
  maxLength,        // 最大字符数（可选）
  maxRows = 8,      // 最大行数，默认5行后滚动
  onInput,          // 保留原有的onInput事件
  ...props 
}: React.ComponentProps<"textarea"> & { 
  maxRows?: number 
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // 自动调整高度的函数
  const autoResize = React.useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto'
    
    // 计算单行高度（通过line-height或获取样式）
    const computedStyle = window.getComputedStyle(textarea)
    const lineHeight = parseInt(computedStyle.lineHeight) || 20
    
    // 最大高度 = 行高 × 最大行数
    const maxHeight = lineHeight * maxRows
    
    // 设置新高度（不超过最大高度）
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
    
    // 根据是否达到最大高度来控制滚动条
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [maxRows])

  // 处理输入事件
  const handleInput = (e: React.InputEvent<HTMLTextAreaElement>) => {
    autoResize()
    onInput?.(e)  // 调用外部传入的onInput
  }

  // 组件挂载和内容变化时调整高度
  React.useEffect(() => {
    autoResize()
  }, [autoResize, props.value])  // 监听value变化（受控组件）

  return (
    <textarea
      ref={textareaRef}
      data-slot="textarea"
      className={cn(
        "flex w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      maxLength={maxLength}
      onInput={handleInput}
      {...props}
    />
  )
}

export { Textarea }