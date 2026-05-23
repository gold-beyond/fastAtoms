export interface ConversationItem {
  id: string;
  title: string;
  created_at?: string;
  messages?: string;
}

export const LOCAL_STORAGE_KEY = 'atoms_local_conversations';

export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export function getLocalConversations(): ConversationItem[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalConversations(conversations: ConversationItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // ignore
  }
}

export function deleteLocalConversation(id: string) {
  const conversations = getLocalConversations();
  const filtered = conversations.filter((c) => c.id !== id);
  saveLocalConversations(filtered);
}

export function renameLocalConversation(id: string, newTitle: string) {
  const conversations = getLocalConversations();
  const conv = conversations.find((c) => c.id === id);
  if (conv) {
    conv.title = newTitle;
    saveLocalConversations(conversations);
  }
}