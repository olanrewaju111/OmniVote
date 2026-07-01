'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2, Users, Activity, Plus, Settings, Shield,
} from 'lucide-react';

const TENANTS = [
  {
    name: 'Nigeria Election Watch',
    slug: 'new',
    domain: 'monitor.nigeriaelectionwatch.org',
    agents: 37,
    online: 27,
    status: 'active',
    elections: 1,
    primaryColor: '#10b981',
  },
  {
    name: 'Civic Transparency Initiative',
    slug: 'cti',
    domain: 'monitor.civicti.org',
    agents: 124,
    online: 98,
    status: 'active',
    elections: 3,
    primaryColor: '#06b6d4',
  },
  {
    name: 'West Africa Observer Network',
    slug: 'waon',
    domain: 'waon.electionmonitor.org',
    agents: 56,
    online: 41,
    status: 'active',
    elections: 2,
    primaryColor: '#f59e0b',
  },
  {
    name: 'Global Rights Monitor',
    slug: 'grm',
    domain: 'grm.omnivote.io',
    agents: 210,
    online: 180,
    status: 'active',
    elections: 5,
    primaryColor: '#8b5cf6',
  },
  {
    name: 'Electoral Integrity Project',
    slug: 'eip',
    domain: 'eip.omnivote.io',
    agents: 0,
    online: 0,
    status: 'suspended',
    elections: 0,
    primaryColor: '#6b7280',
  },
];

export function TenantManagement() {
  const totalAgents = TENANTS.reduce((s, t) => s + t.agents, 0);
  const totalOnline = TENANTS.reduce((s, t) => s + t.online, 0);
  const activeTenants = TENANTS.filter(t => t.status === 'active').length;

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
        <Button className="bg-emerald hover:bg-emerald/90 text-emerald-950 text-sm gap-2">
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
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: tenant.primaryColor }}
                  >
                    {tenant.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{tenant.name}</p>
                    <p className="text-[11px] text-muted-foreground">{tenant.domain}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                <span>{tenant.elections} election{tenant.elections !== 1 ? 's' : ''}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}