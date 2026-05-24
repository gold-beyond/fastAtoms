import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const LOGO_URL =
  'https://mgx-backend-cdn.metadl.com/generate/images/1263427/2026-05-22/pcdp5pyaagrq/atoms-logo-glow.png';

const LOGIN_TIPS = ['输入用户名和密码登录', '登录后即可开始创作', '忘记密码？联系管理员重置'];
const REGISTER_TIPS = ['输入用户名和密码即可注册', '注册后数据仅自己可见', '密码至少需要4个字符'];

export default function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();

  const tips = isRegister ? REGISTER_TIPS : LOGIN_TIPS;

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    setTipIndex(0);
    const timer = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegister]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !password) return;
    setSubmitting(true);
    setError('');
    try {
      if (isRegister) {
        await register(trimmed, password);
      } else {
        await login(trimmed, password);
      }
    } catch (err) {
      setError((err as Error).message || (isRegister ? '注册失败，请重试' : '登录失败，请重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsRegister((prev) => !prev);
    setError('');
    setName('');
    setPassword('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-border rounded-xl p-8 space-y-5 shadow-lg"
        >
          <div className="flex flex-col items-center gap-3">
            <img
              src={LOGO_URL}
              alt="fastAtoms Logo"
              className="w-12 h-12 rounded-lg"
            />
            <span className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              fastAtoms
            </span>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-foreground text-xl font-semibold">
              {isRegister ? '创建账号' : '欢迎回来'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isRegister ? '注册新账号开始创作' : '登录你的账号继续创作'}
            </p>
          </div>

          <div className="space-y-3">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="用户名"
              autoComplete="username"
              className="bg-white border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50 h-11 text-sm"
              disabled={submitting}
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="密码"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className="bg-white border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50 h-11 text-sm"
              disabled={submitting}
            />

            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}

            <Button
              type="submit"
              disabled={!name.trim() || !password || submitting}
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0 h-11 text-sm font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isRegister ? '注册中...' : '登录中...'}
                </>
              ) : (
                isRegister ? '注册' : '登录'
              )}
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center transition-opacity duration-500">
            {tips[tipIndex]}
          </p>
        </form>
      </div>
    </div>
  );
}
