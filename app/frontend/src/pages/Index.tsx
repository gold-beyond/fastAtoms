import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Rocket, PanelLeft, Code2 } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import CodeEditor from "@/components/CodeEditor";
import PreviewPanel from "@/components/PreviewPanel";
import PublishDialog from "@/components/PublishDialog";

const LOGO_URL =
  "https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-22/pcdp5pyaagrq/atoms-logo-glow.png";

export default function IndexPage() {
  const [publishOpen, setPublishOpen] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

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
            现代化 Landing Page
          </span>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel - Left */}
        {!chatCollapsed && (
          <div className="w-[35%] min-w-[280px] max-w-[420px]">
            <ChatPanel />
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