import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-7 h-7" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="p-1.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors"
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
