import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  History,
  PanelLeftClose,
  PanelLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { ConversationItem, formatRelativeTime } from '@/lib/conversationUtils';

interface ConversationSidebarProps {
  conversations: ConversationItem[];
  currentConvId: string | null;
  onSelectConversation: (conv: ConversationItem) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conv: ConversationItem) => void;
  onRenameConversation: (conv: ConversationItem, newTitle: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ConversationSidebar({
  conversations,
  currentConvId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  collapsed,
  onToggleCollapse,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
              <div key={conv.id}>
                {editingId === conv.id ? (
                  <div className="w-full px-3 py-2 rounded-lg border border-indigo-500/30 bg-[#1a1a2e]">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRenameConversation(conv, editTitle.trim() || '新对话');
                          setEditingId(null);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      onBlur={() => {
                        onRenameConversation(conv, editTitle.trim() || '新对话');
                        setEditingId(null);
                      }}
                      autoFocus
                      className="h-6 text-xs bg-transparent border-none p-0 focus-visible:ring-0"
                    />
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectConversation(conv)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelectConversation(conv);
                    }}
                    className={`group w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                      currentConvId === conv.id
                        ? 'bg-indigo-500/15 border border-indigo-500/30'
                        : 'hover:bg-[#1a1a2e] border border-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">
                        {conv.title || '新对话'}
                      </p>
                      {conv.created_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatRelativeTime(conv.created_at)}
                        </p>
                      )}
                    </div>
                    <DropdownMenu
                      open={openMenuId === conv.id}
                      onOpenChange={(open) => setOpenMenuId(open ? conv.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-[#2a2a3e] text-muted-foreground hover:text-foreground transition-all flex-shrink-0"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-[#1a1a2e] border-border w-32"
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(conv.id);
                            setEditTitle(conv.title || '新对话');
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Pencil className="w-3 h-3 mr-2" />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv);
                          }}
                          className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
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
