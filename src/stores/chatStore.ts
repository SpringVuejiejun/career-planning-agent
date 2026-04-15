import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ChatRole = 'user' | 'assistant';

export type StoredChatMessage = {
  role: ChatRole;
  content: string;
  keyPoints?: string[];
  suggestions?: string[];
};

export type ChatSession = {
  id: string;
  title: string;
  messages: StoredChatMessage[];
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
};

type ChatStore = {
  sessions: ChatSession[];
  activeSessionId: string | null;
  createSession: () => string;
  setActiveSession: (id: string) => void;
  updateActiveMessages: (messages: StoredChatMessage[]) => void;
  clearActiveMessages: () => void;
  deleteSession: (id: string) => void;
};

const EMPTY_TITLE = '新对话';

const generateSessionId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getSessionTitle = (messages: StoredChatMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const sourceText = firstUserMessage?.content?.trim();
  if (!sourceText) return EMPTY_TITLE;
  return sourceText.slice(0, 20);
};

const createEmptySession = (): ChatSession => {
  const now = Date.now();
  return {
    id: generateSessionId(),
    title: EMPTY_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
};

const sanitizeMessages = (messages: StoredChatMessage[]) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
    keyPoints: message.keyPoints,
    suggestions: message.suggestions,
  }));

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      createSession: () => {
        const session = createEmptySession();
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: session.id,
        }));
        return session.id;
      },
      setActiveSession: (id) => {
        set((state) => {
          const sessionExists = state.sessions.some((session) => session.id === id);
          if (!sessionExists) return state;
          return { activeSessionId: id };
        });
      },
      updateActiveMessages: (messages) => {
        const { activeSessionId } = get();
        if (!activeSessionId) {
          const newSessionId = get().createSession();
          set((state) => ({
            sessions: state.sessions.map((session) =>
              session.id === newSessionId
                ? {
                    ...session,
                    messages: sanitizeMessages(messages),
                    title: getSessionTitle(messages),
                    updatedAt: Date.now(),
                  }
                : session
            ),
          }));
          return;
        }

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: sanitizeMessages(messages),
                  title: getSessionTitle(messages),
                  updatedAt: Date.now(),
                }
              : session
          ),
        }));
      },
      clearActiveMessages: () => {
        const { activeSessionId } = get();
        if (!activeSessionId) {
          get().createSession();
          return;
        }

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  messages: [],
                  title: EMPTY_TITLE,
                  updatedAt: Date.now(),
                }
              : session
          ),
        }));
      },
      deleteSession: (id) => {
        set((state) => {
          const sessions = state.sessions.filter((session) => session.id !== id);
          const isDeletingActive = state.activeSessionId === id;
          if (sessions.length === 0) {
            const fallback = createEmptySession();
            return {
              sessions: [fallback],
              activeSessionId: fallback.id,
            };
          }

          return {
            sessions,
            activeSessionId: isDeletingActive
              ? sessions[0].id
              : state.activeSessionId,
          };
        });
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
      merge: (persistedState, currentState) => {
        const incoming = (persistedState as {
          sessions?: ChatSession[];
          activeSessionId?: string | null;
          messages?: StoredChatMessage[];
        }) || { };

        if (Array.isArray(incoming.sessions) && incoming.sessions.length > 0) {
          const activeId =
            incoming.activeSessionId && incoming.sessions.some((s) => s.id === incoming.activeSessionId)
              ? incoming.activeSessionId
              : incoming.sessions[0].id;

          return {
            ...currentState,
            sessions: incoming.sessions,
            activeSessionId: activeId,
          };
        }

        // Backward compatibility with old single-session schema.
        if (Array.isArray(incoming.messages)) {
          const fallback = createEmptySession();
          fallback.messages = incoming.messages;
          fallback.title = getSessionTitle(incoming.messages);
          fallback.updatedAt = Date.now();
          return {
            ...currentState,
            sessions: [fallback],
            activeSessionId: fallback.id,
          };
        }

        const fallback = createEmptySession();
        return {
          ...currentState,
          sessions: [fallback],
          activeSessionId: fallback.id,
        };
      },
    }
  )
);