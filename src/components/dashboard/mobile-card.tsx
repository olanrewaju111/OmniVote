'use client';

import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MobileCardProps {
  /** Only render children when on mobile */
  children: React.ReactNode;
}

/**
 * Wrapper that only shows its children on mobile screens.
 * Use alongside a table — show the table on desktop, cards on mobile.
 */
export function MobileOnly({ children }: MobileCardProps) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return <>{children}</>;
}

/**
 * Wrapper that only shows its children on desktop screens.
 */
export function DesktopOnly({ children }: MobileCardProps) {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return <>{children}</>;
}

interface CardField {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  color?: string;
}

interface DataCardProps {
  fields: CardField[];
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode; // extra content like badges/actions
}

/**
 * A mobile-optimized card that displays key-value pairs in a compact layout.
 * Replaces table rows on mobile.
 */
export function DataCard({ fields, onClick, className, children }: DataCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-border bg-card p-3 space-y-2',
        onClick && 'cursor-pointer active:bg-accent/50 transition-colors',
        className
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {/* First field as card header */}
      {fields[0] && (
        <div className="flex items-center justify-between">
          <span className={cn('text-sm', fields[0].bold ? 'font-semibold' : 'font-medium text-foreground')}>
            {fields[0].value}
          </span>
          {fields[0].color && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded', fields[0].color)}>
              {fields[0].label}
            </span>
          )}
        </div>
      )}

      {/* Remaining fields as grid */}
      {fields.length > 1 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {fields.slice(1).map((field, i) => (
            <div key={i} className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{field.label}</p>
              <p className={cn('text-xs truncate', field.bold && 'font-medium', field.color && 'text-' + field.color.replace('text-', ''))}>
                {field.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
