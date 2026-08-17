'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className={cn('h-7 w-7 p-0', className)}>
        <Monitor className="h-3.5 w-3.5" />
      </Button>
    );
  }

  const current = resolvedTheme || 'dark';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 w-7 p-0 bg-background/60 border border-border/60', className)}
          aria-label="Toggle theme"
        >
          {current === 'dark' ? (
            <Moon className="h-3.5 w-3.5" />
          ) : (
            <Sun className="h-3.5 w-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={cn('gap-2 cursor-pointer', theme === 'light' && 'bg-accent')}
        >
          <Sun className="h-3.5 w-3.5" />
          <span className="text-xs">Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={cn('gap-2 cursor-pointer', theme === 'dark' && 'bg-accent')}
        >
          <Moon className="h-3.5 w-3.5" />
          <span className="text-xs">Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={cn('gap-2 cursor-pointer', theme === 'system' && 'bg-accent')}
        >
          <Monitor className="h-3.5 w-3.5" />
          <span className="text-xs">System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
