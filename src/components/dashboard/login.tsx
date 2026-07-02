'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDashboardStore, ROLE_TABS, type UserRole, TIER_SHORT } from '@/store/dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Shield, Eye, UserCheck, Users, Zap, Search,
  ChevronRight, Loader2, Radio, Vote, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
}

interface UserOption {
  email: string;
  name: string;
  role: UserRole;
  isOnline: boolean;
  tenantId: string;
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', icon: <Shield className="h-5 w-5" />, color: 'text-emerald border-emerald/30 bg-emerald/10', desc: 'Platform owner — infrastructure, tenants, global health' },
  TENANT_ADMIN: { label: 'Tenant Admin', icon: <Users className="h-5 w-5" />, color: 'text-cyan border-cyan/30 bg-cyan/10', desc: 'Organization admin — agent rosters, account management' },
  ANALYST: { label: 'Analyst', icon: <Eye className="h-5 w-5" />, color: 'text-amber border-amber/30 bg-amber/10', desc: 'Live dashboard monitoring, incident review, field ops' },
  TRUST_SAFETY: { label: 'Trust & Safety', icon: <UserCheck className="h-5 w-5" />, color: 'text-rose border-rose/30 bg-rose/10', desc: 'Deepfake review, disverification, agent authenticity' },
  FIELD_AGENT: { label: 'Field Agent', icon: <Radio className="h-5 w-5" />, color: 'text-muted-foreground border-border bg-card', desc: 'Polling unit observer — submit reports & media' },
};

const ROLE_ORDER: UserRole[] = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY', 'FIELD_AGENT'];

const TENANT_TIER: Record<string, { tier: 'PRESIDENTIAL' | 'STATE' | 'LOCAL'; badge: string }> = {
  'presidential': { tier: 'PRESIDENTIAL', badge: 'Presidential' },
  'governorship': { tier: 'STATE', badge: 'Governorship' },
  'local-gov': { tier: 'LOCAL', badge: 'Local Gov' },
};

export function LoginScreen() {
  const { login, setElectionInfo, setTenantId } = useDashboardStore();
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'ALL'>('ALL');
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<{
    tenants: TenantOption[];
    users: UserOption[];
  }>({
    queryKey: ['auth-all'],
    queryFn: () => fetchJson('/api/auth'),
  });

  const tenants = data?.tenants || [];
  const allUsers = data?.users || [];

  // Auto-select first tenant if none selected
  const activeTenantId = selectedTenantId || tenants[0]?.id || '';
  const activeTenant = tenants.find(t => t.id === activeTenantId);

  // Filter users to selected tenant
  const tenantUsers = allUsers.filter(u => u.tenantId === activeTenantId);

  const filtered = tenantUsers.filter(u => {
    if (selectedRole !== 'ALL' && u.role !== selectedRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  // Quick-logins: one per role for the selected tenant
  const quickLogins = ROLE_ORDER.map(role => {
    const user = tenantUsers.find(u => u.role === role);
    return user ? { ...user, config: ROLE_CONFIG[role] } : null;
  }).filter(Boolean) as { email: string; name: string; role: UserRole; isOnline: boolean; config: typeof ROLE_CONFIG[string] }[];

  const handleLogin = async (email: string) => {
    setLoggingIn(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      login(data.user);
      if (data.electionInfo) setElectionInfo(data.electionInfo);
      if (data.user.tenantId) setTenantId(data.user.tenantId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setLoggingIn(false);
    }
  };

  const tierInfo = activeTenant ? TENANT_TIER[activeTenant.slug] : null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] bg-gradient-to-b from-emerald/10 via-background to-background border-r border-border flex-col p-8 justify-between relative overflow-hidden">
        <div className="absolute inset-0 map-grid opacity-40" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald flex items-center justify-center">
              <Zap className="h-6 w-6 text-emerald-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">OmniVote</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Monitor</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-3 leading-tight">
            Secure Election<br />Command Center
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            Real-time election monitoring with AI-powered threat detection, deepfake identification, and adversarial defense systems.
          </p>
        </div>
        <div className="relative z-10 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Tenants', value: String(tenants.length) },
              { label: 'Total Agents', value: String(allUsers.filter(u => u.role === 'FIELD_AGENT').length) },
              { label: 'Polling Units', value: '381+' },
              { label: 'Incidents', value: '140+' },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                <p className="text-lg font-bold text-emerald tabular-nums">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-dot" />
            <span>Multi-Tenant Deployment &middot; {tenants.length} Active Organizations</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            OmniVote Monitor v1.2 &middot; Zero-Trust Architecture &middot; AES-256 Encryption
          </p>
        </div>
      </div>

      {/* Right panel — login */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
            {/* Mobile header */}
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-lg bg-emerald flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-950" />
              </div>
              <div>
                <h1 className="text-base font-bold">OmniVote Monitor</h1>
                <p className="text-[10px] text-muted-foreground">Election Command Center</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-1">Select Organization</h3>
            <p className="text-sm text-muted-foreground mb-4">Choose a tenant, then pick a persona. Each tenant has its own election type.</p>

            {/* Tenant selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
              {tenants.map(t => {
                const tInfo = TENANT_TIER[t.slug];
                const isActive = t.id === activeTenantId;
                const userCount = allUsers.filter(u => u.tenantId === t.id).length;
                return (
                  <motion.button
                    key={t.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedTenantId(t.id); setSelectedRole('ALL'); setSearch(''); setError(''); }}
                    className={cn(
                      'rounded-lg border p-3.5 text-left transition-all',
                      isActive
                        ? 'border-emerald bg-emerald/10 shadow-sm'
                        : 'border-border bg-card/60 hover:bg-card/80'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className={cn('h-4 w-4', isActive ? 'text-emerald' : 'text-muted-foreground')} />
                      {tInfo && (
                        <Badge variant="outline" className={cn(
                          'text-[10px] h-5',
                          tInfo.tier === 'PRESIDENTIAL' ? 'border-violet/30 text-violet bg-violet/10' :
                          tInfo.tier === 'STATE' ? 'border-amber/30 text-amber bg-amber/10' :
                          'border-cyan/30 text-cyan bg-cyan/10'
                        )}>
                          <Vote className="h-2.5 w-2.5 mr-1" />
                          {tInfo.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-tight">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{userCount} users</p>
                  </motion.button>
                );
              })}
            </div>

            {activeTenant && tierInfo && (
              <div className="mb-4 p-2.5 rounded-lg border border-border bg-card/40 flex items-center gap-2">
                <Vote className={cn('h-4 w-4',
                  tierInfo.tier === 'PRESIDENTIAL' ? 'text-violet' :
                  tierInfo.tier === 'STATE' ? 'text-amber' : 'text-cyan'
                )} />
                <span className="text-xs text-muted-foreground">
                  Election Type: <span className="font-medium text-foreground">{tierInfo.badge} Election</span>
                </span>
                <span className="text-[10px] text-muted-foreground/50 ml-auto">
                  {tierInfo.tier === 'PRESIDENTIAL' ? 'All 36 states + FCT' :
                   tierInfo.tier === 'STATE' ? 'Lagos State (14 LGAs)' :
                   'Lagos Island LGA (6 wards)'}
                </span>
              </div>
            )}

            {/* Quick login cards for selected tenant */}
            {quickLogins.length > 0 && (
              <>
                <h4 className="text-sm font-semibold mb-2">Quick Login — {activeTenant?.name}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 mb-6">
                  {quickLogins.map((ql) => (
                    <motion.button
                      key={ql.role}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleLogin(ql.email)}
                      disabled={loggingIn}
                      className="rounded-lg border border-border bg-card/60 hover:bg-card/80 p-3.5 text-left transition-colors group disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className={cn('text-[10px] border', ql.config.color)}>
                          {ql.config.icon}
                          <span className="ml-1.5">{ql.config.label}</span>
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-sm font-medium mb-0.5">{ql.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{ql.email}</p>
                    </motion.button>
                  ))}
                </div>
              </>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or browse all accounts for this tenant</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Search + filter */}
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-card/60 border-border text-sm"
                />
              </div>
              <div className="flex gap-1">
                {['ALL', ...ROLE_ORDER].map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role as UserRole | 'ALL')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors border',
                      selectedRole === role
                        ? 'bg-foreground/10 text-foreground border-foreground/20'
                        : 'text-muted-foreground border-border hover:bg-card/60'
                    )}
                  >
                    {role === 'ALL' ? 'All' : ROLE_CONFIG[role]?.label?.split(' ').pop()}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose/10 border border-rose/20 text-xs text-rose">
                {error}
              </div>
            )}

            {/* User list grouped by role */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-emerald" />
              </div>
            ) : (
              <div className="space-y-4">
                {ROLE_ORDER.map(role => {
                  const roleUsers = filtered.filter(u => u.role === role);
                  if (roleUsers.length === 0) return null;
                  const cfg = ROLE_CONFIG[role];
                  return (
                    <div key={role}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={cn('text-[10px] h-6 border', cfg.color)}>
                          {cfg.icon}
                          <span className="ml-1.5">{cfg.label}</span>
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{roleUsers.length} account{roleUsers.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-1">
                        {roleUsers.slice(0, selectedRole === role ? roleUsers.length : 3).map(user => (
                          <button
                            key={user.email}
                            onClick={() => handleLogin(user.email)}
                            disabled={loggingIn}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card/30 hover:bg-card/60 transition-colors text-left group disabled:opacity-50"
                          >
                            <div className="relative shrink-0">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span className={cn(
                                'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background',
                                user.isOnline ? 'bg-emerald' : 'bg-muted-foreground/30'
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </button>
                        ))}
                        {selectedRole !== role && roleUsers.length > 3 && (
                          <button
                            onClick={() => setSelectedRole(role)}
                            className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                          >
                            +{roleUsers.length - 3} more...
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3 text-center">
          <p className="text-[10px] text-muted-foreground/50">
            OmniVote Monitor v1.2 &middot; Multi-Tenant &middot; AES-256 Encryption &middot; C2PA Content Provenance
          </p>
        </div>
      </div>
    </div>
  );
}