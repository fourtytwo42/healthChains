'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

/**
 * Theme Toggle - Switches between light and dark themes
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  // Normalize theme - if it's 'system' or anything else, default to 'light'
  const currentTheme = theme === 'dark' ? 'dark' : 'light';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        setTheme(currentTheme === 'light' ? 'dark' : 'light');
      }}
      aria-label="Toggle theme"
    >
      {currentTheme === 'light' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}

