'use client';

import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center animate-scale-in', className)}>
      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <h3 className="text-sm font-medium text-foreground/70 mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground/50 max-w-xs mb-4">{description}</p>
      {action && (
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
