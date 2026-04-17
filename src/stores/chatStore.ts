import { create } from 'zustand';
import {
  createConversation,
  deleteConversation as deleteConversationApi,
  listConversations,
} from '@/lib/chat-api';

type ChatRole = 'user' | 'assistant';

export type StoredChatMessage = {
  role: ChatRole;
  content: string;
  keyPoints?: string[];
  suggestions?: string[];
};

export type ChatSession = {
  id: number;
  title: string;
  messages: StoredChatMessage[];
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
};

type ChatStore = {
  sessions: ChatSession[];
  activeSessionId: number | null;
  loaded: boolean;
  createSession: (title?: string) => Promise<number | null>;
  setActiveSession: (id: number) => void;
  loadConversations: () => Promise<void>;
  upsertConversation: (session: ChatSession) => void;
  updateActiveMessages: (messages: StoredChatMessage[]) => void;
  hydrateSessionMessages: (id: number, messages: StoredChatMessage[]) => void;
  clearActiveMessages: () => void;
  deleteSession: (id: number) => Promise<void>;
  pinnedSession: (is: number) => void;
};

const EMPTY_TITLE = '新对话';

const getSessionTitle = (messages: StoredChatMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const sourceText = firstUserMessage?.content?.trim();
  if (!sourceText) return EMPTY_TITLE;
  return sourceText.slice(0, 20);
};

// const createEmptySession = (): ChatSession => {
//   const now = Date.now();
//   return {
//     id: -now,
//     title: EMPTY_TITLE,
//     messages: [],
//     createdAt: now,
//     updatedAt: now,
//   };
// };

const sanitizeMessages = (messages: StoredChatMessage[]) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
    keyPoints: message.keyPoints,
    suggestions: message.suggestions,
  }));

export const useChatStore = create<ChatStore>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loaded: false,
  loadConversations: async () => {
    const result = await listConversations(0, 50);
    const sessions: ChatSession[] = result.items.map((item) => {
      const ts = item.last_message_at
        ? new Date(item.last_message_at).getTime()
        : item.created_at
          ? new Date(item.created_at).getTime()
          : Date.now();
      return {
        id: item.id,
        title: item.title || EMPTY_TITLE,
        messages: [],
        createdAt: item.created_at ? new Date(item.created_at).getTime() : ts,
        updatedAt: ts,
      };
    });
    set((state) => ({
      sessions,
      activeSessionId:
        state.activeSessionId &&
        sessions.some((s) => s.id === state.activeSessionId)
          ? state.activeSessionId
          : (sessions[0]?.id ?? null),
      loaded: true,
    }));
  },
  createSession: async (title) => {
    const created = await createConversation(title);
    const now = Date.now();
    const session: ChatSession = {
      id: created.id,
      title: created.title || EMPTY_TITLE,
      messages: [],
      createdAt: created.created_at
        ? new Date(created.created_at).getTime()
        : now,
      updatedAt: created.last_message_at
        ? new Date(created.last_message_at).getTime()
        : now,
    };
    set((state) => ({
      sessions: [session, ...state.sessions.filter((s) => s.id !== session.id)],
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
  upsertConversation: (session) => {
    set((state) => ({
      sessions: [session, ...state.sessions.filter((s) => s.id !== session.id)],
    }));
  },
  updateActiveMessages: (messages) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              messages: sanitizeMessages(messages),
              title: getSessionTitle(messages) || session.title,
              updatedAt: Date.now(),
            }
          : session
      ),
    }));
  },
  hydrateSessionMessages: (id, messages) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id
          ? {
              ...session,
              messages: sanitizeMessages(messages),
              title: getSessionTitle(messages) || session.title,
              updatedAt: Date.now(),
            }
          : session
      ),
    }));
  },
  clearActiveMessages: () => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
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
  deleteSession: async (id) => {
    await deleteConversationApi(id);
    set((state) => {
      const sessions = state.sessions.filter((session) => session.id !== id);
      return {
        sessions,
        activeSessionId:
          state.activeSessionId === id
            ? (sessions[0]?.id ?? null)
            : state.activeSessionId,
      };
    });
  },
  pinnedSession: (id: number) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, isPinned: !s.isPinned } : s
      ),
    }));
  },
}));
