'use client';

import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    container: 'py-8 px-3',
    iconWrap: 'w-9 h-9 rounded-lg',
    iconSize: 'h-4 w-4',
    title: 'text-xs',
    description: 'text-[11px]',
    button: 'h-7 text-[11px]',
  },
  md: {
    container: 'py-16 px-4',
    iconWrap: 'w-12 h-12 rounded-xl',
    iconSize: 'h-6 w-6',
    title: 'text-sm',
    description: 'text-xs',
    button: 'h-8 text-xs',
  },
  lg: {
    container: 'py-24 px-6',
    iconWrap: 'w-16 h-16 rounded-2xl',
    iconSize: 'h-8 w-8',
    title: 'text-base',
    description: 'text-sm',
    button: 'h-9 text-sm',
  },
} as const;

export const EmptyState = React.memo(function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  const cfg = SIZE_CONFIG[size];

  return (
    <div
      className={cn(
        'animate-empty-state-fade-in flex flex-col items-center justify-center text-center',
        cfg.container,
        className,
      )}
      role="status"
    >
      <div className={cn('bg-muted/50 flex items-center justify-center mb-4', cfg.iconWrap)}>
        <Icon className={cn('text-muted-foreground/40', cfg.iconSize)} />
      </div>
      <h3 className={cn('font-medium text-foreground/70 mb-1', cfg.title)}>{title}</h3>
      <p className={cn('text-muted-foreground/50 max-w-xs', cfg.description, size === 'sm' ? 'max-w-[200px]' : '')}>{description}</p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-1.5 mt-4', cfg.button)}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
});
