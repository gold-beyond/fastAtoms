import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, History, PanelLeftClose, PanelLeft } from 'lucide-react';
import { ConversationItem, formatRelativeTime } from '@/lib/conversationUtils';

interface ConversationSidebarProps {
  conversations: ConversationItem[];
  currentConvId: string | null;
  onSelectConversation: (conv: ConversationItem) => void;
  onNewConversation: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ConversationSidebar({
  conversations,
  currentConvId,
  onSelectConversation,
  onNewConversation,
  collapsed,
  onToggleCollapse,
}: ConversationSidebarProps) {
  return (
    <div
      className={`flex flex-col h-full bg-[#0f0f23] border-r border-border transition-all duration-200 ease-in-out ${
        collapsed ? 'w-0 overflow-hidden' : 'w-56'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border min-w-[224px]">
        <span className="text-sm font-medium text-muted-foreground">对话</span>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-muted-foreground hover:text-foreground"
          onClick={onToggleCollapse}
          title="收起侧栏"
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 py-2 border-b border-border min-w-[224px]">
        <Button
          onClick={onNewConversation}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0 text-xs h-8"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          新建对话
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1 min-w-[224px]">
        <div className="p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="w-8 h-8 mb-3 opacity-50" />
              <p className="text-xs">暂无对话记录</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  currentConvId === conv.id
                    ? 'bg-indigo-500/15 border border-indigo-500/30'
                    : 'hover:bg-[#1a1a2e] border border-transparent'
                }`}
              >
                <p className="text-xs text-foreground truncate">
                  {conv.title || '新对话'}
                </p>
                {conv.created_at && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatRelativeTime(conv.created_at)}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/** Expand toggle button shown when sidebar is collapsed */
export function ConversationSidebarToggle({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-3 left-2 z-20 w-7 h-7 text-muted-foreground hover:text-foreground bg-[#0f0f23]/80 backdrop-blur-sm border border-border"
      onClick={onClick}
      title="展开对话侧栏"
    >
      <PanelLeft className="w-4 h-4" />
    </Button>
  );
}