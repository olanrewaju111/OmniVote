'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Building2, Users, Activity, Plus, Settings, Shield, Vote,
  Loader2, X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ElectionTier } from '@/store/dashboard';

const TENANTS = [
  {
    name: 'Nigeria Election Watch',
    slug: 'new',
    domain: 'monitor.nigeriaelectionwatch.org',
    agents: 37,
    online: 27,
    status: 'active',
    electionTier: 'PRESIDENTIAL' as ElectionTier,
    electionTitle: '2025 General Elections',
    primaryColor: '#10b981',
  },
  {
    name: 'Civic Transparency Initiative',
    slug: 'cti',
    domain: 'monitor.civicti.org',
    agents: 124,
    online: 98,
    status: 'active',
    electionTier: 'STATE' as ElectionTier,
    electionTitle: 'Lagos Guber Elections 2025',
    primaryColor: '#06b6d4',
  },
  {
    name: 'West Africa Observer Network',
    slug: 'waon',
    domain: 'waon.electionmonitor.org',
    agents: 56,
    online: 41,
    status: 'active',
    electionTier: 'LOCAL' as ElectionTier,
    electionTitle: 'FCT Area Council Elections',
    primaryColor: '#f59e0b',
  },
  {
    name: 'Global Rights Monitor',
    slug: 'grm',
    domain: 'grm.omnivote.io',
    agents: 210,
    online: 180,
    status: 'active',
    electionTier: 'PRESIDENTIAL' as ElectionTier,
    electionTitle: '2025 General Elections',
    primaryColor: '#8b5cf6',
  },
  {
    name: 'Electoral Integrity Project',
    slug: 'eip',
    domain: 'eip.omnivote.io',
    agents: 0,
    online: 0,
    status: 'suspended',
    electionTier: null,
    electionTitle: null,
    primaryColor: '#6b7280',
  },
];

const TIER_BADGE: Record<ElectionTier, string> = {
  PRESIDENTIAL: 'border-violet/30 text-violet bg-violet/10',
  STATE: 'border-amber/30 text-amber bg-amber/10',
  LOCAL: 'border-cyan/30 text-cyan bg-cyan/10',
};

const TIER_LABEL: Record<ElectionTier, string> = {
  PRESIDENTIAL: 'Presidential',
  STATE: 'Governorship',
  LOCAL: 'Local Gov',
};

export function TenantManagement() {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newTier, setNewTier] = useState<ElectionTier>('PRESIDENTIAL');

  const totalAgents = TENANTS.reduce((s, t) => s + t.agents, 0);
  const totalOnline = TENANTS.reduce((s, t) => s + t.online, 0);
  const activeTenants = TENANTS.filter(t => t.status === 'active').length;

  const handleOnboard = () => {
    if (!newName.trim() || !newDomain.trim()) {
      toast.error('Organization name and domain are required');
      return;
    }
    // In production this would POST to an API
    toast.success(`Tenant "${newName}" onboarded with ${TIER_LABEL[newTier]} election monitoring`);
    setAddOpen(false);
    setNewName(''); setNewDomain(''); setNewTier('PRESIDENTIAL');
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald" />
            Tenant Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Super Admin — Onboard and manage independent observation organizations
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-emerald hover:bg-emerald/90 text-emerald-950 text-sm gap-2"
        >
          <Plus className="h-4 w-4" />
          Onboard Tenant
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border bg-card/40">
          <CardContent className="p-3.5 text-center">
            <p className="text-2xl font-bold tabular-nums text-emerald">{activeTenants}</p>
            <p className="text-[11px] text-muted-foreground">Active Tenants</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/40">
          <CardContent className="p-3.5 text-center">
            <p className="text-2xl font-bold tabular-nums">{totalAgents.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Total Agents</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/40">
          <CardContent className="p-3.5 text-center">
            <p className="text-2xl font-bold tabular-nums text-cyan">{totalOnline.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Online Now</p>
          </CardContent>
        </Card>
      </div>

      {/* One-election-per-tenant notice */}
      <div className="rounded-lg border border-violet/20 bg-violet/5 p-3 flex items-start gap-2.5">
        <Vote className="h-4 w-4 text-violet shrink-0 mt-0.5" />
        <div className="text-[11px] text-violet/80">
          <p className="font-medium text-violet mb-0.5">Single Election Type Per Tenant</p>
          Each tenant organization is scoped to exactly one election type — Presidential, Governorship, or Local Government. This ensures data isolation, role permissions, and monitoring configurations are election-specific. To monitor a different election type, a separate tenant must be created.
        </div>
      </div>

      {/* Zero-Trust notice */}
      <div className="rounded-lg border border-emerald/20 bg-emerald/5 p-3 flex items-start gap-2.5">
        <Shield className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
        <div className="text-[11px] text-emerald/80">
          <p className="font-medium text-emerald mb-0.5">Zero-Trust Tenant Architecture</p>
          Complete logical data isolation with row-level security. Cross-tenant data leakage is prevented — even if a tenant&apos;s API keys are compromised, the breach is contained to that tenant only.
        </div>
      </div>

      {/* Tenant cards */}
      <div className="space-y-3">
        {TENANTS.map(tenant => (
          <Card key={tenant.slug} className={cn(
            'border bg-card/40',
            tenant.status === 'active' ? 'border-border' : 'border-rose/20 opacity-60'
          )}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: tenant.primaryColor }}
                  >
                    {tenant.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{tenant.name}</p>
                    <p className="text-[11px] text-muted-foreground">{tenant.domain}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tenant.electionTier && (
                    <Badge variant="outline" className={cn('text-[10px] h-5', TIER_BADGE[tenant.electionTier])}>
                      <Vote className="h-3 w-3 mr-1" />
                      {TIER_LABEL[tenant.electionTier]}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] h-5',
                      tenant.status === 'active' ? 'border-emerald/30 text-emerald' : 'border-rose/30 text-rose'
                    )}
                  >
                    {tenant.status}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{tenant.agents} agents</span>
                <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{tenant.online} online</span>
                {tenant.electionTitle && (
                  <span className="truncate max-w-[260px]">{tenant.electionTitle}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== ONBOARD TENANT DIALOG ===== */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald" />
              Onboard New Tenant
            </DialogTitle>
            <DialogDescription>
              Create a new observation organization. Each tenant is scoped to a single election type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Organization Name</label>
              <Input
                placeholder="e.g. Delta State Monitor"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Domain</label>
              <Input
                placeholder="e.g. monitor.deltastate.org"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Election Type
                <span className="ml-1.5 text-[10px] text-violet/60 font-normal">(one per tenant — cannot be changed later)</span>
              </label>
              <Select value={newTier} onValueChange={(v) => setNewTier(v as ElectionTier)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESIDENTIAL">Presidential Election</SelectItem>
                  <SelectItem value="STATE">Governorship Election</SelectItem>
                  <SelectItem value="LOCAL">Local Government Election</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-amber/20 bg-amber/5 p-2.5 text-[11px] text-amber/80">
              The election type selected here will be locked for this tenant. All polling units, agent assignments, and monitoring configurations will be scoped to this election. To monitor a different election type, create a separate tenant.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={handleOnboard}
              disabled={!newName.trim() || !newDomain.trim()}
              className="bg-emerald hover:bg-emerald/90 text-emerald-950"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Onboard Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}