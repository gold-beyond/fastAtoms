import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Rocket, PanelLeft, Code2, LogOut, FolderOpen, User } from 'lucide-react';
import ChatPanel from '@/components/ChatPanel';
import CodeEditor from '@/components/CodeEditor';
import PreviewPanel from '@/components/PreviewPanel';
import PublishDialog from '@/components/PublishDialog';
import ProjectSidebar from '@/components/ProjectSidebar';
import ConversationSidebar, { ConversationSidebarToggle } from '@/components/ConversationSidebar';
import { useAuth } from '@/hooks/useAuth';
import { ConversationItem, getLocalConversations, saveLocalConversations } from '@/lib/conversationUtils';
import client from '@/lib/client';

const LOGO_URL =
  'https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-22/pcdp5pyaagrq/atoms-logo-glow.png';

interface Project {
  id: string;
  name: string;
  code_html?: string;
  code_css?: string;
  code_js?: string;
  published_url?: string;
  created_at?: string;
}

interface GeneratedFile {
  id: string;
  name: string;
  icon: React.ReactNode;
  language: string;
  code: string;
}

export default function IndexPage() {
  const { user, loading, login, logout } = useAuth();
  const [publishOpen, setPublishOpen] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string>('');

  // Conversation state (lifted from ChatPanel)
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [convSidebarCollapsed, setConvSidebarCollapsed] = useState(false);

  const isLoggedIn = !!user;

  const loadConversationList = useCallback(async () => {
    if (isLoggedIn) {
      try {
        const response = await client.entities.conversations.list();
        const data = response?.data;
        if (Array.isArray(data)) {
          const items: ConversationItem[] = data.map((item: Record<string, unknown>) => ({
            id: item.id as string,
            title: (item.title as string) || '新对话',
            created_at: item.created_at as string | undefined,
            messages: item.messages as string | undefined,
          }));
          // Sort by created_at descending
          items.sort((a, b) => {
            if (!a.created_at || !b.created_at) return 0;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          setConversations(items);
        }
      } catch {
        // Silently handle errors
      }
    } else {
      setConversations(getLocalConversations());
    }
  }, [isLoggedIn]);

  // Load conversation list on mount and when login state changes
  useEffect(() => {
    loadConversationList();
  }, [loadConversationList]);

  const handleSelectConversation = useCallback((conv: ConversationItem) => {
    setCurrentConvId(conv.id);
  }, []);

  const handleNewConversation = useCallback(() => {
    setCurrentConvId(null);
  }, []);

  const handleConversationSaved = useCallback(
    (_id: string) => {
      loadConversationList();
    },
    [loadConversationList]
  );

  const handleCurrentConvIdChange = useCallback((id: string | null) => {
    setCurrentConvId(id);
  }, []);

  const handleSelectProject = useCallback((project: Project) => {
    setCurrentProject(project);
  }, []);

  const [rightPanelTab, setRightPanelTab] = useState<'preview' | 'editor'>('preview');

  const handleCodeGenerated = useCallback((files: GeneratedFile[], html: string) => {
    setGeneratedFiles(files);
    setPreviewHtml(html);
    setRightPanelTab('preview');
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a1a]">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#0f0f23] border-b border-border z-10">
        <div className="flex items-center gap-3">
          <img
            src={LOGO_URL}
            alt="Atoms Logo"
            className="w-7 h-7 rounded"
          />
          <span className="text-sm font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Atoms
          </span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-[#1a1a2e] rounded border border-border">
            {currentProject?.name || '现代化 Landing Page'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarVisible(!sidebarVisible)}
            >
              <FolderOpen className="w-4 h-4 mr-1" />
              <span className="text-xs">项目</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setChatCollapsed(!chatCollapsed)}
          >
            <PanelLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">面板</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Code2 className="w-4 h-4 mr-1" />
            <span className="text-xs">编辑器</span>
          </Button>
          <Button
            onClick={() => setPublishOpen(true)}
            size="sm"
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0 text-xs"
          >
            <Rocket className="w-3.5 h-3.5 mr-1" />
            发布
          </Button>

          {/* User Avatar / Login */}
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-[#1a1a2e] animate-pulse" />
          ) : isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                >
                  <User className="w-4 h-4 text-white" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-[#1a1a2e] border-border"
              >
                <DropdownMenuItem
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={login}
              className="text-indigo-400 hover:text-indigo-300 text-xs"
            >
              登录
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Project Sidebar */}
        {isLoggedIn && (
          <ProjectSidebar
            visible={sidebarVisible}
            onClose={() => setSidebarVisible(false)}
            onSelectProject={handleSelectProject}
            currentProjectId={currentProject?.id}
          />
        )}

        {/* Conversation Sidebar - Always present */}
        <ConversationSidebar
          conversations={conversations}
          currentConvId={currentConvId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          collapsed={convSidebarCollapsed}
          onToggleCollapse={() => setConvSidebarCollapsed(true)}
        />

        {/* Expand toggle when sidebar is collapsed */}
        {convSidebarCollapsed && (
          <ConversationSidebarToggle onClick={() => setConvSidebarCollapsed(false)} />
        )}

        {/* Chat Panel */}
        {!chatCollapsed && (
          <div className="w-[35%] min-w-[280px] max-w-[420px]">
            <ChatPanel
              onCodeGenerated={handleCodeGenerated}
              isLoggedIn={isLoggedIn}
              currentConvId={currentConvId}
              onCurrentConvIdChange={handleCurrentConvIdChange}
              onConversationSaved={handleConversationSaved}
            />
          </div>
        )}

        {/* Right Panel - Tabbed Editor/Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Header */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0f0f23] border-b border-border">
            <button
              onClick={() => setRightPanelTab('preview')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rightPanelTab === 'preview'
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1a2e]'
              }`}
            >
              预览
            </button>
            <button
              onClick={() => setRightPanelTab('editor')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rightPanelTab === 'editor'
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1a2e]'
              }`}
            >
              编辑器
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0">
            {rightPanelTab === 'preview' ? (
              <PreviewPanel
                hasContent={!!previewHtml}
                htmlContent={previewHtml}
              />
            ) : (
              <CodeEditor files={generatedFiles} />
            )}
          </div>
        </div>
      </div>

      {/* Publish Dialog */}
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
    </div>
  );
}