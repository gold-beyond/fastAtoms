import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, FileText, Braces } from "lucide-react";

interface FileTab {
  id: string;
  name: string;
  icon: React.ReactNode;
  language: string;
  code: string;
}

const FILES: FileTab[] = [
  {
    id: "html",
    name: "index.html",
    icon: <FileCode className="w-3.5 h-3.5 text-orange-400" />,
    language: "html",
    code: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>现代化 Landing Page</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="hero">
    <nav class="navbar">
      <div class="logo">MyBrand</div>
      <ul class="nav-links">
        <li><a href="#features">特性</a></li>
        <li><a href="#contact">联系我们</a></li>
      </ul>
    </nav>
    <div class="hero-content">
      <h1>构建未来的数字体验</h1>
      <p>使用最先进的技术，打造令人惊叹的网站</p>
      <button class="cta-btn">立即开始</button>
    </div>
  </header>

  <section id="features" class="features">
    <h2>核心特性</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <span class="icon">⚡</span>
        <h3>极速性能</h3>
        <p>毫秒级加载，流畅体验</p>
      </div>
      <div class="feature-card">
        <span class="icon">🎨</span>
        <h3>精美设计</h3>
        <p>现代化UI，赏心悦目</p>
      </div>
      <div class="feature-card">
        <span class="icon">🔒</span>
        <h3>安全可靠</h3>
        <p>企业级安全保障</p>
      </div>
    </div>
  </section>

  <script src="app.js"></script>
</body>
</html>`,
  },
  {
    id: "css",
    name: "styles.css",
    icon: <FileText className="w-3.5 h-3.5 text-blue-400" />,
    language: "css",
    code: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
  color: #f8fafc;
  background: #0f0f23;
}

.hero {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
  display: flex;
  flex-direction: column;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 4rem;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(to right, #6366f1, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
}

.hero-content h1 {
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  background: linear-gradient(to right, #fff, #c7d2fe);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.cta-btn {
  margin-top: 2rem;
  padding: 0.875rem 2.5rem;
  background: linear-gradient(to right, #6366f1, #8b5cf6);
  border: none;
  border-radius: 9999px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.cta-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
}

.features {
  padding: 6rem 4rem;
  text-align: center;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-top: 3rem;
}

.feature-card {
  background: rgba(26, 26, 46, 0.8);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 1rem;
  padding: 2rem;
  transition: transform 0.3s, border-color 0.3s;
}

.feature-card:hover {
  transform: translateY(-4px);
  border-color: rgba(99, 102, 241, 0.5);
}`,
  },
  {
    id: "js",
    name: "app.js",
    icon: <Braces className="w-3.5 h-3.5 text-yellow-400" />,
    language: "javascript",
    code: `// 平滑滚动
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// 滚动动画
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-in');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card').forEach(card => {
  observer.observe(card);
});

// 导航栏滚动效果
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

console.log('🚀 Landing page loaded successfully!');`,
  },
];

export default function CodeEditor() {
  const [activeTab, setActiveTab] = useState("html");

  const activeFile = FILES.find((f) => f.id === activeTab) || FILES[0];
  const lines = activeFile.code.split("\n");

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] rounded-tl-lg overflow-hidden">
      {/* File Tabs */}
      <div className="flex items-center bg-[#0f0f23] border-b border-border overflow-x-auto">
        {FILES.map((file) => (
          <button
            key={file.id}
            onClick={() => setActiveTab(file.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-r border-border transition-colors whitespace-nowrap ${
              activeTab === file.id
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
  const keywords =
    /\b(const|let|var|function|if|else|return|document|window|new|this)\b/g;
  const strings = /(['"`])(.*?)\1/g;

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