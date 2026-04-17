import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { MessageSquare, Plus, Clock, Pin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo } from 'react';
import { useChatStore } from '@/stores/chatStore';

export function AppSidebar() {
  const {
    sessions,
    activeSessionId,
    createSession,
    setActiveSession,
    deleteSession,
    loadConversations,
    loaded,
    pinnedSession,
  } = useChatStore();

  useEffect(() => {
    if (!loaded) {
      void loadConversations();
    }
  }, [loaded, loadConversations]);

  const sessionHistory = useMemo(
    () =>
      sessions.map((session) => {
        const lastMessage =
          session.messages[session.messages.length - 1]?.content ??
          '点击继续该会话';
        const timestamp = new Date(session.updatedAt).toLocaleDateString(
          'zh-CN',
          {
            month: 'numeric',
            day: 'numeric',
          }
        );
        return { ...session, lastMessage, timestamp };
      }),
    [sessions]
  );

  const pinnedChats = sessionHistory.filter((chat) => chat.isPinned);
  const recentChats = sessionHistory.filter((chat) => !chat.isPinned);

  const handleNewChat = async () => {
    await createSession();
  };

  const handleDeleteChat = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSession(id);
  };

  const handlePinned = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await pinnedSession(id);
  };

  return (
    <Sidebar collapsible='icon'>
      {/* 头部 - 新建对话按钮 */}
      <SidebarHeader className='border-b px-3 py-3 group-data-[collapsible=icon]:px-2'>
        <div className='flex items-center gap-2 group-data-[collapsible=icon]:justify-center place-content-between'>
          <SidebarTrigger className='shrink-0 cursor-pointer' />
          <Button
            onClick={() => void handleNewChat()}
            className='w-auto justify-end gap-2 group-data-[collapsible=icon]:hidden'
            variant='default'
            size='sm'
          >
            <Plus className='h-4 w-4' />
            新对话
          </Button>
        </div>
      </SidebarHeader>

      {/* 内容 - 聊天历史列表 */}
      <SidebarContent>
        {/* 置顶对话 */}
        {pinnedChats.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Pin className='mr-1 h-3 w-3' />
              置顶
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pinnedChats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      tooltip={chat.title}
                      size='lg'
                      isActive={activeSessionId === chat.id}
                      onClick={() => setActiveSession(chat.id)}
                      className='group h-auto min-h-14 w-[90%] items-start justify-between py-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:min-h-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2'
                    >
                      <div className='flex min-w-0 items-start gap-2 overflow-hidden group-data-[collapsible=icon]:items-center'>
                        <MessageSquare className='h-4 w-4 shrink-0' />
                        <div className='min-w-0 flex-1 overflow-hidden group-data-[collapsible=icon]:hidden'>
                          <div className='truncate text-sm font-medium'>
                            {chat.title}
                          </div>
                          <div className='truncate text-xs text-muted-foreground'>
                            {chat.lastMessage}
                          </div>
                        </div>
                      </div>
                      <div className='ml-2 pr-6 flex shrink-0 items-center gap-1 self-center group-data-[collapsible=icon]:hidden'>
                        <span className='text-xs text-muted-foreground'>
                          {chat.timestamp}
                        </span>
                      </div>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      aria-label='置顶'
                      onClick={(e) => void handlePinned(chat.id, e)}
                      className='!top-1/2 !-translate-y-1/2 mr-5'
                    >
                      <Pin className='mr-1 h-3 w-3' />
                    </SidebarMenuAction>
                    <SidebarMenuAction
                      showOnHover
                      aria-label='删除会话'
                      onClick={(e) => void handleDeleteChat(chat.id, e)}
                      className='!top-1/2 !-translate-y-1/2'
                    >
                      <Trash2 className='h-3 w-3' />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* 最近对话 */}
        {recentChats.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Clock className='mr-1 h-3 w-3' />
              最近对话
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recentChats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      tooltip={chat.title}
                      size='lg'
                      isActive={activeSessionId === chat.id}
                      onClick={() => setActiveSession(chat.id)}
                      className='group h-auto min-h-14 w-[90%] items-start justify-between py-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:min-h-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2'
                    >
                      <div className='flex min-w-0 items-start gap-2 overflow-hidden group-data-[collapsible=icon]:items-center'>
                        <MessageSquare className='h-4 w-4 shrink-0' />
                        <div className='min-w-0 flex-1 overflow-hidden group-data-[collapsible=icon]:hidden'>
                          <div className='truncate text-sm font-medium'>
                            {chat.title}
                          </div>
                          <div className='truncate text-xs text-muted-foreground'>
                            {chat.lastMessage}
                          </div>
                        </div>
                      </div>
                      <div className='ml-2 pr-6 flex shrink-0 items-center gap-1 self-center group-data-[collapsible=icon]:hidden'>
                        <span className='text-xs text-muted-foreground'>
                          {chat.timestamp}
                        </span>
                      </div>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      aria-label='置顶'
                      onClick={(e) => void handlePinned(chat.id, e)}
                      className='!top-1/2 !-translate-y-1/2 mr-5'
                    >
                      <Pin className='mr-1 h-3 w-3' />
                    </SidebarMenuAction>
                    <SidebarMenuAction
                      showOnHover
                      aria-label='删除会话'
                      onClick={(e) => void handleDeleteChat(chat.id, e)}
                      className='!top-1/2 !-translate-y-1/2'
                    >
                      <Trash2 className='h-3 w-3' />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* 底部 - 统计信息 */}
      <SidebarFooter className='border-t p-3'>
        <div className='text-xs text-muted-foreground text-center'>
          共 {sessions.length} 个对话
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
