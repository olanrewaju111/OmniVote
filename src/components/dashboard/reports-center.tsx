'use client';

import React from 'react';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import {
  FileText, FileDown, FileSpreadsheet, BarChart3, ShieldAlert, MapPin, Users,
  AlertTriangle, Eye, Globe, Shield, Zap, Clock, Download, Loader2,
  Calendar, Filter, RefreshCw, CheckCircle2, PieChart, Activity, Landmark, TrendingUp,
  Timer, LayoutTemplate, CalendarClock, Play, Pause, Plus, X, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDashboardStore } from '@/store/dashboard';
import { fetchJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

// ── Types ──

type ExportFormat = 'csv' | 'excel' | 'pdf';

type TabId = 'generate' | 'templates' | 'scheduled';

interface ReportCard {
  id: string;
  exportType: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  category: 'data' | 'intelligence' | 'operations' | 'comprehensive';
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  format: string;
  scheduleInterval: string;
  sections: string[];
}

interface ScheduledReport {
  id: string;
  templateId: string;
  templateName: string;
  schedule: string;
  format: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdBy: string;
  createdAt: string;
  filters: Record<string, string>;
}

interface ExportHistoryItem {
  id: string;
  action: string;
  entityType: string;
  metadata: string;
  createdAt: string;
  user: { name: string; role: string };
}

// ── Report definitions ──

const REPORT_CARDS: ReportCard[] = [
  {
    id: 'election-summary', exportType: 'election-summary',
    title: 'Election Summary',
    description: 'Comprehensive state-by-state results with turnout, incidents per unit, and aggregate statistics',
    icon: <PieChart className="h-5 w-5" />, color: 'text-violet', bgColor: 'bg-violet/10', borderColor: 'border-violet/20',
    category: 'comprehensive',
  },
  {
    id: 'incidents', exportType: 'incidents',
    title: 'Incident Report',
    description: 'All reported incidents with severity, GPS data, quarantine status, and C2PA verification',
    icon: <AlertTriangle className="h-5 w-5" />, color: 'text-rose', bgColor: 'bg-rose/10', borderColor: 'border-rose/20',
    category: 'data',
  },
  {
    id: 'results', exportType: 'results',
    title: 'Election Results',
    description: 'Official results per polling unit with BVAS data, accreditation counts, and violence flags',
    icon: <BarChart3 className="h-5 w-5" />, color: 'text-cyan', bgColor: 'bg-cyan/10', borderColor: 'border-cyan/20',
    category: 'data',
  },
  {
    id: 'pvt', exportType: 'pvt',
    title: 'PVT / Quick Count',
    description: 'Parallel Vote Tabulation submissions with party breakdowns, verification hashes, and photo evidence',
    icon: <TrendingUp className="h-5 w-5" />, color: 'text-emerald', bgColor: 'bg-emerald/10', borderColor: 'border-emerald/20',
    category: 'data',
  },
  {
    id: 'alerts', exportType: 'alerts',
    title: 'Alert Analysis',
    description: 'System alerts with category breakdown, read status, and linked incident severity',
    icon: <ShieldAlert className="h-5 w-5" />, color: 'text-amber', bgColor: 'bg-amber/10', borderColor: 'border-amber/20',
    category: 'intelligence',
  },
  {
    id: 'osint', exportType: 'osint',
    title: 'OSINT Report',
    description: 'Social media monitoring data with sentiment analysis, CIB scores, and virality metrics',
    icon: <Globe className="h-5 w-5" />, color: 'text-blue', bgColor: 'bg-blue/10', borderColor: 'border-blue/20',
    category: 'intelligence',
  },
  {
    id: 'voter-suppression', exportType: 'voter-suppression',
    title: 'Voter Suppression',
    description: 'Suppression incidents with severity, disinformation flags, and counter-measures applied',
    icon: <Shield className="h-5 w-5" />, color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20',
    category: 'intelligence',
  },
  {
    id: 'security-events', exportType: 'security-events',
    title: 'Security Events',
    description: 'Platform security events with source IPs, user agents, and resolution status',
    icon: <Shield className="h-5 w-5" />, color: 'text-orange', bgColor: 'bg-orange/10', borderColor: 'border-orange/20',
    category: 'operations',
  },
  {
    id: 'agents', exportType: 'agents',
    title: 'Field Agent Roster',
    description: 'Agent deployment list with online status, last seen timestamps, and activity metrics',
    icon: <Users className="h-5 w-5" />, color: 'text-teal', bgColor: 'bg-teal/10', borderColor: 'border-teal/20',
    category: 'operations',
  },
  {
    id: 'geofence', exportType: 'geofence',
    title: 'Geofence Zones',
    description: 'Active geofence areas with agent assignments, check-in intervals, and last check-in times',
    icon: <MapPin className="h-5 w-5" />, color: 'text-lime-600', bgColor: 'bg-lime-600/10', borderColor: 'border-lime-600/20',
    category: 'operations',
  },
  {
    id: 'honeypot', exportType: 'honeypot',
    title: 'Honeypot Analysis',
    description: 'Decoy polling unit results showing expected vs official vote deviations and manipulation flags',
    icon: <Eye className="h-5 w-5" />, color: 'text-fuchsia', bgColor: 'bg-fuchsia/10', borderColor: 'border-fuchsia/20',
    category: 'operations',
  },
  {
    id: 'flashpoint', exportType: 'flashpoint',
    title: 'Flashpoint Forecasts',
    description: 'Violence risk predictions with contributing factors, risk scores, and forecast windows',
    icon: <Zap className="h-5 w-5" />, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20',
    category: 'operations',
  },
  {
    id: 'accessibility', exportType: 'accessibility',
    title: 'Accessibility (PWD)',
    description: 'Polling unit accessibility scores, available features, barriers, and recommendations',
    icon: <Landmark className="h-5 w-5" />, color: 'text-indigo', bgColor: 'bg-indigo/10', borderColor: 'border-indigo/20',
    category: 'operations',
  },
  {
    id: 'audit-logs', exportType: 'audit-logs',
    title: 'Audit Trail',
    description: 'Complete audit log of platform actions with user details, IPs, and timestamps',
    icon: <Activity className="h-5 w-5" />, color: 'text-slate-400', bgColor: 'bg-slate-400/10', borderColor: 'border-slate-400/20',
    category: 'operations',
  },
];

const FORMAT_ICONS: Record<ExportFormat, React.ReactNode> = {
  csv: <FileText className="h-3.5 w-3.5" />,
  excel: <FileSpreadsheet className="h-3.5 w-3.5" />,
  pdf: <FileDown className="h-3.5 w-3.5" />,
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV', excel: 'Excel', pdf: 'PDF',
};

const SCHEDULE_LABELS: Record<string, string> = {
  EVERY_30MIN: 'Every 30 min',
  HOURLY: 'Hourly',
  EVERY_2HOURS: 'Every 2 hours',
  EVERY_4HOURS: 'Every 4 hours',
  EVERY_6HOURS: 'Every 6 hours',
  DAILY: 'Daily',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  INCIDENTS: <AlertTriangle className="h-4 w-4 text-rose" />,
  PVT: <BarChart3 className="h-4 w-4 text-emerald" />,
  OSINT: <Globe className="h-4 w-4 text-blue" />,
  SECURITY: <Shield className="h-4 w-4 text-violet" />,
  ELECTION: <PieChart className="h-4 w-4 text-cyan" />,
  OPERATIONS: <Users className="h-4 w-4 text-teal" />,
  INTEGRITY: <Eye className="h-4 w-4 text-fuchsia" />,
  INTELLIGENCE: <Zap className="h-4 w-4 text-amber" />,
};

// ── Tabs Config ──

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'generate', label: 'Generate', icon: <Download className="h-4 w-4" /> },
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="h-4 w-4" /> },
  { id: 'scheduled', label: 'Scheduled', icon: <CalendarClock className="h-4 w-4" /> },
];

// ── Main Component ──

export const ReportsCenter = React.memo(function ReportsCenter() {
  const { tenantId } = useDashboardStore();
  const [activeTab, setActiveTab] = useState<TabId>('generate');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [generatingComprehensive, setGeneratingComprehensive] = useState<null | 'excel' | 'pdf'>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [newScheduleInterval, setNewScheduleInterval] = useState('HOURLY');
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templatesData } = useQuery<{ templates: ReportTemplate[] }>({
    queryKey: ['report-templates', tenantId],
    queryFn: () => fetchJson(`/api/report-templates?tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // Fetch scheduled reports
  const { data: scheduledData, isLoading: scheduledLoading, refetch: refetchScheduled } = useQuery<{ reports: ScheduledReport[] }>({
    queryKey: ['scheduled-reports', tenantId],
    queryFn: () => fetchJson(`/api/scheduled-reports?tenantId=${tenantId}`),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // Fetch export history
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery<{
    logs: ExportHistoryItem[];
    total: number;
  }>({
    queryKey: ['export-history', tenantId],
    queryFn: () => fetchJson(`/api/audit-logs?action=DATA_EXPORTED&limit=20&tenantId=${tenantId}`),
    refetchInterval: 60_000,
    enabled: !!tenantId,
  });

  // Toggle scheduled report
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/scheduled-reports?tenantId=${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle schedule');
      return res.json();
    },
    onSuccess: () => {
      refetchScheduled();
      toast.success('Schedule updated');
    },
  });

  // Create scheduled report
  const createMutation = useMutation({
    mutationFn: async ({ templateId, templateName, schedule, format }: { templateId: string; templateName: string; schedule: string; format: string }) => {
      const res = await fetch(`/api/scheduled-reports?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, templateName, schedule, format, filters: {} }),
      });
      if (!res.ok) throw new Error('Failed to create schedule');
      return res.json();
    },
    onSuccess: () => {
      refetchScheduled();
      setScheduleDialogOpen(false);
      setSelectedTemplate(null);
      toast.success('Scheduled report created');
    },
  });

  const handleExport = useCallback(async (report: ReportCard) => {
    if (!tenantId) { toast.error('No tenant context'); return; }
    setExportingId(report.id);
    const params = new URLSearchParams({ type: report.exportType, format: selectedFormat, tenantId });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    try {
      const res = await fetch(`/api/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }
      const cd = res.headers.get('content-disposition');
      const filename = cd?.match(/filename="?([^;"]+)"?/)?.[1] || `${report.exportType}.${selectedFormat}`;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`Exported ${report.title} as ${FORMAT_LABELS[selectedFormat].toUpperCase()}`, { description: filename });
      refetchHistory();
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExportingId(null);
    }
  }, [tenantId, selectedFormat, startDate, endDate, refetchHistory]);

  const handleComprehensive = useCallback(async (format: 'excel' | 'pdf') => {
    if (!tenantId) { toast.error('No tenant context'); return; }
    setGeneratingComprehensive(format);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) throw new Error('Report generation failed');
      const cd = res.headers.get('content-disposition');
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const filename = cd?.match(/filename="?([^;"]+)"?/)?.[1] || `omnivote-report.${ext}`;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`Comprehensive report generated as ${format.toUpperCase()}`);
      refetchHistory();
    } catch (err) {
      toast.error(`Report generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGeneratingComprehensive(null);
    }
  }, [tenantId, refetchHistory]);

  const filteredCards = activeCategory === 'all' ? REPORT_CARDS : REPORT_CARDS.filter(c => c.category === activeCategory);
  const exportHistory = historyData?.logs || [];
  const templates = templatesData?.templates || [];
  const scheduled = scheduledData?.reports || [];

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
  };

  const parseExportMeta = (meta: string) => {
    try { const m = JSON.parse(meta); return { type: m.type, format: m.format }; } catch { return { type: 'unknown', format: 'unknown' }; }
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-y-auto">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-violet/10">
            <FileDown className="h-5 w-5 text-violet" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Reports Center</h2>
            <p className="text-xs text-muted-foreground">Generate, schedule, and download election monitoring reports</p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="shrink-0 flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/40">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all',
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'scheduled' && scheduled.filter(s => s.isActive).length > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1 bg-emerald/15 text-emerald">
                {scheduled.filter(s => s.isActive).length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* TAB: GENERATE (Original)                                        */}
      {activeTab === 'generate' && (
        <>
          {/* Controls bar */}
          <div className="shrink-0 flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border/60 bg-card/30">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet/50" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet/50" />
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</Button>
              )}
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Format:</span>
              <div className="flex rounded-md border border-border overflow-hidden">
                {(Object.keys(FORMAT_ICONS) as ExportFormat[]).map(fmt => (
                  <button key={fmt} onClick={() => setSelectedFormat(fmt)}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                      selectedFormat === fmt ? 'bg-violet text-violet-foreground' : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                    {FORMAT_ICONS[fmt]} {FORMAT_LABELS[fmt]}
                  </button>
                ))}
              </div>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {['all', 'comprehensive', 'data', 'intelligence', 'operations'].map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={cn('px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors',
                    activeCategory === cat ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Comprehensive Report Banner */}
          <div className="shrink-0 rounded-xl border border-violet/20 bg-gradient-to-r from-violet/5 via-card to-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-violet/10"><FileDown className="h-5 w-5 text-violet" /></div>
              <div>
                <h3 className="text-sm font-semibold">Comprehensive Election Report</h3>
                <p className="text-[11px] text-muted-foreground">Multi-sheet Excel or multi-page PDF with executive summary and analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-violet hover:bg-violet/90 text-violet-foreground"
                disabled={generatingComprehensive !== null} onClick={() => handleComprehensive('excel')}>
                {generatingComprehensive === 'excel' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />} Excel
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                disabled={generatingComprehensive !== null} onClick={() => handleComprehensive('pdf')}>
                {generatingComprehensive === 'pdf' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />} PDF
              </Button>
            </div>
          </div>

          {/* Report Cards Grid */}
          <div className="shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">Generate Report</h3>
              <Badge variant="secondary" className="text-[10px]">{filteredCards.length} reports</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <AnimatePresence mode="popLayout">
                {filteredCards.map((report, idx) => (
                  <m.div key={report.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, delay: idx * 0.03 }}>
                    <Card className={cn('group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5', 'border', report.borderColor, 'bg-card/50')}>
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-start justify-between">
                          <div className={cn('p-2 rounded-lg', report.bgColor)}><span className={report.color}>{report.icon}</span></div>
                          <Badge variant="outline" className="text-[9px] font-normal opacity-60">{report.category}</Badge>
                        </div>
                        <CardTitle className="text-sm mt-2">{report.title}</CardTitle>
                        <CardDescription className="text-[11px] leading-relaxed">{report.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">{FORMAT_ICONS[selectedFormat]}<span className="text-[10px] text-muted-foreground">{FORMAT_LABELS[selectedFormat]}</span></div>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5"
                            disabled={exportingId === report.id} onClick={(e) => { e.stopPropagation(); handleExport(report); }}>
                            {exportingId === report.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Export
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </m.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <Separator className="shrink-0" />

          {/* Export History */}
          <div className="flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Export History</h3>
                <Badge variant="secondary" className="text-[10px]">{exportHistory.length} recent</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => refetchHistory()}>
                <RefreshCw className={cn('h-3 w-3', historyLoading && 'animate-spin')} /> Refresh
              </Button>
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : exportHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 rounded-full bg-muted/50 mb-3"><Clock className="h-5 w-5 text-muted-foreground" /></div>
                <p className="text-sm text-muted-foreground">No exports yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Generate your first report above</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {exportHistory.map((item) => {
                  const meta = parseExportMeta(item.metadata || '{}');
                  const reportCard = REPORT_CARDS.find(c => c.exportType === meta.type);
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-card/20 hover:bg-card/40 transition-colors">
                      <div className={cn('p-1.5 rounded-md shrink-0', reportCard?.bgColor || 'bg-muted/50')}>
                        <span className={reportCard?.color || 'text-muted-foreground'}>{reportCard?.icon || <FileText className="h-4 w-4" />}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate">{reportCard?.title || meta.type}</span>
                          <Badge variant="outline" className="text-[9px] shrink-0">{meta.format?.toUpperCase()}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{item.user?.name || 'Unknown'}</span>
                          <span className="text-[10px] text-muted-foreground/50">·</span>
                          <span className="text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</span>
                        </div>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB: TEMPLATES                                               */}
      {activeTab === 'templates' && (
        <>
          <div className="flex items-center gap-2 mb-3">
          <LayoutTemplate className="h-4 w-4 text-violet" />
            <h3 className="text-sm font-semibold">Report Templates</h3>
            <Badge variant="secondary" className="text-[10px]">{templates.length} templates</Badge>
            <span className="text-xs text-muted-foreground ml-2">
              Click &quot;Schedule&quot; to auto-generate reports on a recurring basis
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((tpl, idx) => (
              <m.div
                key={tpl.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="border-border/50 bg-card/50 hover:shadow-md transition-all">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-violet/10">
                          {CATEGORY_ICONS[tpl.category] || <FileText className="h-4 w-4 text-violet" />}
                        </div>
                        <div>
                          <CardTitle className="text-sm">{tpl.name}</CardTitle>
                          <Badge variant="outline" className="text-[9px] mt-1">{tpl.category}</Badge>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[9px] shrink-0">
                        {SCHEDULE_LABELS[tpl.scheduleInterval] || tpl.scheduleInterval}
                      </Badge>
                    </div>
                    <CardDescription className="text-[11px] leading-relaxed mt-2">{tpl.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    {/* Sections */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tpl.sections.map(s => (
                        <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground capitalize">
                          {s.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {FORMAT_ICONS[tpl.format?.toLowerCase() as ExportFormat] || FORMAT_ICONS.pdf}
                        <span className="text-[10px] text-muted-foreground">{tpl.format}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] gap-1"
                          onClick={() => handleExport({ id: tpl.id, exportType: tpl.id.replace('tpl-', ''), title: tpl.name, description: '', icon: <FileText />, color: '', bgColor: '', borderColor: '', category: 'comprehensive' } as ReportCard)}
                        >
                          <Download className="h-3 w-3" /> Generate Now
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-[11px] gap-1 bg-violet hover:bg-violet/90 text-violet-foreground"
                          onClick={() => { setSelectedTemplate(tpl); setScheduleDialogOpen(true); }}
                        >
                          <CalendarClock className="h-3 w-3" /> Schedule
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </m.div>
            ))}
          </div>
        </>
      )}

      {/* TAB: SCHEDULED                                               */}
      {activeTab === 'scheduled' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber" />
              <h3 className="text-sm font-semibold">Scheduled Reports</h3>
              <Badge variant="secondary" className="text-[10px]">{scheduled.length} active</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => refetchScheduled()}>
              <RefreshCw className={cn('h-3 w-3', scheduledLoading && 'animate-spin')} /> Refresh
            </Button>
          </div>

          {scheduledLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : scheduled.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-full bg-muted/50 mb-3"><Timer className="h-5 w-5 text-muted-foreground" /></div>
              <p className="text-sm text-muted-foreground">No scheduled reports</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Go to Templates tab to create a scheduled report</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scheduled.map((sr) => (
                <div key={sr.id} className={cn(
                  'flex items-center gap-4 p-3 rounded-lg border transition-all',
                  sr.isActive ? 'border-border/60 bg-card/50' : 'border-border/30 bg-muted/20 opacity-60',
                )}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold truncate">{sr.templateName}</span>
                      <Badge variant={sr.isActive ? 'default' : 'secondary'} className="text-[9px]">
                        {sr.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Timer className="h-3 w-3" /> {SCHEDULE_LABELS[sr.schedule] || sr.schedule}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {sr.format}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Last: {timeAgo(sr.lastRunAt)}</span>
                      {sr.isActive && sr.nextRunAt && (
                        <span className="text-[10px] text-emerald">Next: {timeAgo(sr.nextRunAt)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 shrink-0"
                    disabled={toggleMutation.isPending}
                    onClick={() => toggleMutation.mutate({ id: sr.id, isActive: !sr.isActive })}
                  >
                    {sr.isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {sr.isActive ? 'Pause' : 'Resume'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* DIALOG: Schedule Report                                      */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Report</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                <h4 className="text-sm font-semibold">{selectedTemplate.name}</h4>
                <p className="text-[11px] text-muted-foreground mt-1">{selectedTemplate.description}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Schedule Frequency</label>
                <Select value={newScheduleInterval} onValueChange={setNewScheduleInterval}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCHEDULE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={() => setScheduleDialogOpen(false)} className="h-8 text-xs">Cancel</Button>
                <Button
                  className="h-8 text-xs bg-violet hover:bg-violet/90 text-violet-foreground"
                  disabled={createMutation.isPending}
                  onClick={() => createMutation.mutate({
                    templateId: selectedTemplate.id,
                    templateName: selectedTemplate.name,
                    schedule: newScheduleInterval,
                    format: selectedTemplate.format,
                  })}
                >
                  {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  Create Schedule
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});
