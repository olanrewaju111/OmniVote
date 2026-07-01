'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore, ROLE_TABS, type UserRole } from '@/store/dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield, Eye, UserCheck, Users, Zap, Search,
  ChevronRight, Loader2, MapPin, Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserOption {
  email: string;
  name: string;
  role: UserRole;
  isOnline: boolean;
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    icon: <Shield className="h-5 w-5" />,
    color: 'text-emerald border-emerald/30 bg-emerald/10',
    desc: 'Platform owner — infrastructure, tenants, global health',
  },
  TENANT_ADMIN: {
    label: 'Tenant Admin',
    icon: <Users className="h-5 w-5" />,
    color: 'text-cyan border-cyan/30 bg-cyan/10',
    desc: 'Organization admin — agent rosters, account management',
  },
  ANALYST: {
    label: 'Situation Room Analyst',
    icon: <Eye className="h-5 w-5" />,
    color: 'text-amber border-amber/30 bg-amber/10',
    desc: 'Live dashboard monitoring, incident review, field ops',
  },
  TRUST_SAFETY: {
    label: 'Trust & Safety Officer',
    icon: <UserCheck className="h-5 w-5" />,
    color: 'text-rose border-rose/30 bg-rose/10',
    desc: 'Deepfake review, disverification, agent authenticity',
  },
  FIELD_AGENT: {
    label: 'Field Agent',
    icon: <Radio className="h-5 w-5" />,
    color: 'text-muted-foreground border-border bg-card',
    desc: 'Polling unit observer — submit reports & media',
  },
};

const ROLE_ORDER: UserRole[] = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY', 'FIELD_AGENT'];

export function LoginScreen() {
  const { login, setElectionInfo } = useDashboardStore();
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'ALL'>('ALL');
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery<{
    tenant: { name: string; slug: string };
    users: UserOption[];
  }>({
    queryKey: ['auth-users'],
    queryFn: () => fetch('/api/auth').then(r => r.json()),
  });

  const users = data?.users || [];
  const tenantName = data?.tenant?.name || 'OmniVote Monitor';

  const filtered = users.filter(u => {
    if (selectedRole !== 'ALL' && u.role !== selectedRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  // Group by role
  const grouped = ROLE_ORDER.reduce<Record<string, UserOption[]>>((acc, role) => {
    const roleUsers = filtered.filter(u => u.role === role);
    if (roleUsers.length > 0) acc[role] = roleUsers;
    return acc;
  }, {});

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setLoggingIn(false);
    }
  };

  // Quick-login: pick one representative user per role for quick access
  const quickLogins = ROLE_ORDER.map(role => {
    const user = users.find(u => u.role === role);
    return user ? { ...user, config: ROLE_CONFIG[role] } : null;
  }).filter(Boolean) as { email: string; name: string; role: UserRole; isOnline: boolean; config: typeof ROLE_CONFIG[string] }[];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] bg-gradient-to-b from-emerald/10 via-background to-background border-r border-border flex-col p-8 justify-between relative overflow-hidden">
        {/* Grid pattern */}
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
          {/* Live stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Polling Units', value: '269' },
              { label: 'Active Agents', value: '27' },
              { label: 'Incidents', value: '80+' },
              { label: 'Threats Blocked', value: '12' },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                <p className="text-lg font-bold text-emerald tabular-nums">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-dot" />
            <span>Election Day — Live Monitoring Active</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            {tenantName} &middot; Multi-tenant deployment &middot; AES-256 encrypted
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

            <h3 className="text-lg font-semibold mb-1">Select Account</h3>
            <p className="text-sm text-muted-foreground mb-5">Choose a persona to explore the platform. Each role sees a different view.</p>

            {/* Quick login cards */}
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

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or browse all accounts</span>
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
                  const roleUsers = grouped[role];
                  if (!roleUsers) return null;
                  const cfg = ROLE_CONFIG[role];
                  return (
                    <div key={role}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={cn('text-[10px] h-6 border', cfg.color)}>
                          {cfg.icon}
                          <span className="ml-1.5">{cfg.label}</span>
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{roleUsers.length} account{roleUsers.length > 1 ? 's' : ''}</span>
                        <span className="text-[11px] text-muted-foreground/50 ml-1">— {cfg.desc}</span>
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
                            +{roleUsers.length - 3} more {role.replace('_', ' ').toLowerCase()}s...
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
            OmniVote Monitor v1.1 &middot; Zero-Trust Architecture &middot; AES-256 Encryption &middot; C2PA Content Provenance
          </p>
        </div>
      </div>
    </div>
  );
}