import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useChatStore = create(
    persist((set) => ({
        messages: [],
        // 更新消息
        updateMessages: (newMessages) => {
            set({ messages: newMessages})
        },
        // 清理消息
        clearMessages: () => {
            set({ messages: []})
        }
    }),
    {
        name: 'chat-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
            messages: state.messages
        })
    })
)