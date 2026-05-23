import { useState, useCallback } from 'react';
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
import { useAuth } from '@/hooks/useAuth';

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

export default function IndexPage() {
  const { user, loading, login, logout } = useAuth();
  const [publishOpen, setPublishOpen] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const handleSelectProject = useCallback((project: Project) => {
    setCurrentProject(project);
  }, []);

  const handleConversationSaved = useCallback((id: string) => {
    setConversationId(id);
  }, []);

  const isLoggedIn = !!user;

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
      <div className="flex-1 flex overflow-hidden">
        {/* Project Sidebar */}
        {isLoggedIn && (
          <ProjectSidebar
            visible={sidebarVisible}
            onClose={() => setSidebarVisible(false)}
            onSelectProject={handleSelectProject}
            currentProjectId={currentProject?.id}
          />
        )}

        {/* Chat Panel - Left */}
        {!chatCollapsed && (
          <div className="w-[35%] min-w-[280px] max-w-[420px]">
            <ChatPanel
              conversationId={conversationId}
              onConversationSaved={handleConversationSaved}
              isLoggedIn={isLoggedIn}
            />
          </div>
        )}

        {/* Right Panels */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Code Editor - Top Right */}
          <div className="flex-1 min-h-0">
            <CodeEditor />
          </div>

          {/* Preview Panel - Bottom Right */}
          <div className="h-[45%] min-h-[200px]">
            <PreviewPanel />
          </div>
        </div>
      </div>

      {/* Publish Dialog */}
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
    </div>
  );
}