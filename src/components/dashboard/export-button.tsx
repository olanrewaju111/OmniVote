'use client';

import { useState } from 'react';
import { Download, Loader2, ChevronDown, FileText, Table, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useDashboardStore } from '@/store/dashboard';
import { toast } from 'sonner';

/** All export types supported by the API */
export type ExportType =
  | 'incidents' | 'audit-logs' | 'results' | 'agents'
  | 'pvt' | 'alerts' | 'voter-suppression' | 'osint'
  | 'security-events' | 'geofence' | 'honeypot' | 'flashpoint'
  | 'accessibility' | 'election-summary';

interface ExportButtonProps {
  /** Export type — maps to the `type` query param */
  exportType: ExportType;
  /** Optional label override */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Optional date range */
  startDate?: string;
  endDate?: string;
}

type ExportFormat = 'csv' | 'excel' | 'pdf';

const TYPE_LABELS: Record<string, string> = {
  incidents: 'Incidents',
  'audit-logs': 'Audit Logs',
  results: 'Election Results',
  agents: 'Field Agents',
  pvt: 'PVT Results',
  alerts: 'Alerts',
  'voter-suppression': 'Voter Suppression',
  osint: 'OSINT Report',
  'security-events': 'Security Events',
  geofence: 'Geofence Zones',
  honeypot: 'Honeypot Analysis',
  flashpoint: 'Flashpoint Forecasts',
  accessibility: 'Accessibility (PWD)',
  'election-summary': 'Election Summary',
};

const FORMAT_CONFIG: {
  format: ExportFormat;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  { format: 'csv', label: 'CSV Spreadsheet', description: '.csv', icon: FileText },
  { format: 'excel', label: 'Excel Workbook', description: '.xlsx', icon: Table },
  { format: 'pdf', label: 'PDF Report', description: '.pdf', icon: FileDown },
];

export function ExportButton({ exportType, label, size = 'sm', startDate, endDate }: ExportButtonProps) {
  const tenantId = useDashboardStore((s) => s.tenantId);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = (format: ExportFormat) => {
    if (!tenantId) {
      toast.error('No tenant context');
      return;
    }
    setExporting(format);
    const params = new URLSearchParams({
      type: exportType,
      tenantId,
      format,
    });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    fetch(`/api/export?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Export failed');
        const cd = res.headers.get('content-disposition');
        const filename =
          cd?.match(/filename="?([^";]+)"?/)?.[1] || `${exportType}.${format}`;
        return res.blob().then((blob) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(a.href);
          toast.success(`Exported ${TYPE_LABELS[exportType] || exportType} as ${format.toUpperCase()}`);
        });
      })
      .catch(() => {
        toast.error('Export failed. Try again.');
      })
      .finally(() => setExporting(null));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className="gap-1.5 text-xs"
          disabled={exporting !== null}
        >
          {exporting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          <span className="hidden sm:inline">{label || 'Export'}</span>
          <ChevronDown className="h-2.5 w-2.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {FORMAT_CONFIG.map(({ format, label: formatLabel, description, icon: Icon }, idx) => (
          <div key={format}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => handleExport(format)}
              disabled={exporting !== null}
              className="text-xs gap-2.5 cursor-pointer py-2"
            >
              {exporting === format ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Icon className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="flex flex-col">
                <span>{formatLabel}</span>
                <span className="text-[10px] text-muted-foreground font-normal">{description}</span>
              </span>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
