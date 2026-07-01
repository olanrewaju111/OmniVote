'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDashboardStore } from '@/store/dashboard';
import {
  Clock, MapPin, ShieldCheck, CheckCircle2, AlertTriangle, Eye,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Incident } from '@/app/page';

interface MyReportsProps {
  incidents: Incident[];
}

function formatTime(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
}

function sevColor(s: string) {
  switch (s) {
    case 'CRITICAL': return 'bg-rose text-white border-rose/40';
    case 'HIGH': return 'bg-amber/15 text-amber border-amber/30';
    case 'MEDIUM': return 'bg-cyan/15 text-cyan border-cyan/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

export function MyReports({ incidents }: MyReportsProps) {
  const { user } = useDashboardStore();

  // Show only last 15 as "my" reports
  const myReports = incidents.slice(0, 15);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Eye className="h-4 w-4 text-cyan" />
          My Submission History
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {myReports.length} reports submitted today
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {myReports.map((inc, idx) => (
            <motion.div
              key={inc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.2 }}
              className="rounded-lg border border-border bg-card/60 p-3 space-y-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('text-[10px] h-5 border', sevColor(inc.severity))}>{inc.severity}</Badge>
                <Badge variant="outline" className="text-[10px] h-5">{inc.type.replace(/_/g, ' ')}</Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] h-5 ml-auto',
                    inc.status === 'REVIEWED' ? 'border-emerald/30 text-emerald' :
                    inc.status === 'QUARANTINED' ? 'border-rose/30 text-rose' :
                    'border-amber/30 text-amber'
                  )}
                >
                  {inc.status === 'REVIEWED' && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                  {inc.status}
                </Badge>
              </div>
              <p className="text-xs text-foreground/80">{inc.description}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(inc.submittedAt)}</span>
                {inc.pollingUnit && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{inc.pollingUnit.code}</span>
                )}
                {inc.c2paVerified && (
                  <span className="flex items-center gap-1 text-emerald"><ShieldCheck className="h-3 w-3" />C2PA</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}