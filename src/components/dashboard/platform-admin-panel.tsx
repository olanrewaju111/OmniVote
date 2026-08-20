'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { m } from 'framer-motion';
import {
  Building2, Users, Vote, ShieldAlert, Plus, Search, Settings, Eye,
  FileText, Database, Clock, Loader2, ArrowRight, ExternalLink,
  ChevronRight, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Types ──────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  primaryColor: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; elections: number };
}

interface MockSecurityEvent {
  id: string;
  tenant: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  timestamp: string;
}

// ── Animation Variants ─────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: 'easeOut' as const },
  }),
};

const sectionFade = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ── Mock Security Events ───────────────────────────────────────────────────

const MOCK_SECURITY_EVENTS: MockSecurityEvent[] = [
  { id: 'se-1', tenant: 'inec-nigeria', type: 'LOGIN_ANOMALY', severity: 'HIGH', description: 'Brute-force attempt detected from IP 103.x.x.x', timestamp: '2025-01-15T14:23:00Z' },
  { id: 'se-2', tenant: 'observer-ng', type: 'PERMISSION_ESCALATION', severity: 'CRITICAL', description: 'User attempted to access SUPER_ADMIN endpoints', timestamp: '2025-01-15T13:10:00Z' },
  { id: 'se-3', tenant: 'inec-nigeria', type: 'CSRF_TOKEN_MISMATCH', severity: 'MEDIUM', description: 'Multiple CSRF validation failures', timestamp: '2025-01-15T12:45:00Z' },
  { id: 'se-4', tenant: 'electoral-commission', type: 'SUSPICIOUS_API_PATTERN', severity: 'LOW', description: 'Unusual data export pattern detected', timestamp: '2025-01-15T11:30:00Z' },
  { id: 'se-5', tenant: 'observer-ng', type: 'SESSION_FIXATION', severity: 'HIGH', description: 'Potential session fixation attempt blocked', timestamp: '2025-01-15T10:15:00Z' },
];

const SEVERITY_STYLES: Record<string, string> = {
  LOW: 'border-sky-500/30 text-sky-400 bg-sky-500/10',
  MEDIUM: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  HIGH: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
  CRITICAL: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
};

// ── KPI Card Sub-component ─────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, accent, index,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  accent: 'emerald' | 'violet' | 'amber' | 'rose';
  index: number;
}) {
  const accentMap = {
    emerald: 'border-emerald-500/30 text-emerald-400',
    violet: 'border-violet-500/30 text-violet-400',
    amber: 'border-amber-500/30 text-amber-400',
    rose: 'border-rose-500/30 text-rose-400',
  };
  const bgMap = {
    emerald: 'bg-emerald-500/5',
    violet: 'bg-violet-500/5',
    amber: 'bg-amber-500/5',
    rose: 'bg-rose-500/5',
  };
  const iconBgMap = {
    emerald: 'bg-emerald-500/10',
    violet: 'bg-violet-500/10',
    amber: 'bg-amber-500/10',
    rose: 'bg-rose-500/10',
  };

  return (
    <m.div
      custom={index}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={cn(
        'glass-strong rounded-xl border p-4 card-lift',
        accentMap[accent],
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className={cn('text-2xl font-bold tabular-nums', accentMap[accent].split(' ')[1])}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconBgMap[accent])}>
          <Icon className={cn('h-5 w-5', accentMap[accent].split(' ')[1])} />
        </div>
      </div>
    </m.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PlatformAdminPanel() {
  const queryClient = useQueryClient();
  const { setTenantId, setSelectedTab, setAvailableTenants } = useDashboardStore();

  // ── Data Fetching ──
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<TenantRow[]>({
    queryKey: ['all-tenants'],
    queryFn: async () => {
      const d = await fetchJson<{ tenants?: TenantRow[] }>('/api/tenants');
      return d.tenants || [];
    },
  });

  // ── KPI Aggregation ──
  const totalTenants = tenants.length;
  const totalUsers = tenants.reduce((s, t) => s + (t._count?.users ?? 0), 0);
  const totalElections = tenants.reduce((s, t) => s + (t._count?.elections ?? 0), 0);

  // ── State: Create Tenant Dialog ──
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formAdminName, setFormAdminName] = useState('');
  const [formAdminEmail, setFormAdminEmail] = useState('');

  // Auto-derive slug from name
  useEffect(() => {
    if (createOpen && formName && !formSlug) {
      setFormSlug(formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''));
    }
  }, [createOpen, formName, formSlug]);

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setFormAdminName('');
    setFormAdminEmail('');
  };

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (vars: { name: string; slug: string; adminName: string; adminEmail: string }) =>
      fetchJson('/api/tenants', {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      toast.success('Tenant created successfully');
      queryClient.invalidateQueries({ queryKey: ['all-tenants'] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create tenant');
    },
  });

  // ── Cross-Tenant Search ──
  const [globalSearch, setGlobalSearch] = useState('');

  // ── Handlers ──
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    createMutation.mutate({
      name: formName.trim(),
      slug: formSlug.trim(),
      adminName: formAdminName.trim(),
      adminEmail: formAdminEmail.trim(),
    });
  };

  const handleViewTenant = (tenant: TenantRow) => {
    setTenantId(tenant.id);
    setAvailableTenants(
      tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        primaryColor: t.primaryColor,
      })),
    );
    setSelectedTab('overview');
    toast.success(`Switched to ${tenant.name}`);
  };

  const handleViewAuditLogs = () => {
    setSelectedTab('audit-logs');
  };

  const handleNavigateSettings = (tenant: TenantRow) => {
    setTenantId(tenant.id);
    setSelectedTab('tenants');
    toast.success(`Viewing settings for ${tenant.name}`);
  };

  // ── Render ──
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* ═══════════════════════════════════════════════════════
          SECTION 1: Platform Overview KPIs
          ═══════════════════════════════════════════════════════ */}
      <m.section
        variants={sectionFade}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
            <ShieldAlert className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Platform Overview</h2>
            <p className="text-xs text-muted-foreground">Real-time platform-wide metrics</p>
          </div>
          <Badge variant="outline" className="ml-auto border-violet-500/30 text-violet-400 bg-violet-500/10 text-[10px] font-semibold uppercase tracking-widest">
            Super Admin
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Building2} label="Total Tenants" value={tenantsLoading ? '—' : totalTenants} accent="emerald" index={0} />
          <KpiCard icon={Users} label="Total Users" value={tenantsLoading ? '—' : totalUsers} accent="violet" index={1} />
          <KpiCard icon={Vote} label="Active Elections" value={tenantsLoading ? '—' : totalElections} accent="amber" index={2} />
          <KpiCard icon={ShieldAlert} label="Security Events" value={MOCK_SECURITY_EVENTS.length} accent="rose" index={3} />
        </div>
      </m.section>

      <Separator className="opacity-30" />

      {/* ═══════════════════════════════════════════════════════
          SECTION 2: Tenant Administration
          ═══════════════════════════════════════════════════════ */}
      <m.section
        variants={sectionFade}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Building2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Tenant Administration</h2>
              <p className="text-xs text-muted-foreground">Manage all platform tenants</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => { resetForm(); setCreateOpen(true); }}
            className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Create New Tenant
          </Button>
        </div>

        {tenantsLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tenants.length === 0 ? (
          <Card className="border-dashed border-border/50 bg-card/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No tenants yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create your first tenant to get started</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-2 pr-4">
              {tenants.map((tenant, i) => (
                <m.div
                  key={tenant.id}
                  custom={i}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className={cn(
                    'glass-strong rounded-lg border border-border/40 p-4 card-lift',
                    'hover:border-emerald-500/20 transition-colors',
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Color dot + Name + Slug */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full shrink-0 ring-2 ring-background"
                        style={{ backgroundColor: tenant.primaryColor || '#10b981' }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">/{tenant.slug}</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {tenant._count?.users ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Vote className="h-3 w-3" />
                        {tenant._count?.elections ?? 0}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] px-1.5 py-0',
                          tenant.isActive
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                            : 'border-rose-500/30 text-rose-400 bg-rose-500/10',
                        )}
                      >
                        {tenant.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="hidden lg:inline text-muted-foreground/60">
                        {new Date(tenant.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => handleViewTenant(tenant)}
                      >
                        <Eye className="h-3 w-3" />
                        <span className="hidden sm:inline">View</span>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => handleNavigateSettings(tenant)}
                      >
                        <Settings className="h-3 w-3" />
                        <span className="hidden sm:inline">Settings</span>
                      </Button>
                    </div>
                  </div>
                </m.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </m.section>

      <Separator className="opacity-30" />

      {/* ═══════════════════════════════════════════════════════
          SECTION 3: Cross-Tenant Support
          ═══════════════════════════════════════════════════════ */}
      <m.section
        variants={sectionFade}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Cross-Tenant Support</h2>
            <p className="text-xs text-muted-foreground">Search users & security events across all tenants</p>
          </div>
        </div>

        {/* Global user search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users across all tenants (name or email)..."
              className="pl-9 h-9 bg-card/40 border-border/40 focus:border-emerald-500/40 text-sm"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>
          {globalSearch.length > 0 && (
            <p className="text-xs text-muted-foreground/60 mt-2 flex items-center gap-1.5">
              <Search className="h-3 w-3" />
              Cross-tenant search requires a dedicated API endpoint — coming soon.
            </p>
          )}
        </div>

        {/* Security Events Table */}
        <Card className="glass-strong border-border/40 overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              Recent Security Events
              <Badge variant="outline" className="ml-auto text-[10px] border-border/40 text-muted-foreground">
                {MOCK_SECURITY_EVENTS.length} events
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2.5">Tenant</th>
                    <th className="text-left font-medium px-4 py-2.5">Type</th>
                    <th className="text-left font-medium px-4 py-2.5">Severity</th>
                    <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Description</th>
                    <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_SECURITY_EVENTS.map((evt) => (
                    <tr
                      key={evt.id}
                      className="border-b border-border/20 hover:bg-card/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{evt.tenant}</td>
                      <td className="px-4 py-2.5">
                        <code className="text-[10px] rounded bg-card/60 px-1.5 py-0.5 text-foreground/80">
                          {evt.type}
                        </code>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', SEVERITY_STYLES[evt.severity])}>
                          {evt.severity}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell max-w-[280px] truncate">
                        {evt.description}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground/60 hidden lg:table-cell whitespace-nowrap">
                        {new Date(evt.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </m.section>

      <Separator className="opacity-30" />

      {/* ═══════════════════════════════════════════════════════
          SECTION 4: System Maintenance
          ═══════════════════════════════════════════════════════ */}
      <m.section
        variants={sectionFade}
        initial="hidden"
        animate="visible"
        className="pb-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Settings className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">System Maintenance</h2>
            <p className="text-xs text-muted-foreground">Retention policies & audit configuration</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Audit Log Retention */}
          <Card className="glass-strong border-border/40">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-400" />
                Audit Log Retention
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Retention Period</span>
                  <span className="text-xs font-mono text-foreground">90 days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Auto-Purge</span>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Compression</span>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">Enabled</Badge>
                </div>
                <Separator className="opacity-20" />
                <p className="text-[10px] text-muted-foreground/50">Configuration requires server-side updates</p>
              </div>
            </CardContent>
          </Card>

          {/* Data Retention */}
          <Card className="glass-strong border-border/40">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-400" />
                Data Retention
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Incident Reports</span>
                  <span className="text-xs font-mono text-foreground">365 days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Media Assets</span>
                  <span className="text-xs font-mono text-foreground">180 days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">PVT Data</span>
                  <span className="text-xs font-mono text-foreground">Indefinite</span>
                </div>
                <Separator className="opacity-20" />
                <p className="text-[10px] text-muted-foreground/50">Configuration requires server-side updates</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Full Audit Logs */}
        <div className="mt-4">
          <Button
            variant="outline"
            className="gap-2 border-border/40 text-sm hover:bg-card/40 hover:text-foreground"
            onClick={handleViewAuditLogs}
          >
            <FileText className="h-4 w-4" />
            View Full Audit Logs
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </m.section>

      {/* ═══════════════════════════════════════════════════════
          CREATE TENANT DIALOG
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetForm(); setCreateOpen(open); }}>
        <DialogContent className="glass-strong border-border/40 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" />
              Create New Tenant
            </DialogTitle>
            <DialogDescription>
              Provision a new tenant organization on the platform.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="tenant-name" className="text-xs font-medium text-muted-foreground">
                Tenant Name <span className="text-rose-400">*</span>
              </label>
              <Input
                id="tenant-name"
                placeholder="e.g. INEC Nigeria"
                className="h-9 bg-card/40 border-border/40 text-sm"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="tenant-slug" className="text-xs font-medium text-muted-foreground">
                Slug <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">/</span>
                <Input
                  id="tenant-slug"
                  placeholder="auto-generated-from-name"
                  className="h-9 bg-card/40 border-border/40 text-sm font-mono pl-6"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  required
                />
              </div>
            </div>
            <Separator className="opacity-20" />
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
              Initial Admin Account
            </p>
            <div className="space-y-2">
              <label htmlFor="admin-name" className="text-xs font-medium text-muted-foreground">
                Admin Name
              </label>
              <Input
                id="admin-name"
                placeholder="Full name of the admin user"
                className="h-9 bg-card/40 border-border/40 text-sm"
                value={formAdminName}
                onChange={(e) => setFormAdminName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin-email" className="text-xs font-medium text-muted-foreground">
                Admin Email
              </label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                className="h-9 bg-card/40 border-border/40 text-sm"
                value={formAdminEmail}
                onChange={(e) => setFormAdminEmail(e.target.value)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { resetForm(); setCreateOpen(false); }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create Tenant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
