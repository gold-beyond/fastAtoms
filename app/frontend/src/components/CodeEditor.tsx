import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, FileText, Braces, Code2 } from "lucide-react";

interface FileTab {
  id: string;
  name: string;
  icon: React.ReactNode;
  language: string;
  code: string;
}

interface CodeEditorProps {
  files?: FileTab[];
}

export default function CodeEditor({ files }: CodeEditorProps) {
  const [activeTab, setActiveTab] = useState<string>("");

  const currentFiles = files || [];
  const activeFile = currentFiles.find((f) => f.id === activeTab) || currentFiles[0];

  // If no files, show empty state
  if (currentFiles.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#0d0d1a] rounded-tl-lg overflow-hidden">
        {/* Empty Tab Bar */}
        <div className="flex items-center bg-[#0f0f23] border-b border-border h-9">
          <div className="flex-1 bg-[#0f0f23]" />
        </div>

        {/* Empty State */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Code2 className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/50">等待代码生成...</p>
        </div>
      </div>
    );
  }

  const lines = activeFile.code.split("\n");

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] rounded-tl-lg overflow-hidden">
      {/* File Tabs */}
      <div className="flex items-center bg-[#0f0f23] border-b border-border overflow-x-auto">
        {currentFiles.map((file) => (
          <button
            key={file.id}
            onClick={() => setActiveTab(file.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-r border-border transition-colors whitespace-nowrap ${
              (activeTab === file.id || (!activeTab && file.id === currentFiles[0]?.id))
                ? "bg-[#0d0d1a] text-foreground border-b-2 border-b-indigo-500"
                : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a2e]"
            }`}
          >
            {file.icon}
            {file.name}
          </button>
        ))}
        <div className="flex-1 bg-[#0f0f23]" />
      </div>

      {/* Code Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 font-mono text-xs leading-5">
          {lines.map((line, index) => (
            <div
              key={index}
              className="flex code-line-appear"
              style={{ animationDelay: `${Math.min(index * 20, 500)}ms` }}
            >
              <span className="inline-block w-8 text-right mr-4 text-muted-foreground/50 select-none">
                {index + 1}
              </span>
              <span className="text-foreground/90 whitespace-pre">
                {highlightCode(line, activeFile.language)}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function highlightCode(line: string, language: string): React.ReactNode {
  // Simple syntax highlighting
  if (language === "html") {
    return highlightHTML(line);
  } else if (language === "css") {
    return highlightCSS(line);
  } else if (language === "javascript") {
    return highlightJS(line);
  }
  return line;
}

function highlightHTML(line: string): React.ReactNode {
  // Highlight HTML tags and attributes
  const parts: React.ReactNode[] = [];
  const remaining = line;
  let key = 0;

  const tagRegex = /(<\/?[\w-]+|>|\/?>)/g;
  let match;
  let lastIndex = 0;

  while ((match = tagRegex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++} className="text-foreground/80">
          {remaining.slice(lastIndex, match.index)}
        </span>
      );
    }
    parts.push(
      <span key={key++} className="text-pink-400">
        {match[0]}
      </span>
    );
    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < remaining.length) {
    parts.push(
      <span key={key++} className="text-foreground/80">
        {remaining.slice(lastIndex)}
      </span>
    );
  }

  return parts.length > 0 ? <>{parts}</> : <span>{line}</span>;
}

function highlightCSS(line: string): React.ReactNode {
  if (line.includes("{") || line.includes("}")) {
    return <span className="text-yellow-300">{line}</span>;
  }
  if (line.includes(":") && !line.includes("//")) {
    const colonIndex = line.indexOf(":");
    return (
      <>
        <span className="text-cyan-300">{line.slice(0, colonIndex)}</span>
        <span className="text-foreground/60">:</span>
        <span className="text-orange-300">{line.slice(colonIndex + 1)}</span>
      </>
    );
  }
  if (line.trim().startsWith("/*") || line.trim().startsWith("*")) {
    return <span className="text-muted-foreground/60">{line}</span>;
  }
  return <span className="text-foreground/80">{line}</span>;
}

function highlightJS(line: string): React.ReactNode {
  if (line.trim().startsWith("//")) {
    return <span className="text-muted-foreground/60">{line}</span>;
  }

  const result = line;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;

  // Simple keyword highlight
  const combined = /(\b(?:const|let|var|function|if|else|return|new|this)\b)|(\b(?:document|window|console)\b)|(['"`].*?['"`])/g;
  let m;

  while ((m = combined.exec(result)) !== null) {
    if (m.index > lastIdx) {
      parts.push(
        <span key={key++} className="text-foreground/80">
          {result.slice(lastIdx, m.index)}
        </span>
      );
    }
    if (m[1]) {
      parts.push(
        <span key={key++} className="text-purple-400">
          {m[0]}
        </span>
      );
    } else if (m[2]) {
      parts.push(
        <span key={key++} className="text-cyan-300">
          {m[0]}
        </span>
      );
    } else if (m[3]) {
      parts.push(
        <span key={key++} className="text-green-300">
          {m[0]}
        </span>
      );
    }
    lastIdx = combined.lastIndex;
  }

  if (lastIdx < result.length) {
    parts.push(
      <span key={key++} className="text-foreground/80">
        {result.slice(lastIdx)}
      </span>
    );
  }

  return parts.length > 0 ? <>{parts}</> : <span>{line}</span>;
}