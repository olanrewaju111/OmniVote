'use client';

import { useState } from 'react';
import { Download, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDashboardStore } from '@/store/dashboard';
import { toast } from 'sonner';

interface ExportButtonProps {
  /** Export type — maps to the `type` query param */
  exportType: 'incidents' | 'alerts' | 'audit-logs' | 'pvt';
  /** Optional label override */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'default';
}

const TYPE_LABELS: Record<string, string> = {
  incidents: 'Incidents',
  alerts: 'Alerts',
  'audit-logs': 'Audit Logs',
  pvt: 'PVT Results',
};

export function ExportButton({ exportType, label, size = 'sm' }: ExportButtonProps) {
  const tenantId = useDashboardStore((s) => s.tenantId);
  const [exporting, setExporting] = useState(false);

  const handleExport = (format: 'csv' | 'json') => {
    if (!tenantId) {
      toast.error('No tenant context');
      return;
    }
    setExporting(true);
    const url = `/api/export?type=${exportType}&tenantId=${tenantId}&format=${format}`;

    // Use fetch to trigger download and handle errors
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Export failed');

        // Get filename from Content-Disposition header
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
          toast.success(
            `Exported ${TYPE_LABELS[exportType]} as ${format.toUpperCase()}`,
          );
        });
      })
      .catch(() => {
        toast.error('Export failed. Try again.');
      })
      .finally(() => setExporting(false));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className="gap-1.5 text-xs"
          disabled={exporting}
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
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => handleExport('csv')}
          disabled={exporting}
          className="text-xs gap-2 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          CSV Spreadsheet
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('json')}
          disabled={exporting}
          className="text-xs gap-2 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          JSON Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
